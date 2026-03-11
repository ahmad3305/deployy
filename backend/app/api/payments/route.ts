export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { paymentCreateSchema, validateData } from '@/lib/validations';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

// ========== GET /api/payments - Get payments (Own or Staff+) ==========
async function getHandler(req: AuthenticatedRequest) {
  try {
    const user = req.user!;
    const { searchParams } = new URL(req.url);
    const ticket_id = searchParams.get('ticket_id');
    const payment_status = searchParams.get('payment_status');

    let sql = `
      SELECT 
        pay.*,
        t.ticket_id,
        t.seat_number,
        t.ticket_class,
        p.first_name as passenger_first_name,
        p.last_name as passenger_last_name,
        f.flight_number
      FROM Payments pay
      LEFT JOIN Tickets t ON pay.ticket_id = t.ticket_id
      LEFT JOIN Passengers p ON t.passenger_id = p.passenger_id
      LEFT JOIN Flight_Schedule fs ON t.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Customers can only see their own payments
    if (user.role === 'Customer') {
      if (!user.passenger_id) {
        return errorResponse('Customer account not linked to passenger profile', 403);
      }
      sql += ' AND p.passenger_id = ?';
      params.push(user.passenger_id);
    }

    if (ticket_id) {
      sql += ' AND pay.ticket_id = ?';
      params.push(parseInt(ticket_id));
    }

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

export const GET = requireAuth(getHandler);

// ========== POST /api/payments - Create payment (Authenticated) ==========
async function postHandler(req: AuthenticatedRequest) {
  try {
    const user = req.user!;
    const body = await req.json();

    const validation = validateData(paymentCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data!;

    // Verify ticket exists and belongs to user (if Customer)
    const ticket = await queryOne<any>(
      'SELECT * FROM Tickets WHERE ticket_id = ?',
      [data.ticket_id]
    );

    if (!ticket) {
      return errorResponse('Ticket not found', 404);
    }

    // Customers can only pay for their own tickets
    if (user.role === 'Customer') {
      if (!user.passenger_id || ticket.passenger_id !== user.passenger_id) {
        return errorResponse('Access denied', 403);
      }
    }

    // Check if payment already exists
    const existingPayment = await queryOne(
      'SELECT payment_id FROM Payments WHERE ticket_id = ?',
      [data.ticket_id]
    );

    if (existingPayment) {
      return errorResponse('Payment already exists for this ticket', 409);
    }

    // Create payment
    const result = await query<any>(
      `INSERT INTO Payments (
        ticket_id, amount, payment_method, payment_status, payment_date
      ) VALUES (?, ?, ?, 'Completed', NOW())`,
      [data.ticket_id, data.amount, data.payment_method]
    );

    const newPayment = await queryOne(
      'SELECT * FROM Payments WHERE payment_id = ?',
      [result.insertId]
    );

    return createdResponse(newPayment, 'Payment processed successfully');
  } catch (error: any) {
    console.error('Create payment error:', error);
    return errorResponse('Failed to process payment: ' + error.message, 500);
  }
}

export const POST = requireAuth(postHandler);