import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { boardingRecordUpdateSchema, validateData } from '@/lib/validations';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const boardingId = parseInt(params.id);

    if (isNaN(boardingId)) {
      return errorResponse('Invalid boarding record ID', 400);
    }

    const record = await queryOne(
      `SELECT 
        br.*,
        t.ticket_id,
        t.seat_number,
        t.seat_class,
        t.ticket_price,
        t.status as ticket_status,
        p.first_name,
        p.last_name,
        p.email,
        p.passport_number,
        p.contact_number,
        p.date_of_birth,
        p.nationality,
        fs.flight_schedule_id,
        fs.departure_datetime,
        fs.arrival_datetime,
        fs.flight_status,
        f.flight_number,
        f.flight_type,
        al.airline_name,
        al.airline_code,
        g.gate_number,
        g.status as gate_status,
        term.terminal_name,
        term.terminal_code,
        a.airport_name,
        a.airport_code,
        src.airport_name as source_airport_name,
        src.airport_code as source_airport_code,
        src.city as source_city,
        dest.airport_name as destination_airport_name,
        dest.airport_code as destination_airport_code,
        dest.city as destination_city
      FROM Boarding_records br
      LEFT JOIN Tickets t ON br.ticket_id = t.ticket_id
      LEFT JOIN Passengers p ON t.passenger_id = p.passenger_id
      LEFT JOIN Flight_schedules fs ON t.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Gates g ON br.gate_id = g.gate_id
      LEFT JOIN Terminals term ON g.terminal_id = term.terminal_id
      LEFT JOIN Airport a ON term.airport_id = a.airport_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE br.boarding_id = ?`,
      [boardingId]
    );

    if (!record) {
      return notFoundResponse('Boarding record not found');
    }

    return successResponse(record, 'Boarding record retrieved successfully');
  } catch (error: any) {
    console.error('Get boarding record error:', error);
    return errorResponse('Failed to retrieve boarding record: ' + error.message, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const boardingId = parseInt(params.id);

    if (isNaN(boardingId)) {
      return errorResponse('Invalid boarding record ID', 400);
    }

    const existing = await queryOne<any>(
      `SELECT br.*, t.ticket_id, t.flight_schedule_id, fs.departure_datetime, fs.flight_status, t.status as ticket_status
       FROM Boarding_records br
       LEFT JOIN Tickets t ON br.ticket_id = t.ticket_id
       LEFT JOIN Flight_Schedule fs ON t.flight_schedule_id = fs.flight_schedule_id
       WHERE br.boarding_id = ?`,
      [boardingId]
    );

    if (!existing) {
      return notFoundResponse('Boarding record not found');
    }

    const body = await request.json();

    const validation = validateData(boardingRecordUpdateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const updateData = validation.data!;

    if (existing.boarding_status === 'Denied' && updateData.boarding_status !== 'Boarded') {
      return errorResponse('Cannot update denied boarding record (except to change status)', 400);
    }

    if (existing.flight_status === 'Completed') {
      return errorResponse('Cannot update boarding record for completed flight', 400);
    }

    if (updateData.gate_id) {
      const gate = await queryOne<any>(
        'SELECT * FROM Gates WHERE gate_id = ?',
        [updateData.gate_id]
      );

      if (!gate) {
        return errorResponse('Gate not found', 404);
      }

      if (gate.status !== 'Available' && gate.status !== 'Occupied') {
        return errorResponse('Gate is not available', 400);
      }
    }

    if (updateData.boarding_time) {
      const newBoardingTime = new Date(updateData.boarding_time);
      const departureTime = new Date(existing.departure_datetime);

      if (newBoardingTime > departureTime) {
        return errorResponse('Boarding time cannot be after departure time', 400);
      }
    }

    if (updateData.boarding_status) {
      if (updateData.boarding_status === 'Boarded' && existing.boarding_status !== 'Boarded') {
        await query(
          'UPDATE Tickets SET status = ? WHERE ticket_id = ?',
          ['Boarded', existing.ticket_id]
        );
      }

      if (updateData.boarding_status === 'Denied' && existing.boarding_status === 'Boarded') {
        await query(
          'UPDATE Tickets SET status = ? WHERE ticket_id = ?',
          ['Confirmed', existing.ticket_id]
        );
      }

      const validTransitions: Record<string, string[]> = {
        'Pending': ['Boarded', 'Denied'],
        'Boarded': ['Denied'],
        'Denied': ['Boarded', 'Pending'], 
      };

      const allowedStatuses = validTransitions[existing.boarding_status] || [];
      if (!allowedStatuses.includes(updateData.boarding_status)) {
        return errorResponse(
          `Cannot change boarding status from ${existing.boarding_status} to ${updateData.boarding_status}`,
          400
        );
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.gate_id !== undefined) {
      updates.push('gate_id = ?');
      values.push(updateData.gate_id);
    }
    if (updateData.boarding_time !== undefined) {
      updates.push('boarding_time = ?');
      values.push(updateData.boarding_time);
    }
    if (updateData.boarding_status !== undefined) {
      updates.push('boarding_status = ?');
      values.push(updateData.boarding_status);
    }

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    values.push(boardingId);

    await query(
      `UPDATE Boarding_records SET ${updates.join(', ')} WHERE boarding_id = ?`,
      values
    );

    const updatedRecord = await queryOne(
      `SELECT 
        br.*,
        t.seat_number,
        t.seat_class,
        t.status as ticket_status,
        p.first_name,
        p.last_name,
        p.email,
        fs.departure_datetime,
        f.flight_number,
        al.airline_name,
        g.gate_number,
        term.terminal_name
      FROM Boarding_records br
      LEFT JOIN Tickets t ON br.ticket_id = t.ticket_id
      LEFT JOIN Passengers p ON t.passenger_id = p.passenger_id
      LEFT JOIN Flight_schedules fs ON t.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Gates g ON br.gate_id = g.gate_id
      LEFT JOIN Terminals term ON g.terminal_id = term.terminal_id
      WHERE br.boarding_id = ?`,
      [boardingId]
    );

    return successResponse(updatedRecord, 'Boarding record updated successfully');
  } catch (error: any) {
    console.error('Update boarding record error:', error);
    return errorResponse('Failed to update boarding record: ' + error.message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const boardingId = parseInt(params.id);

    if (isNaN(boardingId)) {
      return errorResponse('Invalid boarding record ID', 400);
    }

    const existing = await queryOne<any>(
      `SELECT br.*, t.ticket_id, fs.flight_status
       FROM Boarding_records br
       LEFT JOIN Tickets t ON br.ticket_id = t.ticket_id
       LEFT JOIN Flight_Schedule fs ON t.flight_schedule_id = fs.flight_schedule_id
       WHERE br.boarding_id = ?`,
      [boardingId]
    );

    if (!existing) {
      return notFoundResponse('Boarding record not found');
    }

    if (existing.flight_status === 'Completed') {
      return errorResponse('Cannot delete boarding record for completed flight', 400);
    }

    if (existing.boarding_status === 'Boarded') {
      await query(
        'UPDATE Tickets SET status = ? WHERE ticket_id = ?',
        ['Confirmed', existing.ticket_id]
      );
    }

    await query('DELETE FROM Boarding_records WHERE boarding_id = ?', [boardingId]);

    return noContentResponse();
  } catch (error: any) {
    console.error('Delete boarding record error:', error);
    return errorResponse('Failed to delete boarding record: ' + error.message, 500);
  }
}