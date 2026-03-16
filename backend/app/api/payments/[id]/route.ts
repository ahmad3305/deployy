export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { query, queryOne, withTransaction } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  noContentResponse,
  validationErrorResponse,
} from '@/lib/response';
import { paymentUpdateSchema, validateData } from '@/lib/validations';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

// Helpers
function isPrivileged(user: AuthenticatedRequest['user']) {
  return user?.role === 'Admin' || user?.role === 'Staff';
}

async function canAccessPayment(user: AuthenticatedRequest['user'], paymentId: number): Promise<boolean> {
  if (!user) return false;
  if (isPrivileged(user)) return true;

  // Customer: only if payment belongs to their passenger (through ticket)
  if (user.role === 'Customer') {
    if (!user.passenger_id) return false;

    const row = await queryOne<any>(
      `SELECT pay.payment_id
       FROM Payments pay
       JOIN Tickets t ON pay.ticket_id = t.ticket_id
       WHERE pay.payment_id = ?
         AND t.passenger_id = ?
       LIMIT 1`,
      [paymentId, user.passenger_id]
    );
    return !!row;
  }

  return false;
}

// ========== GET /api/payments/[id] - Get single payment ==========
async function getHandler(req: AuthenticatedRequest, paymentId: number) {
  const user = req.user!;

  if (!(await canAccessPayment(user, paymentId))) {
    return { kind: 'forbidden' as const };
  }

  // FIXES:
  // - Flight_Schedule -> Flight_schedules
  const payment = await queryOne<any>(
    `SELECT 
      pay.*,
      t.ticket_id,
      t.seat_number,
      t.seat_class,
      t.ticket_price,
      t.status as ticket_status,
      p.first_name,
      p.last_name,
      p.email,
      p.passport_number,
      p.contact_number,
      fs.departure_datetime,
      fs.arrival_datetime,
      fs.flight_status,
      f.flight_number,
      f.flight_type,
      al.airline_name,
      al.airline_code,
      src.airport_name as source_airport_name,
      src.airport_code as source_airport_code,
      src.city as source_city,
      dest.airport_name as destination_airport_name,
      dest.airport_code as destination_airport_code,
      dest.city as destination_city,
      c.cargo_id,
      c.tracking_number,
      c.cargo_type,
      c.weight_kg,
      c.sender_name,
      c.sender_contact,
      c.reciever_name,
      c.reciever_contact,
      c.status as cargo_status
    FROM Payments pay
    LEFT JOIN Tickets t ON pay.ticket_id = t.ticket_id
    LEFT JOIN Passengers p ON t.passenger_id = p.passenger_id
    LEFT JOIN Flight_schedules fs ON t.flight_schedule_id = fs.flight_schedule_id
    LEFT JOIN Flights f ON fs.flight_id = f.flight_id
    LEFT JOIN Airline al ON f.airline_id = al.airline_id
    LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
    LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
    LEFT JOIN Cargo c ON pay.cargo_id = c.cargo_id
    WHERE pay.payment_id = ?`,
    [paymentId]
  );

  if (!payment) return { kind: 'not_found' as const };

  return { kind: 'ok' as const, payment };
}

export const GET = requireAuth(async (req: AuthenticatedRequest) => {
  try {
    const paymentId = parseInt((req as any).nextUrl?.pathname?.split('/').pop() ?? '', 10);
    if (Number.isNaN(paymentId)) return errorResponse('Invalid payment ID', 400);

    const res = await getHandler(req, paymentId);
    if (res.kind === 'forbidden') return errorResponse('Access denied', 403);
    if (res.kind === 'not_found') return notFoundResponse('Payment not found');

    return successResponse(res.payment, 'Payment retrieved successfully');
  } catch (error: any) {
    console.error('Get payment error:', error);
    return errorResponse('Failed to retrieve payment: ' + error.message, 500);
  }
});

// ========== PUT /api/payments/[id] - Update payment ==========
export const PUT = requireAuth(async (req: AuthenticatedRequest) => {
  try {
    const user = req.user!;
    const paymentId = parseInt((req as any).nextUrl?.pathname?.split('/').pop() ?? '', 10);
    if (Number.isNaN(paymentId)) return errorResponse('Invalid payment ID', 400);

    // RBAC:
    // - Admin/Staff can update (e.g. mark failed/refund)
    // - Customer cannot update payments
    if (!isPrivileged(user)) {
      return errorResponse('Access denied', 403);
    }

    const body = await req.json();

    const validation = validateData(paymentUpdateSchema, body);
    if (!validation.success) return validationErrorResponse(validation.errors);

    const updateData = validation.data!;

    const result = await withTransaction(async (conn) => {
      // Lock payment row
      const [payRows] = await conn.execute(
        `SELECT payment_id, ticket_id, cargo_id, payment_status, amount, payment_method
         FROM Payments
         WHERE payment_id = ?
         FOR UPDATE`,
        [paymentId]
      );

      const existing = (payRows as any[])[0];
      if (!existing) return { kind: 'not_found' as const };

      // Prevent updates to completed payments (except status changes to Failed)
      if (existing.payment_status === 'Completed') {
        if (updateData.payment_status && updateData.payment_status !== 'Failed') {
          return {
            kind: 'error' as const,
            status: 400,
            message: 'Completed payments can only be marked as Failed (for refunds)',
          };
        }
        if (Object.keys(updateData).some((key) => key !== 'payment_status')) {
          return {
            kind: 'error' as const,
            status: 400,
            message: 'Cannot update completed payment details (except status)',
          };
        }
      }

      // Validate amount
      if (updateData.amount !== undefined) {
        const amt = Number(updateData.amount);
        if (!Number.isFinite(amt) || amt <= 0) {
          return { kind: 'error' as const, status: 400, message: 'Payment amount must be greater than 0' };
        }
      }

      // If changing status to Failed from Completed => refund-like logic
      // (Keep your behavior, but make it atomic)
      if (updateData.payment_status === 'Failed' && existing.payment_status === 'Completed') {
        if (existing.ticket_id) {
          const [ticketRows] = await conn.execute(
            `SELECT ticket_id, status
             FROM Tickets
             WHERE ticket_id = ?
             FOR UPDATE`,
            [existing.ticket_id]
          );

          const ticket = (ticketRows as any[])[0];
          if (ticket && ticket.status === 'Boarded') {
            return { kind: 'error' as const, status: 400, message: 'Cannot refund payment for boarded ticket' };
          }

          // Update ticket status to Cancelled
          await conn.execute('UPDATE Tickets SET status = ? WHERE ticket_id = ?', [
            'Cancelled',
            existing.ticket_id,
          ]);
        }

        if (existing.cargo_id) {
          const [cargoRows] = await conn.execute(
            `SELECT cargo_id, status
             FROM Cargo
             WHERE cargo_id = ?
             FOR UPDATE`,
            [existing.cargo_id]
          );

          const cargo = (cargoRows as any[])[0];
          if (cargo && cargo.status === 'Delivered') {
            return { kind: 'error' as const, status: 400, message: 'Cannot refund payment for delivered cargo' };
          }
          // No cargo status change here unless you want one (left as-is)
        }
      }

      // If changing status to Completed from non-completed => confirm related entities
      if (updateData.payment_status === 'Completed' && existing.payment_status !== 'Completed') {
        if (existing.ticket_id) {
          await conn.execute('UPDATE Tickets SET status = ? WHERE ticket_id = ?', ['Confirmed', existing.ticket_id]);
        }
        if (existing.cargo_id) {
          // Your original condition was odd (status = 'Booked' AND status = 'Booked'); leaving a sane version:
          await conn.execute(
            'UPDATE Cargo SET status = ? WHERE cargo_id = ? AND status = ?',
            ['Booked', existing.cargo_id, 'Booked']
          );
        }
      }

      // Build update query
      const updates: string[] = [];
      const values: any[] = [];

      if (updateData.amount !== undefined) {
        updates.push('amount = ?');
        values.push(Number(updateData.amount));
      }
      if (updateData.payment_method !== undefined) {
        updates.push('payment_method = ?');
        values.push(updateData.payment_method);
      }
      if (updateData.payment_status !== undefined) {
        updates.push('payment_status = ?');
        values.push(updateData.payment_status);
      }

      if (updates.length === 0) {
        return { kind: 'error' as const, status: 400, message: 'No fields to update' };
      }

      values.push(paymentId);

      await conn.execute(`UPDATE Payments SET ${updates.join(', ')} WHERE payment_id = ?`, values);

      // Fetch updated payment (simpler view)
      const [updatedRows] = await conn.execute(
        `SELECT 
          pay.*,
          t.seat_number,
          t.seat_class,
          t.ticket_price,
          t.status as ticket_status,
          p.first_name,
          p.last_name,
          p.email,
          fs.departure_datetime,
          f.flight_number,
          al.airline_name,
          c.tracking_number,
          c.cargo_type,
          c.status as cargo_status
        FROM Payments pay
        LEFT JOIN Tickets t ON pay.ticket_id = t.ticket_id
        LEFT JOIN Passengers p ON t.passenger_id = p.passenger_id
        LEFT JOIN Flight_schedules fs ON t.flight_schedule_id = fs.flight_schedule_id
        LEFT JOIN Flights f ON fs.flight_id = f.flight_id
        LEFT JOIN Airline al ON f.airline_id = al.airline_id
        LEFT JOIN Cargo c ON pay.cargo_id = c.cargo_id
        WHERE pay.payment_id = ?`,
        [paymentId]
      );

      return { kind: 'ok' as const, payment: (updatedRows as any[])[0] };
    });

    if (result.kind === 'not_found') return notFoundResponse('Payment not found');
    if (result.kind === 'error') return errorResponse(result.message, result.status);

    return successResponse(result.payment, 'Payment updated successfully');
  } catch (error: any) {
    console.error('Update payment error:', error);
    return errorResponse('Failed to update payment: ' + error.message, 500);
  }
});

// ========== DELETE /api/payments/[id] - Delete/Refund payment ==========
export const DELETE = requireAuth(async (req: AuthenticatedRequest) => {
  try {
    const user = req.user!;
    const paymentId = parseInt((req as any).nextUrl?.pathname?.split('/').pop() ?? '', 10);
    if (Number.isNaN(paymentId)) return errorResponse('Invalid payment ID', 400);

    // Only Staff/Admin can delete payments
    if (!isPrivileged(user)) {
      return errorResponse('Access denied', 403);
    }

    const result = await withTransaction(async (conn) => {
      const [rows] = await conn.execute(
        `SELECT payment_id, payment_status
         FROM Payments
         WHERE payment_id = ?
         FOR UPDATE`,
        [paymentId]
      );

      const existing = (rows as any[])[0];
      if (!existing) return { kind: 'not_found' as const };

      // Only allow deletion of Pending or Failed payments
      if (existing.payment_status === 'Completed') {
        return {
          kind: 'error' as const,
          status: 400,
          message: 'Cannot delete completed payment. Use PUT to mark as Failed for refund.',
        };
      }

      await conn.execute('DELETE FROM Payments WHERE payment_id = ?', [paymentId]);

      return { kind: 'ok' as const };
    });

    if (result.kind === 'not_found') return notFoundResponse('Payment not found');
    if (result.kind === 'error') return errorResponse(result.message, result.status);

    return noContentResponse();
  } catch (error: any) {
    console.error('Delete payment error:', error);
    return errorResponse('Failed to delete payment: ' + error.message, 500);
  }
});