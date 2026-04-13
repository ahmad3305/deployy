import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { flightScheduleUpdateSchema, validateData } from '@/lib/validations';
import { validateAndPlanCrewForSchedule, createTasksForSchedule, autoAssignStaffForSchedule } from '@/utils/crew-validator'; // <-- Update import path if needed

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scheduleId = parseInt(params.id);

    if (isNaN(scheduleId)) {
      return errorResponse('Invalid flight schedule ID', 400);
    }

    const schedule = await queryOne(
      `SELECT 
        fs.*,
        f.flight_number,
        f.flight_type,
        f.estimated_duration,
        al.airline_name,
        al.airline_code,
        al.country as airline_country,
        ac.registration_number,
        ac.economy_seats,
        ac.business_seats,
        ac.first_class_seats,
        at.model_name,
        at.manufacturer,
        src.airport_name as source_airport_name,
        src.airport_code as source_airport_code,
        src.city as source_city,
        src.country as source_country,
        src.timezone as source_timezone,
        dest.airport_name as destination_airport_name,
        dest.airport_code as destination_airport_code,
        dest.city as destination_city,
        dest.country as destination_country,
        dest.timezone as destination_timezone,
        g.gate_number,
        g.status as gate_status,
        t.terminal_name,
        (SELECT COUNT(*) FROM Tickets WHERE flight_schedule_id = fs.flight_schedule_id AND status != 'Cancelled') as tickets_booked,
        (SELECT COUNT(*) FROM Baggage WHERE flight_schedule_id = fs.flight_schedule_id) as total_baggage
      FROM Flight_schedules fs
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Aircraft ac ON fs.aircraft_id = ac.aircraft_id
      LEFT JOIN Aircraft_types at ON ac.aircraft_type_id = at.aircraft_type_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      LEFT JOIN Gates g ON fs.gate_id = g.gate_id
      LEFT JOIN Terminals t ON g.terminal_id = t.terminal_id
      WHERE fs.flight_schedule_id = ?`,
      [scheduleId]
    );

    if (!schedule) {
      return notFoundResponse('Flight schedule not found');
    }

    const crewReqs = await query(
      `SELECT role_required, number_required
      FROM Crew_requirements
      WHERE flight_schedule_id = ?`,
      [scheduleId]
    );

    (schedule as any).crew_requirements = crewReqs || [];

    return successResponse(schedule, 'Flight schedule retrieved successfully');

  } catch (error: any) {
    console.error('Get flight schedule error:', error);
    return errorResponse('Failed to retrieve flight schedule: ' + error.message, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scheduleId = parseInt(params.id);
    if (isNaN(scheduleId)) return errorResponse('Invalid flight schedule ID', 400);

    const existing = await queryOne<any>(
      'SELECT * FROM Flight_schedules WHERE flight_schedule_id = ?',
      [scheduleId]
    );
    if (!existing) return notFoundResponse('Flight schedule not found');

    const body = await request.json();
    const validation = validateData(flightScheduleUpdateSchema, body);
    if (!validation.success) return validationErrorResponse(validation.errors);
    const updateData = validation.data!;

    if (existing.flight_status === 'Completed') {
      return errorResponse('Cannot update completed flight schedule', 400);
    }

    // 1. Validate new aircraft/gate if provided
    if (updateData.aircraft_id) {
      const aircraft = await queryOne<any>(
        'SELECT * FROM Aircraft WHERE aircraft_id = ?', [updateData.aircraft_id]
      );
      if (!aircraft) return errorResponse('Aircraft not found', 404);
      if (aircraft.status !== 'Active') return errorResponse('Aircraft is not active', 400);
    }
    if (updateData.gate_id) {
      const gate = await queryOne('SELECT * FROM Gates WHERE gate_id = ?', [updateData.gate_id]);
      if (!gate) return errorResponse('Gate not found', 404);
    }

    // 2. Temporal logic
    const newDeparture = updateData.departure_datetime || existing.departure_datetime;
    const newArrival = updateData.arrival_datetime || existing.arrival_datetime;
    if (new Date(newArrival) <= new Date(newDeparture)) {
      return errorResponse('Arrival time must be after departure time', 400);
    }

    // 3. Update schedule fields in DB
    const updates: string[] = [], values: any[] = [];
    if (updateData.aircraft_id !== undefined) { updates.push('aircraft_id = ?'); values.push(updateData.aircraft_id); }
    if (updateData.departure_datetime !== undefined) { updates.push('departure_datetime = ?'); values.push(updateData.departure_datetime); }
    if (updateData.arrival_datetime !== undefined) { updates.push('arrival_datetime = ?'); values.push(updateData.arrival_datetime); }
    if (updateData.gate_id !== undefined) { updates.push('gate_id = ?'); values.push(updateData.gate_id); }
    if (updateData.flight_status !== undefined) { updates.push('flight_status = ?'); values.push(updateData.flight_status); }
    if (updateData.delay_reason !== undefined) { updates.push('delay_reason = ?'); values.push(updateData.delay_reason); }
    if (updates.length > 0) {
      values.push(scheduleId);
      await query(`UPDATE Flight_schedules SET ${updates.join(', ')} WHERE flight_schedule_id = ?`, values);
    }

    // 4. Replace all crew requirements for this schedule
    if (Array.isArray(updateData.crew_requirements)) {
      await query('DELETE FROM Crew_requirements WHERE flight_schedule_id = ?', [scheduleId]);
      for (const cr of updateData.crew_requirements) {
        if (cr && cr.role_required && cr.number_required > 0) {
          await query('INSERT INTO Crew_requirements (flight_schedule_id, role_required, number_required) VALUES (?, ?, ?)',
            [scheduleId, cr.role_required, cr.number_required]);
        }
      }
    }

    // 5. Re-validate crew availability and update status
    const crewResult = await validateAndPlanCrewForSchedule(scheduleId);

    if (crewResult.kind === 'ok') {
    // Enough crew, always mark as scheduled and clear delay_reason (removes any manual/system delay)
    await query(
      `UPDATE Flight_schedules SET flight_status = 'Scheduled', delay_reason = NULL WHERE flight_schedule_id = ?`,
      [scheduleId]
    );
    await createTasksForSchedule(scheduleId);
    await autoAssignStaffForSchedule(scheduleId);

  } else if (crewResult.kind === 'insufficient_crew') {
    // Check if this PUT is a manual/admin delay with a reason set (not just revalidating)
    const isManualDelay =
      updateData.flight_status === 'Delayed' &&
      !!updateData.delay_reason &&
      updateData.delay_reason !== 'Crew-Issue';

    if (!isManualDelay) {
      // System sets the delay reason only if not manual
      await query(
        `UPDATE Flight_schedules SET flight_status = 'Delayed', delay_reason = ? WHERE flight_schedule_id = ?`,
        ['Crew-Issue', scheduleId]
      );
    }

  } else {
    const isManualDelay =
      updateData.flight_status === 'Delayed' &&
      !!updateData.delay_reason &&
      updateData.delay_reason !== 'Crew-Issue';

    if (!isManualDelay) {
      await query(
        `UPDATE Flight_schedules SET flight_status = 'Delayed', delay_reason = ? WHERE flight_schedule_id = ?`,
        ['Crew assignment pending', scheduleId]
      );
    }
  }

    // 6. Return updated state to client
    const updatedSchedule = await queryOne(
      `SELECT 
        fs.*,
        f.flight_number,
        al.airline_name,
        ac.registration_number,
        src.airport_name as source_airport_name,
        dest.airport_name as destination_airport_name,
        g.gate_number
      FROM Flight_schedules fs
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Aircraft ac ON fs.aircraft_id = ac.aircraft_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      LEFT JOIN Gates g ON fs.gate_id = g.gate_id
      WHERE fs.flight_schedule_id = ?`,
      [scheduleId]
    );

    return successResponse(updatedSchedule, 'Flight schedule updated successfully');
  } catch (error: any) {
    console.error('Update flight schedule error:', error);
    return errorResponse('Failed to update flight schedule: ' + error.message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scheduleId = parseInt(params.id);

    if (isNaN(scheduleId)) {
      return errorResponse('Invalid flight schedule ID', 400);
    }

    const existing = await queryOne<any>(
      'SELECT * FROM Flight_schedules WHERE flight_schedule_id = ?',
      [scheduleId]
    );

    if (!existing) {
      return notFoundResponse('Flight schedule not found');
    }

    if (existing.flight_status === 'Cancelled') {
      return errorResponse('Flight schedule is already cancelled', 400);
    }

    if (existing.flight_status === 'Completed') {
      return errorResponse('Cannot cancel completed flight schedule', 400);
    }

    const ticketCount = await queryOne<any>(
      `SELECT COUNT(*) as count FROM Tickets 
       WHERE flight_schedule_id = ? AND status NOT IN ('Cancelled')`,
      [scheduleId]
    );

    if (ticketCount.count > 0) {
      await query(
        'UPDATE Flight_schedules SET flight_status = ? WHERE flight_schedule_id = ?',
        ['Cancelled', scheduleId]
      );

      await query(
        'UPDATE Tickets SET status = ? WHERE flight_schedule_id = ? AND status != ?',
        ['Cancelled', scheduleId, 'Cancelled']
      );

      return successResponse(
        { flight_schedule_id: scheduleId, status: 'Cancelled', tickets_cancelled: ticketCount.count },
        'Flight schedule cancelled successfully'
      );
    } else {
      await query('DELETE FROM Flight_schedules WHERE flight_schedule_id = ?', [scheduleId]);
      return noContentResponse();
    }
  } catch (error: any) {
    console.error('Delete flight schedule error:', error);
    return errorResponse('Failed to delete flight schedule: ' + error.message, 500);
  }
}
