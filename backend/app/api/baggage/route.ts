import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { baggageCreateSchema, validateData } from '@/lib/validations';

// ========== GET /api/baggage - Get all baggage ==========
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ticket_id = searchParams.get('ticket_id');
    const flight_schedule_id = searchParams.get('flight_schedule_id');
    const passenger_id = searchParams.get('passenger_id');
    const status = searchParams.get('status');
    const baggage_type = searchParams.get('baggage_type');

    let sql = `
      SELECT 
        b.*,
        t.seat_number,
        t.seat_class,
        p.first_name,
        p.last_name,
        p.email,
        p.passport_number,
        fs.departure_datetime,
        fs.arrival_datetime,
        fs.flight_status,
        f.flight_number,
        al.airline_name,
        al.airline_code,
        src.airport_name as source_airport_name,
        src.airport_code as source_airport_code,
        dest.airport_name as destination_airport_name,
        dest.airport_code as destination_airport_code
      FROM Baggage b
      LEFT JOIN Tickets t ON b.ticket_id = t.ticket_id
      LEFT JOIN Passengers p ON t.passenger_id = p.passenger_id
      LEFT JOIN Flight_schedules fs ON b.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filter by ticket
    if (ticket_id) {
      sql += ' AND b.ticket_id = ?';
      params.push(parseInt(ticket_id));
    }

    // Filter by flight schedule
    if (flight_schedule_id) {
      sql += ' AND b.flight_schedule_id = ?';
      params.push(parseInt(flight_schedule_id));
    }

    // Filter by passenger
    if (passenger_id) {
      sql += ' AND p.passenger_id = ?';
      params.push(parseInt(passenger_id));
    }

    // Filter by status
    if (status) {
      sql += ' AND b.status = ?';
      params.push(status);
    }

    // Filter by baggage type
    if (baggage_type) {
      sql += ' AND b.baggage_type = ?';
      params.push(baggage_type);
    }

    sql += ' ORDER BY b.Baggage_id DESC';

    const baggage = await query(sql, params);

    return successResponse(baggage, 'Baggage retrieved successfully');
  } catch (error: any) {
    console.error('Get baggage error:', error);
    return errorResponse('Failed to retrieve baggage: ' + error.message, 500);
  }
}

// ========== POST /api/baggage - Create new baggage ==========
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateData(baggageCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data!;

    // Verify ticket exists
    const ticket = await queryOne<any>(
      'SELECT * FROM Tickets WHERE ticket_id = ?',
      [data.ticket_id]
    );

    if (!ticket) {
      return errorResponse('Ticket not found', 404);
    }

    // Verify flight schedule exists
    const schedule = await queryOne<any>(
      'SELECT * FROM Flight_schedules WHERE flight_schedule_id = ?',
      [data.flight_schedule_id]
    );

    if (!schedule) {
      return errorResponse('Flight schedule not found', 404);
    }

    // Verify ticket belongs to the flight schedule
    if (ticket.flight_schedule_id !== data.flight_schedule_id) {
      return errorResponse('Ticket does not belong to this flight schedule', 400);
    }

    // Check if ticket is cancelled
    if (ticket.status === 'Cancelled') {
      return errorResponse('Cannot add baggage to cancelled ticket', 400);
    }

    // Check if flight is cancelled or completed
    if (schedule.flight_status === 'Cancelled') {
      return errorResponse('Cannot add baggage to cancelled flight', 400);
    }

    if (schedule.flight_status === 'Completed') {
      return errorResponse('Cannot add baggage to completed flight', 400);
    }

    // Validate weight
    if (data.weight_kg <= 0) {
      return errorResponse('Weight must be greater than 0', 400);
    }

    // Insert baggage
    const result = await query<any>(
      `INSERT INTO Baggage (
        ticket_id, flight_schedule_id, weight, 
        baggage_type, status
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        data.ticket_id,
        data.flight_schedule_id,
        data.weight_kg,
        data.baggage_type,
        data.status || 'Checked-In'
      ]
    );

    // Fetch created baggage with joined data
    const newBaggage = await queryOne(
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
      [result.insertId]
    );

    return createdResponse(newBaggage, 'Baggage checked-in successfully');
  } catch (error: any) {
    console.error('Create baggage error:', error);
    return errorResponse('Failed to check-in baggage: ' + error.message, 500);
  }
}