import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { paymentCreateSchema, validateData } from '@/lib/validations';

// ========== GET /api/payments - Get all payments ==========
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ticket_id = searchParams.get('ticket_id');
    const cargo_id = searchParams.get('cargo_id');
    const passenger_id = searchParams.get('passenger_id');
    const payment_method = searchParams.get('payment_method');
    const payment_status = searchParams.get('payment_status');

    let sql = `
      SELECT 
        pay.*,
        t.seat_number,
        t.seat_class,
        t.ticket_price,
        p.first_name,
        p.last_name,
        p.email,
        fs.departure_datetime,
        fs.arrival_datetime,
        f.flight_number,
        al.airline_name,
        al.airline_code,
        src.airport_name as source_airport_name,
        src.airport_code as source_airport_code,
        dest.airport_name as destination_airport_name,
        dest.airport_code as destination_airport_code,
        c.tracking_number,
        c.cargo_type,
        c.weight_kg,
        c.sender_name,
        c.reciever_name
      FROM Payments pay
      LEFT JOIN Tickets t ON pay.ticket_id = t.ticket_id
      LEFT JOIN Passengers p ON t.passenger_id = p.passenger_id
      LEFT JOIN Flight_Schedule fs ON t.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Cargo c ON pay.cargo_id = c.cargo_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filter by ticket
    if (ticket_id) {
      sql += ' AND pay.ticket_id = ?';
      params.push(parseInt(ticket_id));
    }

    // Filter by cargo
    if (cargo_id) {
      sql += ' AND pay.cargo_id = ?';
      params.push(parseInt(cargo_id));
    }

    // Filter by passenger
    if (passenger_id) {
      sql += ' AND p.passenger_id = ?';
      params.push(parseInt(passenger_id));
    }

    // Filter by payment method
    if (payment_method) {
      sql += ' AND pay.payment_method = ?';
      params.push(payment_method);
    }

    // Filter by payment status
    if (payment_status) {
      sql += ' AND pay.payment_status = ?';
      params.push(payment_status);
    }

    sql += ' ORDER BY pay.payment_date DESC';

    const payments = await query(sql, params);

    return successResponse(payments, 'Payments retrieved successfully');
  } catch (error: any) {
    console.error('Get payments error:', error);
    return errorResponse('Failed to retrieve payments: ' + error.message, 500);
  }
}

// ========== POST /api/payments - Create new payment ==========
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateData(paymentCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data!;

    // Must provide either ticket_id or cargo_id, but not both
    if (!data.ticket_id && !data.cargo_id) {
      return errorResponse('Either ticket_id or cargo_id must be provided', 400);
    }

    if (data.ticket_id && data.cargo_id) {
      return errorResponse('Cannot process payment for both ticket and cargo simultaneously', 400);
    }

    let entityType = '';
    let entityData: any = null;

    // Validate ticket payment
    if (data.ticket_id) {
      const ticket = await queryOne<any>(
        'SELECT * FROM Tickets WHERE ticket_id = ?',
        [data.ticket_id]
      );

      if (!ticket) {
        return errorResponse('Ticket not found', 404);
      }

      // Check if ticket is already paid
      const existingPayment = await queryOne<any>(
        'SELECT * FROM Payments WHERE ticket_id = ? AND payment_status = ?',
        [data.ticket_id, 'Completed']
      );

      if (existingPayment) {
        return errorResponse('Ticket is already paid', 409);
      }

      // Validate payment amount matches ticket price
      if (data.amount !== ticket.ticket_price) {
        return errorResponse(`Payment amount must match ticket price (${ticket.ticket_price})`, 400);
      }

      entityType = 'ticket';
      entityData = ticket;
    }

    // Validate cargo payment
    if (data.cargo_id) {
      const cargo = await queryOne<any>(
        'SELECT * FROM Cargo WHERE cargo_id = ?',
        [data.cargo_id]
      );

      if (!cargo) {
        return errorResponse('Cargo not found', 404);
      }

      // Check if cargo is already paid
      const existingPayment = await queryOne<any>(
        'SELECT * FROM Payments WHERE cargo_id = ? AND payment_status = ?',
        [data.cargo_id, 'Completed']
      );

      if (existingPayment) {
        return errorResponse('Cargo is already paid', 409);
      }

      entityType = 'cargo';
      entityData = cargo;
    }

    // Validate payment amount
    if (data.amount <= 0) {
      return errorResponse('Payment amount must be greater than 0', 400);
    }

    // Insert payment
    const result = await query<any>(
      `INSERT INTO Payments (
        ticket_id, cargo_id, amount, payment_method, payment_status
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        data.ticket_id || null,
        data.cargo_id || null,
        data.amount,
        data.payment_method,
        data.payment_status || 'Pending'
      ]
    );

    // Update ticket status to Confirmed if payment is successful
    if (entityType === 'ticket' && data.payment_status === 'Completed') {
      await query(
        'UPDATE Tickets SET status = ? WHERE ticket_id = ?',
        ['Confirmed', data.ticket_id]
      );
    }

    // Update cargo status if payment is successful
    if (entityType === 'cargo' && data.payment_status === 'Completed') {
      await query(
        'UPDATE Cargo SET status = ? WHERE cargo_id = ? AND status = ?',
        ['Booked', data.cargo_id, 'Booked']
      );
    }

    // Fetch created payment with joined data
    const newPayment = await queryOne(
      `SELECT 
        pay.*,
        t.seat_number,
        t.seat_class,
        t.ticket_price,
        p.first_name,
        p.last_name,
        p.email,
        fs.departure_datetime,
        f.flight_number,
        al.airline_name,
        src.airport_name as source_airport_name,
        dest.airport_name as destination_airport_name,
        c.tracking_number,
        c.cargo_type,
        c.weight_kg
      FROM Payments pay
      LEFT JOIN Tickets t ON pay.ticket_id = t.ticket_id
      LEFT JOIN Passengers p ON t.passenger_id = p.passenger_id
      LEFT JOIN Flight_Schedule fs ON t.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Cargo c ON pay.cargo_id = c.cargo_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE pay.payment_id = ?`,
      [result.insertId]
    );

    return createdResponse(newPayment, 'Payment processed successfully');
  } catch (error: any) {
    console.error('Create payment error:', error);
    return errorResponse('Failed to process payment: ' + error.message, 500);
  }
}