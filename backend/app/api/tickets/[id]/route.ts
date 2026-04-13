export const runtime = 'nodejs';

import { query, queryOne, withTransaction } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, validationErrorResponse } from '@/lib/response';
import { ticketUpdateSchema, validateData } from '@/lib/validations';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

function canAccessTicket(user: AuthenticatedRequest['user'], ticket: any) {
  if (!user) return false;
  if (user.role === 'Admin' || user.role === 'Staff') return true;
  return user.role === 'Customer' && !!user.passenger_id && user.passenger_id === ticket.passenger_id;
}

async function getHandler(req: AuthenticatedRequest, ticketId: number) {
  const user = req.user!;

  const ticket = await queryOne<any>(
    `SELECT 
      t.*,
      p.first_name,
      p.last_name,
      p.email,
      p.passport_number,
      p.nationality,
      p.contact_number,
      p.date_of_birth,
      p.gender,
      fs.departure_datetime,
      fs.arrival_datetime,
      fs.flight_status,
      g.gate_number,
      ter.terminal_name,
      f.flight_number,
      f.flight_type,
      f.estimated_duration,
      al.airline_name,
      al.airline_code,
      src.airport_name as source_airport_name,
      src.airport_code as source_airport_code,
      src.city as source_city,
      src.country as source_country,
      dest.airport_name as destination_airport_name,
      dest.airport_code as destination_airport_code,
      dest.city as destination_city,
      dest.country as destination_country,
      ac.registration_number,
      at.model_name,
      at.manufacturer
    FROM Tickets t
    LEFT JOIN Passengers p ON t.passenger_id = p.passenger_id
    LEFT JOIN Flight_schedules fs ON t.flight_schedule_id = fs.flight_schedule_id
    LEFT JOIN Gates g ON fs.gate_id = g.gate_id
    LEFT JOIN Terminals ter ON g.terminal_id = ter.terminal_id
    LEFT JOIN Flights f ON fs.flight_id = f.flight_id
    LEFT JOIN Airline al ON f.airline_id = al.airline_id
    LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
    LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
    LEFT JOIN Aircraft ac ON fs.aircraft_id = ac.aircraft_id
    LEFT JOIN Aircraft_types at ON ac.aircraft_type_id = at.aircraft_type_id
    WHERE t.ticket_id = ?`,
    [ticketId]
  );

  if (!ticket) return { kind: 'not_found' as const };

  if (!canAccessTicket(user, ticket)) {
    return { kind: 'forbidden' as const };
  }

  return { kind: 'ok' as const, ticket };
}


export const GET = requireAuth(async (req: AuthenticatedRequest) => {
  try {
    const ticketId = parseInt((req as any).nextUrl?.pathname?.split('/').pop() ?? '', 10);
    if (Number.isNaN(ticketId)) return errorResponse('Invalid ticket ID', 400);

    const res = await getHandler(req, ticketId);
    if (res.kind === 'not_found') return notFoundResponse('Ticket not found');
    if (res.kind === 'forbidden') return errorResponse('Access denied', 403);

    return successResponse(res.ticket, 'Ticket retrieved successfully');
  } catch (error: any) {
    console.error('Get ticket error:', error);
    return errorResponse('Failed to retrieve ticket: ' + error.message, 500);
  }
});

export const PUT = requireAuth(async (req: AuthenticatedRequest) => {
  try {
    const ticketId = parseInt((req as any).nextUrl?.pathname?.split('/').pop() ?? '', 10);
    if (Number.isNaN(ticketId)) return errorResponse('Invalid ticket ID', 400);

    const user = req.user!;

    // Check if ticket exists
    const existing = await queryOne<any>('SELECT * FROM Tickets WHERE ticket_id = ?', [ticketId]);
    if (!existing) return notFoundResponse('Ticket not found');

    if (!canAccessTicket(user, existing)) {
      return errorResponse('Access denied', 403);
    }

    const body = await req.json();

    const validation = validateData(ticketUpdateSchema, body);
    if (!validation.success) return validationErrorResponse(validation.errors);

    const updateData = validation.data!;

    if (existing.status === 'Cancelled' && Object.keys(updateData).some((key) => key !== 'status')) {
      return errorResponse('Cannot update cancelled ticket (except status)', 400);
    }
    if (existing.status === 'Boarded' && Object.keys(updateData).some((key) => key !== 'status')) {
      return errorResponse('Cannot update boarded ticket (except status)', 400);
    }

    if (updateData.seat_number && updateData.seat_number !== existing.seat_number) {
      const seatTaken = await queryOne(
        `SELECT ticket_id FROM Tickets 
         WHERE flight_schedule_id = ? 
           AND seat_number = ? 
           AND status NOT IN ('Cancelled', 'Moved')
           AND ticket_id != ?`,
        [existing.flight_schedule_id, updateData.seat_number, ticketId]
      );

      if (seatTaken) return errorResponse('New seat is already taken', 409);
    }

    if (updateData.seat_class && updateData.seat_class !== existing.seat_class) {
      const aircraft = await queryOne<any>(
        `SELECT a.economy_seats, a.business_seats, a.first_class_seats 
         FROM Aircraft a
         JOIN Flight_schedules fs ON a.aircraft_id = fs.aircraft_id
         WHERE fs.flight_schedule_id = ?`,
        [existing.flight_schedule_id]
      );

      if (!aircraft) return errorResponse('Aircraft not found for this flight schedule', 404);

      const bookedSeats = await queryOne<any>(
        `SELECT 
          COUNT(CASE WHEN seat_class = 'Economy' THEN 1 END) as economy_booked,
          COUNT(CASE WHEN seat_class = 'Business' THEN 1 END) as business_booked,
          COUNT(CASE WHEN seat_class = 'First' THEN 1 END) as first_booked
         FROM Tickets 
         WHERE flight_schedule_id = ? 
           AND status NOT IN ('Cancelled', 'Moved')
           AND ticket_id != ?`,
        [existing.flight_schedule_id, ticketId]
      );

      if (updateData.seat_class === 'Economy' && bookedSeats.economy_booked >= aircraft.economy_seats) {
        return errorResponse('No economy seats available', 400);
      }
      if (updateData.seat_class === 'Business' && bookedSeats.business_booked >= aircraft.business_seats) {
        return errorResponse('No business class seats available', 400);
      }
      if (updateData.seat_class === 'First' && bookedSeats.first_booked >= aircraft.first_class_seats) {
        return errorResponse('No first class seats available', 400);
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.seat_number !== undefined) {
      updates.push('seat_number = ?');
      values.push(updateData.seat_number);
    }
    if (updateData.seat_class !== undefined) {
      updates.push('seat_class = ?');
      values.push(updateData.seat_class);
    }
    if (updateData.ticket_price !== undefined) {
      updates.push('ticket_price = ?');
      values.push(updateData.ticket_price);
    }
    if (updateData.status !== undefined) {
      updates.push('status = ?');
      values.push(updateData.status);
    }

    if (updates.length === 0) return errorResponse('No fields to update', 400);

    values.push(ticketId);

    await query(`UPDATE Tickets SET ${updates.join(', ')} WHERE ticket_id = ?`, values);

    const updatedTicket = await queryOne(
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
      [ticketId]
    );

    return successResponse(updatedTicket, 'Ticket updated successfully');
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return errorResponse('New seat is already taken', 409);
    }
    console.error('Update ticket error:', error);
    return errorResponse('Failed to update ticket: ' + error.message, 500);
  }
});

export const DELETE = requireAuth(async (req: AuthenticatedRequest) => {
  try {
    const ticketId = parseInt((req as any).nextUrl?.pathname?.split('/').pop() ?? '', 10);
    if (Number.isNaN(ticketId)) return errorResponse('Invalid ticket ID', 400);

    const user = req.user!;

    const result = await withTransaction(async (conn) => {
      const [rows] = await conn.execute(
        `SELECT ticket_id, passenger_id, status
         FROM Tickets
         WHERE ticket_id = ?
         FOR UPDATE`,
        [ticketId]
      );

      const existing = (rows as any[])[0];
      if (!existing) return { kind: 'not_found' as const };

      if (!canAccessTicket(user, existing)) {
        return { kind: 'forbidden' as const };
      }

      if (existing.status === 'Cancelled') {
        return { kind: 'already_cancelled' as const };
      }

      if (existing.status === 'Boarded') {
        return { kind: 'cannot_cancel' as const, message: 'Cannot cancel boarded ticket' };
      }

      await conn.execute(
        'UPDATE Tickets SET status = ? WHERE ticket_id = ?',
        ['Cancelled', ticketId]
      );

      try {
        await conn.execute(
          'UPDATE Baggage SET status = ? WHERE ticket_id = ?',
          ['Lost', ticketId]
        );
      } catch {}

      try {
        await conn.execute(
          'UPDATE Boarding_Record SET boarding_status = ? WHERE ticket_id = ?',
          ['Denied', ticketId]
        );
      } catch {}

      return { kind: 'ok' as const };
    });

    if (result.kind === 'not_found') return notFoundResponse('Ticket not found');
    if (result.kind === 'forbidden') return errorResponse('Access denied', 403);
    if (result.kind === 'already_cancelled') {
      return successResponse({ ticket_id: ticketId, status: 'Cancelled' }, 'Ticket already cancelled');
    }
    if (result.kind === 'cannot_cancel') return errorResponse(result.message, 400);

    return successResponse({ ticket_id: ticketId, status: 'Cancelled' }, 'Ticket cancelled successfully');
  } catch (error: any) {
    console.error('Cancel ticket error:', error);
    return errorResponse('Failed to cancel ticket: ' + error.message, 500);
  }
});