import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { flightConsolidationCreateSchema, validateData } from '@/lib/validations';

// ========== GET /api/flight-consolidations - Get all flight consolidations ==========
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const original_flight_schedule_id = searchParams.get('original_flight_schedule_id');
    const new_flight_schedule_id = searchParams.get('new_flight_schedule_id');

    let sql = `
      SELECT 
        fc.*,
        orig_fs.departure_datetime as original_departure,
        orig_fs.arrival_datetime as original_arrival,
        orig_fs.flight_status as original_status,
        orig_f.flight_number as original_flight_number,
        orig_al.airline_name as original_airline,
        new_fs.departure_datetime as new_departure,
        new_fs.arrival_datetime as new_arrival,
        new_fs.flight_status as new_status,
        new_f.flight_number as new_flight_number,
        new_al.airline_name as new_airline,
        src.airport_name as source_airport_name,
        src.airport_code as source_airport_code,
        dest.airport_name as destination_airport_name,
        dest.airport_code as destination_airport_code,
        (SELECT COUNT(*) FROM Tickets t 
         WHERE t.flight_schedule_id = fc.original_flight_schedule_id) as affected_passengers
      FROM Flight_consolidation fc
      LEFT JOIN Flight_schedules orig_fs ON fc.original_flight_schedule_id = orig_fs.flight_schedule_id
      LEFT JOIN Flights orig_f ON orig_fs.flight_id = orig_f.flight_id
      LEFT JOIN Airline orig_al ON orig_f.airline_id = orig_al.airline_id
      LEFT JOIN Flight_schedules new_fs ON fc.new_flight_schedule_id = new_fs.flight_schedule_id
      LEFT JOIN Flights new_f ON new_fs.flight_id = new_f.flight_id
      LEFT JOIN Airline new_al ON new_f.airline_id = new_al.airline_id
      LEFT JOIN Airport src ON orig_f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON orig_f.destination_airport_id = dest.airport_id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filter by original flight schedule
    if (original_flight_schedule_id) {
      sql += ' AND fc.original_flight_schedule_id = ?';
      params.push(parseInt(original_flight_schedule_id));
    }

    // Filter by new flight schedule
    if (new_flight_schedule_id) {
      sql += ' AND fc.new_flight_schedule_id = ?';
      params.push(parseInt(new_flight_schedule_id));
    }

    sql += ' ORDER BY fc.consolidation_date DESC';

    const consolidations = await query(sql, params);

    return successResponse(consolidations, 'Flight consolidations retrieved successfully');
  } catch (error: any) {
    console.error('Get flight consolidations error:', error);
    return errorResponse('Failed to retrieve flight consolidations: ' + error.message, 500);
  }
}

// ========== POST /api/flight-consolidations - Create new flight consolidation ==========
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateData(flightConsolidationCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data!;

    // Prevent consolidating a flight to itself
    if (data.original_flight_schedule_id === data.new_flight_schedule_id) {
      return errorResponse('Cannot consolidate a flight to itself', 400);
    }

    // Verify original flight schedule exists
    const originalSchedule = await queryOne<any>(
      'SELECT * FROM Flight_schedules WHERE flight_schedule_id = ?',
      [data.original_flight_schedule_id]
    );

    if (!originalSchedule) {
      return errorResponse('Original flight schedule not found', 404);
    }

    // Verify new flight schedule exists
    const newSchedule = await queryOne<any>(
      'SELECT * FROM Flight_schedules WHERE flight_schedule_id = ?',
      [data.new_flight_schedule_id]
    );

    if (!newSchedule) {
      return errorResponse('New flight schedule not found', 404);
    }

    // Check if original flight is already completed
    if (originalSchedule.flight_status === 'Completed') {
      return errorResponse('Cannot consolidate completed flight', 400);
    }

    // Check if new flight is cancelled
    if (newSchedule.flight_status === 'Cancelled') {
      return errorResponse('Cannot consolidate to cancelled flight', 400);
    }

    // Check if consolidation already exists
    const existingConsolidation = await queryOne(
      'SELECT consolidation_id FROM Flight_consolidation WHERE original_flight_schedule_id = ?',
      [data.original_flight_schedule_id]
    );

    if (existingConsolidation) {
      return errorResponse('This flight has already been consolidated', 409);
    }

    // Insert consolidation
    const result = await query<any>(
      `INSERT INTO Flight_consolidation (
        original_flight_schedule_id, new_flight_schedule_id, 
        reason, consolidation_date
      ) VALUES (?, ?, ?, ?)`,
      [
        data.original_flight_schedule_id,
        data.new_flight_schedule_id,
        data.reason,
        data.consolidation_date
      ]
    );

    // Update original flight status to Cancelled
    await query(
      'UPDATE Flight_schedules SET flight_status = ? WHERE flight_schedule_id = ?',
      ['Cancelled', data.original_flight_schedule_id]
    );

    // Fetch created consolidation with joined data
    const newConsolidation = await queryOne(
      `SELECT 
        fc.*,
        orig_f.flight_number as original_flight_number,
        orig_al.airline_name as original_airline,
        new_f.flight_number as new_flight_number,
        new_al.airline_name as new_airline,
        (SELECT COUNT(*) FROM Tickets t 
         WHERE t.flight_schedule_id = fc.original_flight_schedule_id) as affected_passengers
      FROM Flight_consolidation fc
      LEFT JOIN Flight_schedules orig_fs ON fc.original_flight_schedule_id = orig_fs.flight_schedule_id
      LEFT JOIN Flights orig_f ON orig_fs.flight_id = orig_f.flight_id
      LEFT JOIN Airline orig_al ON orig_f.airline_id = orig_al.airline_id
      LEFT JOIN Flight_schedules new_fs ON fc.new_flight_schedule_id = new_fs.flight_schedule_id
      LEFT JOIN Flights new_f ON new_fs.flight_id = new_f.flight_id
      LEFT JOIN Airline new_al ON new_f.airline_id = new_al.airline_id
      WHERE fc.consolidation_id = ?`,
      [result.insertId]
    );

    return createdResponse(newConsolidation, 'Flight consolidation created successfully');
  } catch (error: any) {
    console.error('Create flight consolidation error:', error);
    return errorResponse('Failed to create flight consolidation: ' + error.message, 500);
  }
}