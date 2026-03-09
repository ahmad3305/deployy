import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { paymentUpdateSchema, validateData } from '@/lib/validations';

// ========== GET /api/payments/[id] - Get single payment ==========
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const paymentId = parseInt(params.id);

    if (isNaN(paymentId)) {
      return errorResponse('Invalid payment ID', 400);
    }

    const payment = await queryOne(
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
      LEFT JOIN Flight_Schedule fs ON t.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      LEFT JOIN Cargo c ON pay.cargo_id = c.cargo_id
      WHERE pay.payment_id = ?`,
      [paymentId]
    );

    if (!payment) {
      return notFoundResponse('Payment not found');
    }

    return successResponse(payment, 'Payment retrieved successfully');
  } catch (error: any) {
    console.error('Get payment error:', error);
    return errorResponse('Failed to retrieve payment: ' + error.message, 500);
  }
}

// ========== PUT /api/payments/[id] - Update payment ==========
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const paymentId = parseInt(params.id);

    if (isNaN(paymentId)) {
      return errorResponse('Invalid payment ID', 400);
    }

    // Check if payment exists
    const existing = await queryOne<any>(
      'SELECT * FROM Payments WHERE payment_id = ?',
      [paymentId]
    );

    if (!existing) {
      return notFoundResponse('Payment not found');
    }

    const body = await request.json();

    // Validate input
    const validation = validateData(paymentUpdateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const updateData = validation.data!;

    // Prevent updates to completed payments (except status changes to Failed)
    if (existing.payment_status === 'Completed') {
      if (updateData.payment_status && updateData.payment_status !== 'Failed') {
        return errorResponse('Completed payments can only be marked as Failed (for refunds)', 400);
      }
      if (Object.keys(updateData).some(key => key !== 'payment_status')) {
        return errorResponse('Cannot update completed payment details (except status)', 400);
      }
    }

    // Validate amount if being updated
    if (updateData.amount !== undefined && updateData.amount <= 0) {
      return errorResponse('Payment amount must be greater than 0', 400);
    }

    // If changing status to Completed, update related entities
    if (updateData.payment_status === 'Completed' && existing.payment_status !== 'Completed') {
      if (existing.ticket_id) {
        await query(
          'UPDATE Tickets SET status = ? WHERE ticket_id = ?',
          ['Confirmed', existing.ticket_id]
        );
      }
      if (existing.cargo_id) {
        await query(
          'UPDATE Cargo SET status = ? WHERE cargo_id = ? AND status = ?',
          ['Booked', existing.cargo_id, 'Booked']
        );
      }
    }

    // If changing status to Failed, handle refund logic
    if (updateData.payment_status === 'Failed' && existing.payment_status === 'Completed') {
      if (existing.ticket_id) {
        // Check if ticket hasn't been used yet
        const ticket = await queryOne<any>(
          'SELECT status FROM Tickets WHERE ticket_id = ?',
          [existing.ticket_id]
        );

        if (ticket && ticket.status === 'Boarded') {
          return errorResponse('Cannot refund payment for boarded ticket', 400);
        }

        // Update ticket status back to Cancelled for refund
        await query(
          'UPDATE Tickets SET status = ? WHERE ticket_id = ?',
          ['Cancelled', existing.ticket_id]
        );
      }

      if (existing.cargo_id) {
        // Check if cargo hasn't been delivered
        const cargo = await queryOne<any>(
          'SELECT status FROM Cargo WHERE cargo_id = ?',
          [existing.cargo_id]
        );

        if (cargo && cargo.status === 'Delivered') {
          return errorResponse('Cannot refund payment for delivered cargo', 400);
        }
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.amount !== undefined) {
      updates.push('amount = ?');
      values.push(updateData.amount);
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
      return errorResponse('No fields to update', 400);
    }

    values.push(paymentId);

    await query(
      `UPDATE Payments SET ${updates.join(', ')} WHERE payment_id = ?`,
      values
    );

    // Fetch updated payment with joined data
    const updatedPayment = await queryOne(
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
      LEFT JOIN Flight_Schedule fs ON t.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Cargo c ON pay.cargo_id = c.cargo_id
      WHERE pay.payment_id = ?`,
      [paymentId]
    );

    return successResponse(updatedPayment, 'Payment updated successfully');
  } catch (error: any) {
    console.error('Update payment error:', error);
    return errorResponse('Failed to update payment: ' + error.message, 500);
  }
}

// ========== DELETE /api/payments/[id] - Delete/Refund payment ==========
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const paymentId = parseInt(params.id);

    if (isNaN(paymentId)) {
      return errorResponse('Invalid payment ID', 400);
    }

    // Check if payment exists
    const existing = await queryOne<any>(
      'SELECT * FROM Payments WHERE payment_id = ?',
      [paymentId]
    );

    if (!existing) {
      return notFoundResponse('Payment not found');
    }

    // Only allow deletion of Pending or Failed payments
    if (existing.payment_status === 'Completed') {
      return errorResponse('Cannot delete completed payment. Use PUT to mark as Failed for refund.', 400);
    }

    // Delete payment
    await query('DELETE FROM Payments WHERE payment_id = ?', [paymentId]);

    return noContentResponse();
  } catch (error: any) {
    console.error('Delete payment error:', error);
    return errorResponse('Failed to delete payment: ' + error.message, 500);
  }
}