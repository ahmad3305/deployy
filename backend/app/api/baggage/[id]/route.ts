import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { baggageUpdateSchema, validateData } from '@/lib/validations';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const baggageId = parseInt(params.id);

    if (isNaN(baggageId)) {
      return errorResponse('Invalid baggage ID', 400);
    }

    const baggage = await queryOne(
      `SELECT 
        b.*,
        t.ticket_id,
        t.seat_number,
        t.seat_class,
        t.status as ticket_status,
        p.first_name,
        p.last_name,
        p.email,
        p.passport_number,
        p.contact_number,
        fs.departure_datetime,
        fs.arrival_datetime,
        fs.flight_status,
        f.flight_number,
        f.flight_type,
        al.airline_name,
        al.airline_code,
        src.airport_name as source_airport_name,
        src.airport_code as source_airport_code,
        src.city as source_city,
        src.country as source_country,
        dest.airport_name as destination_airport_name,
        dest.airport_code as destination_airport_code,
        dest.city as destination_city,
        dest.country as destination_country
      FROM Baggage b
      LEFT JOIN Tickets t ON b.ticket_id = t.ticket_id
      LEFT JOIN Passengers p ON t.passenger_id = p.passenger_id
      LEFT JOIN Flight_schedules fs ON b.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE b.Baggage_id = ?`,
      [baggageId]
    );

    if (!baggage) {
      return notFoundResponse('Baggage not found');
    }

    return successResponse(baggage, 'Baggage retrieved successfully');
  } catch (error: any) {
    console.error('Get baggage error:', error);
    return errorResponse('Failed to retrieve baggage: ' + error.message, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const baggageId = parseInt(params.id);

    if (isNaN(baggageId)) {
      return errorResponse('Invalid baggage ID', 400);
    }

    const existing = await queryOne<any>(
      'SELECT * FROM Baggage WHERE Baggage_id = ?',
      [baggageId]
    );

    if (!existing) {
      return notFoundResponse('Baggage not found');
    }

    const body = await request.json();

    const validation = validateData(baggageUpdateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const updateData = validation.data!;

    if (updateData.weight_kg !== undefined && updateData.weight_kg <= 0) {
      return errorResponse('Weight must be greater than 0', 400);
    }

    if (updateData.status) {
      const validTransitions: Record<string, string[]> = {
        'Checked-In': ['Loaded', 'Lost'],
        'Loaded': ['In Transit', 'Lost'],
        'In Transit': ['Unloaded', 'Lost'],
        'Unloaded': ['Lost'], 
        'Lost': ['Unloaded'], 
      };

      const allowedStatuses = validTransitions[existing.status] || [];
      if (!allowedStatuses.includes(updateData.status)) {
        return errorResponse(
          `Cannot change status from ${existing.status} to ${updateData.status}`,
          400
        );
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.weight_kg !== undefined) {
      updates.push('weight = ?');
      values.push(updateData.weight_kg);
    }
    if (updateData.baggage_type !== undefined) {
      updates.push('baggage_type = ?');
      values.push(updateData.baggage_type);
    }
    if (updateData.status !== undefined) {
      updates.push('status = ?');
      values.push(updateData.status);
    }

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    values.push(baggageId);

    await query(
      `UPDATE Baggage SET ${updates.join(', ')} WHERE Baggage_id = ?`,
      values
    );

    const updatedBaggage = await queryOne(
      `SELECT 
        b.*,
        t.seat_number,
        t.seat_class,
        p.first_name,
        p.last_name,
        p.email,
        fs.departure_datetime,
        f.flight_number,
        al.airline_name,
        src.airport_name as source_airport_name,
        dest.airport_name as destination_airport_name
      FROM Baggage b
      LEFT JOIN Tickets t ON b.ticket_id = t.ticket_id
      LEFT JOIN Passengers p ON t.passenger_id = p.passenger_id
      LEFT JOIN Flight_schedules fs ON b.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE b.Baggage_id = ?`,
      [baggageId]
    );

    return successResponse(updatedBaggage, 'Baggage updated successfully');
  } catch (error: any) {
    console.error('Update baggage error:', error);
    return errorResponse('Failed to update baggage: ' + error.message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const baggageId = parseInt(params.id);

    if (isNaN(baggageId)) {
      return errorResponse('Invalid baggage ID', 400);
    }

    const existing = await queryOne<any>(
      'SELECT * FROM Baggage WHERE Baggage_id = ?',
      [baggageId]
    );

    if (!existing) {
      return notFoundResponse('Baggage not found');
    }

    if (['Loaded', 'In Transit', 'Unloaded'].includes(existing.status)) {
      return errorResponse(
        `Cannot delete baggage with status ${existing.status}. Update status to Lost if needed.`,
        400
      );
    }

    await query('DELETE FROM Baggage WHERE Baggage_id = ?', [baggageId]);

    return noContentResponse();
  } catch (error: any) {
    console.error('Delete baggage error:', error);
    return errorResponse('Failed to delete baggage: ' + error.message, 500);
  }
}