export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { ticketCreateSchema, validateData } from '@/lib/validations';
import { requireAuth, requireStaff, AuthenticatedRequest } from '@/lib/auth-middleware';

// ========== GET /api/tickets - Get tickets (Customer sees own, Staff sees all) ==========
async function getHandler(req: AuthenticatedRequest) {
  try {
    const user = req.user!;
    const { searchParams } = new URL(req.url);
    const passenger_id = searchParams.get('passenger_id');
    const flight_schedule_id = searchParams.get('flight_schedule_id');
    const booking_status = searchParams.get('booking_status');

    let sql = `
      SELECT 
        t.*,
        p.first_name as passenger_first_name,
        p.last_name as passenger_last_name,
        p.email as passenger_email,
        fs.departure_datetime,
        fs.arrival_datetime,
        f.flight_number,
        al.airline_name,
        src.airport_name as source_airport,
        dest.airport_name as destination_airport
      FROM Tickets t
      LEFT JOIN Passengers p ON t.passenger_id = p.passenger_id
      LEFT JOIN Flight_Schedule fs ON t.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE 1=1
    `;
    const params: any[] = [];

    // If Customer role, only show their tickets
    if (user.role === 'Customer') {
      if (!user.passenger_id) {
        return errorResponse('Customer account not linked to passenger profile', 403);
      }
      sql += ' AND t.passenger_id = ?';
      params.push(user.passenger_id);
    } else {
      // Staff/Admin can filter by passenger_id
      if (passenger_id) {
        sql += ' AND t.passenger_id = ?';
        params.push(parseInt(passenger_id));
      }
    }

    if (flight_schedule_id) {
      sql += ' AND t.flight_schedule_id = ?';
      params.push(parseInt(flight_schedule_id));
    }

    if (booking_status) {
      sql += ' AND t.booking_status = ?';
      params.push(booking_status);
    }

    sql += ' ORDER BY t.booking_date DESC';

    const tickets = await query(sql, params);

    return successResponse(tickets, 'Tickets retrieved successfully');
  } catch (error: any) {
    console.error('Get tickets error:', error);
    return errorResponse('Failed to retrieve tickets: ' + error.message, 500);
  }
}

export const GET = requireAuth(getHandler);

// ========== POST /api/tickets - Create ticket (Authenticated users) ==========
async function postHandler(req: AuthenticatedRequest) {
  try {
    const user = req.user!;
    const body = await req.json();

    const validation = validateData(ticketCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data!;

    // If Customer, they can only book for themselves
    if (user.role === 'Customer') {
      if (!user.passenger_id) {
        return errorResponse('Customer account not linked to passenger profile', 403);
      }
      if (data.passenger_id !== user.passenger_id) {
        return errorResponse('You can only book tickets for yourself', 403);
      }
    }

    // Verify flight schedule exists
    const schedule = await queryOne<any>(
      'SELECT * FROM Flight_Schedule WHERE flight_schedule_id = ?',
      [data.flight_schedule_id]
    );

    if (!schedule) {
      return errorResponse('Flight schedule not found', 404);
    }

    if (schedule.flight_status === 'Cancelled') {
      return errorResponse('Cannot book tickets for cancelled flight', 400);
    }

    // Check seat availability
    const existingSeat = await queryOne(
      'SELECT ticket_id FROM Tickets WHERE flight_schedule_id = ? AND seat_number = ?',
      [data.flight_schedule_id, data.seat_number]
    );

    if (existingSeat) {
      return errorResponse('Seat already booked', 409);
    }

    // Create ticket
    const result = await query<any>(
      `INSERT INTO Tickets (
        passenger_id, flight_schedule_id, seat_number, ticket_class,
        ticket_price, booking_date, booking_status
      ) VALUES (?, ?, ?, ?, ?, NOW(), 'Confirmed')`,
      [
        data.passenger_id,
        data.flight_schedule_id,
        data.seat_number,
        data.seat_class,
        data.ticket_price
      ]
    );

    const newTicket = await queryOne(
      `SELECT t.*, p.first_name, p.last_name, f.flight_number
       FROM Tickets t
       LEFT JOIN Passengers p ON t.passenger_id = p.passenger_id
       LEFT JOIN Flight_Schedule fs ON t.flight_schedule_id = fs.flight_schedule_id
       LEFT JOIN Flights f ON fs.flight_id = f.flight_id
       WHERE t.ticket_id = ?`,
      [result.insertId]
    );

    return createdResponse(newTicket, 'Ticket booked successfully');
  } catch (error: any) {
    console.error('Create ticket error:', error);
    return errorResponse('Failed to book ticket: ' + error.message, 500);
  }
}

export const POST = requireAuth(postHandler);