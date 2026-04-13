export const runtime = 'nodejs';

import { query, withTransaction } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { ticketCreateSchema, validateData } from '@/lib/validations';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

async function getHandler(req: AuthenticatedRequest) {
  try {
    const user = req.user!;
    const { searchParams } = new URL(req.url);
    const passenger_id = searchParams.get('passenger_id');
    const flight_schedule_id = searchParams.get('flight_schedule_id');
    const status = searchParams.get('status');

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
      LEFT JOIN Flight_schedules fs ON t.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (user.role === 'Customer') {
      if (!user.passenger_id) {
        return errorResponse('Customer account not linked to passenger profile', 403);
      }
      sql += ' AND t.passenger_id = ?';
      params.push(user.passenger_id);
    } else {
      if (passenger_id) {
        sql += ' AND t.passenger_id = ?';
        params.push(parseInt(passenger_id, 10));
      }
    }

    if (flight_schedule_id) {
      sql += ' AND t.flight_schedule_id = ?';
      params.push(parseInt(flight_schedule_id, 10));
    }

    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY t.booking_date DESC';

    console.log('Fetching tickets with SQL:', sql);
    console.log('Params:', params);

    const tickets = await query(sql, params);
    
    console.log(`Retrieved ${tickets.length} tickets`);
    
    return successResponse(tickets, 'Tickets retrieved successfully');
  } catch (error: any) {
    console.error('Get tickets error:', error);
    return errorResponse('Failed to retrieve tickets: ' + error.message, 500);
  }
}

export const GET = requireAuth(getHandler);

async function postHandler(req: AuthenticatedRequest) {
  try {
    const user = req.user!;
    const body = await req.json();

    console.log('Booking ticket request:', body);

    const validation = validateData(ticketCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data!;

    if (user.role === 'Customer') {
      if (!user.passenger_id) {
        return errorResponse('Customer account not linked to passenger profile', 403);
      }
      if (data.passenger_id !== user.passenger_id) {
        return errorResponse('You can only book tickets for yourself', 403);
      }
    }

    const result = await withTransaction(async (conn) => {
      const [scheduleRows] = await conn.execute(
        `SELECT flight_schedule_id, flight_status, aircraft_id
         FROM Flight_schedules
         WHERE flight_schedule_id = ?
         FOR UPDATE`,
        [data.flight_schedule_id]
      );

      const schedule = (scheduleRows as any[])[0];
      if (!schedule) {
        return { kind: 'error' as const, status: 404, message: 'Flight schedule not found' };
      }

      if (schedule.flight_status === 'Cancelled' || schedule.flight_status === 'Completed') {
        return {
          kind: 'error' as const,
          status: 400,
          message: `Cannot book tickets for ${schedule.flight_status.toLowerCase()} flight`,
        };
      }

      const [aircraftRows] = await conn.execute(
        `SELECT economy_seats, business_seats, first_class_seats
         FROM Aircraft
         WHERE aircraft_id = ?`,
        [schedule.aircraft_id]
      );

      const aircraft = (aircraftRows as any[])[0];
      if (!aircraft) {
        return { kind: 'error' as const, status: 404, message: 'Aircraft not found for this flight schedule' };
      }

      const capacity =
        data.seat_class === 'Economy'
          ? aircraft.economy_seats
          : data.seat_class === 'Business'
            ? aircraft.business_seats
            : aircraft.first_class_seats;

      const [countRows] = await conn.execute(
        `SELECT COUNT(*) as booked
         FROM Tickets
         WHERE flight_schedule_id = ?
           AND seat_class = ?
           AND status NOT IN ('Cancelled', 'Moved')`,
        [data.flight_schedule_id, data.seat_class]
      );

      const booked = (countRows as any[])[0]?.booked ?? 0;
      if (booked >= capacity) {
        return { kind: 'error' as const, status: 400, message: `No ${data.seat_class} seats available` };
      }

      const [seatRows] = await conn.execute(
        `SELECT ticket_id
         FROM Tickets
         WHERE flight_schedule_id = ?
           AND seat_number = ?
           AND status NOT IN ('Cancelled', 'Moved')
         LIMIT 1`,
        [data.flight_schedule_id, data.seat_number]
      );

      if ((seatRows as any[]).length > 0) {
        return { kind: 'error' as const, status: 409, message: 'Seat already booked' };
      }

      const [insertResult] = await conn.execute(
        `INSERT INTO Tickets (
          passenger_id,
          flight_schedule_id,
          seat_number,
          seat_class,
          ticket_price,
          booking_date,
          status
        ) VALUES (?, ?, ?, ?, ?, NOW(), 'Pending')`,
        [data.passenger_id, data.flight_schedule_id, data.seat_number, data.seat_class, data.ticket_price]
      );

      const ticketId = (insertResult as any).insertId;

      await conn.execute(
        `INSERT INTO Payments (ticket_id, amount, payment_method, payment_status, payment_date)
         VALUES (?, ?, NULL, 'Pending', NULL)`,
        [ticketId, data.ticket_price]
      );

      const [ticketRows] = await conn.execute(
        `SELECT 
          t.*,
          p.first_name,
          p.last_name,
          p.email,
          fs.departure_datetime,
          fs.arrival_datetime,
          f.flight_number,
          al.airline_name,
          src.airport_name as source_airport,
          dest.airport_name as destination_airport
         FROM Tickets t
         LEFT JOIN Passengers p ON t.passenger_id = p.passenger_id
         LEFT JOIN Flight_schedules fs ON t.flight_schedule_id = fs.flight_schedule_id
         LEFT JOIN Flights f ON fs.flight_id = f.flight_id
         LEFT JOIN Airline al ON f.airline_id = al.airline_id
         LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
         LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
         WHERE t.ticket_id = ?`,
        [ticketId]
      );

      return { kind: 'ok' as const, ticket: (ticketRows as any[])[0] };
    });

    if (result.kind === 'error') {
      return errorResponse(result.message, result.status);
    }

    console.log('Ticket booked successfully:', result.ticket);
    return createdResponse(result.ticket, 'Ticket booked successfully (Pending payment)');
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return errorResponse('Seat already booked', 409);
    }
    console.error('Create ticket error:', error);
    return errorResponse('Failed to book ticket: ' + error.message, 500);
  }
}

export const POST = requireAuth(postHandler);