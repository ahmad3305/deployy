import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { flightScheduleUpdateSchema, validateData } from '@/lib/validations';

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

    const body = await request.json();

    const validation = validateData(flightScheduleUpdateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const updateData = validation.data!;

    if (existing.flight_status === 'Completed') {
      return errorResponse('Cannot update completed flight schedule', 400);
    }

    if (updateData.aircraft_id) {
      const aircraft = await queryOne<any>(
        'SELECT * FROM Aircraft WHERE aircraft_id = ?',
        [updateData.aircraft_id]
      );

      if (!aircraft) {
        return errorResponse('Aircraft not found', 404);
      }

      if (aircraft.status !== 'Active') {
        return errorResponse('Aircraft is not active', 400);
      }
    }

    if (updateData.gate_id) {
      const gate = await queryOne(
        'SELECT * FROM Gates WHERE gate_id = ?',
        [updateData.gate_id]
      );

      if (!gate) {
        return errorResponse('Gate not found', 404);
      }
    }

    const newDeparture = updateData.departure_datetime || existing.departure_datetime;
    const newArrival = updateData.arrival_datetime || existing.arrival_datetime;
    const newAircraftId = updateData.aircraft_id || existing.aircraft_id;
    const newGateId = updateData.gate_id || existing.gate_id;

    const departureTime = new Date(newDeparture);
    const arrivalTime = new Date(newArrival);

    if (arrivalTime <= departureTime) {
      return errorResponse('Arrival time must be after departure time', 400);
    }


    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.aircraft_id !== undefined) {
      updates.push('aircraft_id = ?');
      values.push(updateData.aircraft_id);
    }
    if (updateData.departure_datetime !== undefined) {
      updates.push('departure_datetime = ?');
      values.push(updateData.departure_datetime);
    }
    if (updateData.arrival_datetime !== undefined) {
      updates.push('arrival_datetime = ?');
      values.push(updateData.arrival_datetime);
    }
    if (updateData.gate_id !== undefined) {
      updates.push('gate_id = ?');
      values.push(updateData.gate_id);
    }
    if (updateData.flight_status !== undefined) {
      updates.push('flight_status = ?');
      values.push(updateData.flight_status);
    }

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    values.push(scheduleId);

    await query(
      `UPDATE Flight_schedules SET ${updates.join(', ')} WHERE flight_schedule_id = ?`,
      values
    );

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