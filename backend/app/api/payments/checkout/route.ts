export const runtime = 'nodejs';

import { withTransaction } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/response';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

async function postHandler(req: AuthenticatedRequest) {
  try {
    const user = req.user!;
    const body = await req.json();

    const ticketId = Number(body?.ticket_id);
    const paymentMethod = body?.payment_method as string;

    if (!Number.isFinite(ticketId)) {
      return errorResponse('ticket_id is required', 400);
    }
    if (!paymentMethod) {
      return errorResponse('payment_method is required', 400);
    }

    const allowedMethods = new Set(['Credit Card', 'Cash', 'Online Transfer']);
    if (!allowedMethods.has(paymentMethod)) {
      return errorResponse('Invalid payment_method', 400);
    }

    const result = await withTransaction(async (conn) => {
      const [ticketRows] = await conn.execute(
        `SELECT ticket_id, passenger_id, status, ticket_price
         FROM Tickets
         WHERE ticket_id = ?
         FOR UPDATE`,
        [ticketId]
      );

      const ticket = (ticketRows as any[])[0];
      if (!ticket) return { kind: 'error' as const, status: 404, message: 'Ticket not found' };

      if (user.role === 'Customer') {
        if (!user.passenger_id || ticket.passenger_id !== user.passenger_id) {
          return { kind: 'error' as const, status: 403, message: 'Access denied' };
        }
      }

      if (ticket.status === 'Cancelled') {
        return { kind: 'error' as const, status: 400, message: 'Ticket is cancelled' };
      }
      if (ticket.status === 'Boarded') {
        return { kind: 'error' as const, status: 400, message: 'Ticket already boarded' };
      }

      const [payRows] = await conn.execute(
        `SELECT payment_id, payment_status
         FROM Payments
         WHERE ticket_id = ?
         LIMIT 1
         FOR UPDATE`,
        [ticketId]
      );

      const payment = (payRows as any[])[0];
      if (!payment) {
        return { kind: 'error' as const, status: 404, message: 'Pending payment not found for this ticket' };
      }

      if (payment.payment_status === 'Completed') {
        return { kind: 'error' as const, status: 409, message: 'Payment already completed for this ticket' };
      }
      if (payment.payment_status !== 'Pending') {
        return { kind: 'error' as const, status: 400, message: `Cannot checkout payment in status: ${payment.payment_status}` };
      }

      await conn.execute(
        `UPDATE Payments
         SET payment_method = ?, payment_status = 'Completed', payment_date = NOW()
         WHERE payment_id = ?`,
        [paymentMethod, payment.payment_id]
      );

      if (ticket.status === 'Pending') {
        await conn.execute(
          `UPDATE Tickets
           SET status = 'Confirmed'
           WHERE ticket_id = ?`,
          [ticketId]
        );
      }

      return { kind: 'ok' as const, payment_id: payment.payment_id };
    });

    if (result.kind === 'error') return errorResponse(result.message, result.status);

    return successResponse({ payment_id: result.payment_id }, 'Checkout successful');
  } catch (error: any) {
    console.error('Checkout error:', error);
    return errorResponse('Checkout failed: ' + error.message, 500);
  }
}

export const POST = requireAuth(postHandler);