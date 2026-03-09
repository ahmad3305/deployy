import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { ticketUpdateSchema, validateData } from '@/lib/validations';

// ========== GET /api/tickets/[id] - Get single ticket ==========
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ticketId = parseInt(params.id);

    if (isNaN(ticketId)) {
      return errorResponse('Invalid ticket ID', 400);
    }

    const ticket = await queryOne(
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
        fs.gate_id,
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
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      LEFT JOIN Aircraft ac ON fs.aircraft_id = ac.aircraft_id
      LEFT JOIN Aircraft_types at ON ac.aircraft_type_id = at.aircraft_type_id
      WHERE t.ticket_id = ?`,
      [ticketId]
    );

    if (!ticket) {
      return notFoundResponse('Ticket not found');
    }

    return successResponse(ticket, 'Ticket retrieved successfully');
  } catch (error: any) {
    console.error('Get ticket error:', error);
    return errorResponse('Failed to retrieve ticket: ' + error.message, 500);
  }
}

// ========== PUT /api/tickets/[id] - Update ticket ==========
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ticketId = parseInt(params.id);

    if (isNaN(ticketId)) {
      return errorResponse('Invalid ticket ID', 400);
    }

    // Check if ticket exists
    const existing = await queryOne<any>(
      'SELECT * FROM Tickets WHERE ticket_id = ?',
      [ticketId]
    );

    if (!existing) {
      return notFoundResponse('Ticket not found');
    }

    const body = await request.json();

    // Validate input
    const validation = validateData(ticketUpdateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const updateData = validation.data!;

    // Prevent updates to cancelled or boarded tickets (except status changes)
    if (existing.status === 'Cancelled' && Object.keys(updateData).some(key => key !== 'status')) {
      return errorResponse('Cannot update cancelled ticket (except status)', 400);
    }

    if (existing.status === 'Boarded' && Object.keys(updateData).some(key => key !== 'status')) {
      return errorResponse('Cannot update boarded ticket (except status)', 400);
    }

    // If seat number is being changed, check if new seat is available
    if (updateData.seat_number && updateData.seat_number !== existing.seat_number) {
      const seatTaken = await queryOne(
        `SELECT ticket_id FROM Tickets 
         WHERE flight_schedule_id = ? AND seat_number = ? AND status != 'Cancelled' AND ticket_id != ?`,
        [existing.flight_schedule_id, updateData.seat_number, ticketId]
      );

      if (seatTaken) {
        return errorResponse('New seat is already taken', 409);
      }
    }

    // If seat class is being changed, check availability
    if (updateData.seat_class && updateData.seat_class !== existing.seat_class) {
      const aircraft = await queryOne<any>(
        `SELECT a.economy_seats, a.business_seats, a.first_class_seats 
         FROM Aircraft a
         JOIN Flight_schedules fs ON a.aircraft_id = fs.aircraft_id
         WHERE fs.flight_schedule_id = ?`,
        [existing.flight_schedule_id]
      );

      if (!aircraft) {
        return errorResponse('Aircraft not found for this flight schedule', 404);
      }

      const bookedSeats = await queryOne<any>(
        `SELECT 
          COUNT(CASE WHEN seat_class = 'Economy' THEN 1 END) as economy_booked,
          COUNT(CASE WHEN seat_class = 'Business' THEN 1 END) as business_booked,
          COUNT(CASE WHEN seat_class = 'First' THEN 1 END) as first_booked
         FROM Tickets 
         WHERE flight_schedule_id = ? AND status != 'Cancelled' AND ticket_id != ?`,
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

    // Build update query dynamically
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

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    values.push(ticketId);

    await query(
      `UPDATE Tickets SET ${updates.join(', ')} WHERE ticket_id = ?`,
      values
    );

    // Fetch updated ticket with joined data
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
    console.error('Update ticket error:', error);
    return errorResponse('Failed to update ticket: ' + error.message, 500);
  }
}

// ========== DELETE /api/tickets/[id] - Cancel ticket ==========
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ticketId = parseInt(params.id);

    if (isNaN(ticketId)) {
      return errorResponse('Invalid ticket ID', 400);
    }

    // Check if ticket exists
    const existing = await queryOne<any>(
      'SELECT * FROM Tickets WHERE ticket_id = ?',
      [ticketId]
    );

    if (!existing) {
      return notFoundResponse('Ticket not found');
    }

    // Check if ticket is already cancelled
    if (existing.status === 'Cancelled') {
      return errorResponse('Ticket is already cancelled', 400);
    }

    // Check if ticket is already boarded
    if (existing.status === 'Boarded') {
      return errorResponse('Cannot cancel boarded ticket', 400);
    }

    // Soft delete: Update status to Cancelled instead of hard delete
    await query(
      'UPDATE Tickets SET status = ? WHERE ticket_id = ?',
      ['Cancelled', ticketId]
    );

    // Also cancel related baggage
    await query(
      'UPDATE Baggage SET status = ? WHERE ticket_id = ?',
      ['Lost', ticketId] // or create a 'Cancelled' status for baggage
    );

    // Cancel related boarding records
    await query(
      'UPDATE Boarding_Record SET boarding_status = ? WHERE ticket_id = ?',
      ['Denied', ticketId]
    );

    return successResponse({ ticket_id: ticketId, status: 'Cancelled' }, 'Ticket cancelled successfully');
  } catch (error: any) {
    console.error('Cancel ticket error:', error);
    return errorResponse('Failed to cancel ticket: ' + error.message, 500);
  }
}