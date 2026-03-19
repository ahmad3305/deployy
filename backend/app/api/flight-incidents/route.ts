import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { flightConsolidationUpdateSchema, validateData } from '@/lib/validations';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const consolidationId = parseInt(params.id);

    if (isNaN(consolidationId)) {
      return errorResponse('Invalid consolidation ID', 400);
    }

    const consolidation = await queryOne(
      `SELECT 
        fc.*,
        orig_fs.departure_datetime as original_departure,
        orig_fs.arrival_datetime as original_arrival,
        orig_fs.flight_status as original_status,
        orig_f.flight_number as original_flight_number,
        orig_f.flight_type as original_flight_type,
        orig_al.airline_name as original_airline,
        orig_al.airline_code as original_airline_code,
        new_fs.departure_datetime as new_departure,
        new_fs.arrival_datetime as new_arrival,
        new_fs.flight_status as new_status,
        new_f.flight_number as new_flight_number,
        new_f.flight_type as new_flight_type,
        new_al.airline_name as new_airline,
        new_al.airline_code as new_airline_code,
        src.airport_name as source_airport_name,
        src.airport_code as source_airport_code,
        dest.airport_name as destination_airport_name,
        dest.airport_code as destination_airport_code,
        (SELECT COUNT(*) FROM Tickets t 
         WHERE t.flight_schedule_id = fc.original_flight_schedule_id) as affected_passengers
      FROM Flight_consolidation fc
      LEFT JOIN Flight_Schedule orig_fs ON fc.original_flight_schedule_id = orig_fs.flight_schedule_id
      LEFT JOIN Flights orig_f ON orig_fs.flight_id = orig_f.flight_id
      LEFT JOIN Airline orig_al ON orig_f.airline_id = orig_al.airline_id
      LEFT JOIN Flight_Schedule new_fs ON fc.new_flight_schedule_id = new_fs.flight_schedule_id
      LEFT JOIN Flights new_f ON new_fs.flight_id = new_f.flight_id
      LEFT JOIN Airline new_al ON new_f.airline_id = new_al.airline_id
      LEFT JOIN Airport src ON orig_f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON orig_f.destination_airport_id = dest.airport_id
      WHERE fc.consolidation_id = ?`,
      [consolidationId]
    );

    if (!consolidation) {
      return notFoundResponse('Flight consolidation not found');
    }

    return successResponse(consolidation, 'Flight consolidation retrieved successfully');
  } catch (error: any) {
    console.error('Get flight consolidation error:', error);
    return errorResponse('Failed to retrieve flight consolidation: ' + error.message, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const consolidationId = parseInt(params.id);

    if (isNaN(consolidationId)) {
      return errorResponse('Invalid consolidation ID', 400);
    }

    const existing = await queryOne<any>(
      'SELECT * FROM Flight_consolidation WHERE consolidation_id = ?',
      [consolidationId]
    );

    if (!existing) {
      return notFoundResponse('Flight consolidation not found');
    }

    const body = await request.json();

    const validation = validateData(flightConsolidationUpdateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const updateData = validation.data!;

    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.reason !== undefined) {
      updates.push('reason = ?');
      values.push(updateData.reason);
    }
    if (updateData.consolidation_date !== undefined) {
      updates.push('consolidation_date = ?');
      values.push(updateData.consolidation_date);
    }

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    values.push(consolidationId);

    await query(
      `UPDATE Flight_consolidation SET ${updates.join(', ')} WHERE consolidation_id = ?`,
      values
    );

    const updatedConsolidation = await queryOne(
      `SELECT 
        fc.*,
        orig_f.flight_number as original_flight_number,
        new_f.flight_number as new_flight_number
      FROM Flight_consolidation fc
      LEFT JOIN Flight_Schedule orig_fs ON fc.original_flight_schedule_id = orig_fs.flight_schedule_id
      LEFT JOIN Flights orig_f ON orig_fs.flight_id = orig_f.flight_id
      LEFT JOIN Flight_Schedule new_fs ON fc.new_flight_schedule_id = new_fs.flight_schedule_id
      LEFT JOIN Flights new_f ON new_fs.flight_id = new_f.flight_id
      WHERE fc.consolidation_id = ?`,
      [consolidationId]
    );

    return successResponse(updatedConsolidation, 'Flight consolidation updated successfully');
  } catch (error: any) {
    console.error('Update flight consolidation error:', error);
    return errorResponse('Failed to update flight consolidation: ' + error.message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const consolidationId = parseInt(params.id);

    if (isNaN(consolidationId)) {
      return errorResponse('Invalid consolidation ID', 400);
    }

    const existing = await queryOne<any>(
      'SELECT * FROM Flight_consolidation WHERE consolidation_id = ?',
      [consolidationId]
    );

    if (!existing) {
      return notFoundResponse('Flight consolidation not found');
    }

    await query('DELETE FROM Flight_consolidation WHERE consolidation_id = ?', [consolidationId]);

    return noContentResponse();
  } catch (error: any) {
    console.error('Delete flight consolidation error:', error);
    return errorResponse('Failed to delete flight consolidation: ' + error.message, 500);
  }
}