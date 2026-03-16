export const runtime = 'nodejs';

import { query, withTransaction } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  createdResponse,
  validationErrorResponse,
} from '@/lib/response';
import { paymentCreateSchema, validateData } from '@/lib/validations';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

// ========== GET /api/payments - Get payments (Own or Staff+) ==========
async function getHandler(req: AuthenticatedRequest) {
  try {
    const user = req.user!;
    const { searchParams } = new URL(req.url);
    const ticket_id = searchParams.get('ticket_id');
    const payment_status = searchParams.get('payment_status');

    // FIXES:
    // - t.ticket_class -> t.seat_class (based on your Tickets table)
    // - Flight_Schedule -> Flight_schedules (based on your DB schema)
    let sql = `
      SELECT 
        pay.*,
        t.ticket_id,
        t.seat_number,
        t.seat_class,
        p.first_name as passenger_first_name,
        p.last_name as passenger_last_name,
        f.flight_number
      FROM Payments pay
      LEFT JOIN Tickets t ON pay.ticket_id = t.ticket_id
      LEFT JOIN Passengers p ON t.passenger_id = p.passenger_id
      LEFT JOIN Flight_schedules fs ON t.flight_schedule_id = fs.flight_schedule_id
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
      params.push(parseInt(ticket_id, 10));
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

    // --- Strong typing guards to fix mysql2 execute overload issues ---
    const ticketId = Number(data.ticket_id);
    if (!Number.isFinite(ticketId)) {
      return errorResponse('ticket_id is required', 400);
    }

    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return errorResponse('amount must be a positive number', 400);
    }

    const paymentMethod = data.payment_method as string;
    if (!paymentMethod) {
      return errorResponse('payment_method is required', 400);
    }
    // ---------------------------------------------------------------

    const result = await withTransaction(async (conn) => {
      // 1) Lock ticket row
      const [ticketRows] = await conn.execute(
        `SELECT ticket_id, passenger_id, status, ticket_price
         FROM Tickets
         WHERE ticket_id = ?
         FOR UPDATE`,
        [ticketId]
      );

      const ticket = (ticketRows as any[])[0];
      if (!ticket) {
        return { kind: 'error' as const, status: 404, message: 'Ticket not found' };
      }

      // Customers can only pay for their own tickets
      if (user.role === 'Customer') {
        if (!user.passenger_id || ticket.passenger_id !== user.passenger_id) {
          return { kind: 'error' as const, status: 403, message: 'Access denied' };
        }
      }

      // Basic business rules
      if (ticket.status === 'Cancelled') {
        return { kind: 'error' as const, status: 400, message: 'Cannot pay for a cancelled ticket' };
      }
      if (ticket.status === 'Boarded') {
        return { kind: 'error' as const, status: 400, message: 'Cannot pay for a boarded ticket' };
      }

      // 2) One payment per ticket (atomic check)
      const [existingPayRows] = await conn.execute(
        `SELECT payment_id
         FROM Payments
         WHERE ticket_id = ?
         LIMIT 1
         FOR UPDATE`,
        [ticketId]
      );

      if ((existingPayRows as any[]).length > 0) {
        return { kind: 'error' as const, status: 409, message: 'Payment already exists for this ticket' };
      }

      // 3) Insert payment
      const [insertResult] = await conn.execute(
        `INSERT INTO Payments (ticket_id, amount, payment_method, payment_status, payment_date)
         VALUES (?, ?, ?, 'Completed', NOW())`,
        [ticketId, amount, paymentMethod]
      );

      const paymentId = (insertResult as any).insertId;

      // 4) Fetch created payment
      const [paymentRows] = await conn.execute(
        `SELECT * FROM Payments WHERE payment_id = ?`,
        [paymentId]
      );

      return { kind: 'ok' as const, payment: (paymentRows as any[])[0] };
    });

    if (result.kind === 'error') {
      return errorResponse(result.message, result.status);
    }

    return createdResponse(result.payment, 'Payment processed successfully');
  } catch (error: any) {
    console.error('Create payment error:', error);
    return errorResponse('Failed to process payment: ' + error.message, 500);
  }
}

export const POST = requireAuth(postHandler);