import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { ticketCreateSchema, validateData } from '@/lib/validations';

// ========== GET /api/tickets - Get all tickets ==========
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const passenger_id = searchParams.get('passenger_id');
    const flight_schedule_id = searchParams.get('flight_schedule_id');
    const status = searchParams.get('status');
    const seat_class = searchParams.get('seat_class');

    let sql = `
      SELECT 
        t.*,
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
        src.city as source_city,
        dest.airport_name as destination_airport_name,
        dest.airport_code as destination_airport_code,
        dest.city as destination_city
      FROM Tickets t
      LEFT JOIN Passengers p ON t.passenger_id = p.passenger_id
      LEFT JOIN Flight_schedules fs ON t.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filter by passenger
    if (passenger_id) {
      sql += ' AND t.passenger_id = ?';
      params.push(parseInt(passenger_id));
    }

    // Filter by flight schedule
    if (flight_schedule_id) {
      sql += ' AND t.flight_schedule_id = ?';
      params.push(parseInt(flight_schedule_id));
    }

    // Filter by status
    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    // Filter by seat class
    if (seat_class) {
      sql += ' AND t.seat_class = ?';
      params.push(seat_class);
    }

    sql += ' ORDER BY t.booking_date DESC';

    const tickets = await query(sql, params);

    return successResponse(tickets, 'Tickets retrieved successfully');
  } catch (error: any) {
    console.error('Get tickets error:', error);
    return errorResponse('Failed to retrieve tickets: ' + error.message, 500);
  }
}

// ========== POST /api/tickets - Create new ticket (Book a ticket) ==========
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateData(ticketCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data!;

    // Verify passenger exists
    const passenger = await queryOne(
      'SELECT passenger_id FROM Passengers WHERE passenger_id = ?',
      [data.passenger_id]
    );

    if (!passenger) {
      return errorResponse('Passenger not found', 404);
    }

    // Verify flight schedule exists and is not cancelled/completed
    const schedule = await queryOne<any>(
      'SELECT * FROM Flight_schedules WHERE flight_schedule_id = ?',
      [data.flight_schedule_id]
    );

    if (!schedule) {
      return errorResponse('Flight schedule not found', 404);
    }

    if (schedule.flight_status === 'Cancelled') {
      return errorResponse('Cannot book ticket for cancelled flight', 400);
    }

    if (schedule.flight_status === 'Completed') {
      return errorResponse('Cannot book ticket for completed flight', 400);
    }

    // Check if seat is already taken
    const seatTaken = await queryOne(
      `SELECT ticket_id FROM Tickets 
       WHERE flight_schedule_id = ? AND seat_number = ? AND status != 'Cancelled'`,
      [data.flight_schedule_id, data.seat_number]
    );

    if (seatTaken) {
      return errorResponse('Seat is already taken', 409);
    }

    // Verify seat class matches aircraft capacity
    const aircraft = await queryOne<any>(
      `SELECT a.economy_seats, a.business_seats, a.first_class_seats 
       FROM Aircraft a
       JOIN Flight_schedules fs ON a.aircraft_id = fs.aircraft_id
       WHERE fs.flight_schedule_id = ?`,
      [data.flight_schedule_id]
    );

    if (!aircraft) {
      return errorResponse('Aircraft not found for this flight schedule', 404);
    }

    // Check seat availability by class
    const bookedSeats = await queryOne<any>(
      `SELECT 
        COUNT(CASE WHEN seat_class = 'Economy' THEN 1 END) as economy_booked,
        COUNT(CASE WHEN seat_class = 'Business' THEN 1 END) as business_booked,
        COUNT(CASE WHEN seat_class = 'First' THEN 1 END) as first_booked
       FROM Tickets 
       WHERE flight_schedule_id = ? AND status != 'Cancelled'`,
      [data.flight_schedule_id]
    );

    if (data.seat_class === 'Economy' && bookedSeats.economy_booked >= aircraft.economy_seats) {
      return errorResponse('No economy seats available', 400);
    }

    if (data.seat_class === 'Business' && bookedSeats.business_booked >= aircraft.business_seats) {
      return errorResponse('No business class seats available', 400);
    }

    if (data.seat_class === 'First' && bookedSeats.first_booked >= aircraft.first_class_seats) {
      return errorResponse('No first class seats available', 400);
    }

    // Insert ticket
    const result = await query<any>(
      `INSERT INTO Tickets (
        passenger_id, flight_schedule_id, seat_number, 
        seat_class, ticket_price, status
      ) VALUES (?, ?, ?, ?, ?, 'Confirmed')`,
      [
        data.passenger_id,
        data.flight_schedule_id,
        data.seat_number,
        data.seat_class,
        data.ticket_price
      ]
    );

    // Fetch created ticket with joined data
    const newTicket = await queryOne(
      `SELECT 
        t.*,
        p.first_name,
        p.last_name,
        p.email,
        fs.departure_datetime,
        fs.arrival_datetime,
        f.flight_number,
        al.airline_name,
        src.airport_name as source_airport_name,
        dest.airport_name as destination_airport_name
      FROM Tickets t
      LEFT JOIN Passengers p ON t.passenger_id = p.passenger_id
      LEFT JOIN Flight_schedules fs ON t.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE t.ticket_id = ?`,
      [result.insertId]
    );

    return createdResponse(newTicket, 'Ticket booked successfully');
  } catch (error: any) {
    console.error('Create ticket error:', error);
    return errorResponse('Failed to book ticket: ' + error.message, 500);
  }
}