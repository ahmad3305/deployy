export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { queryOne } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/response';
import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

async function getHandler(req: AuthenticatedRequest) {
  try {
    const user = req.user!;
    
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop();

    if (!id || isNaN(Number(id))) {
      return errorResponse('Valid Booking ID is required', 400);
    }

    const booking = await queryOne<any>(
      `
      SELECT
        rb.booking_id,
        rb.runway_id,
        rb.aircraft_id,
        rb.private_aircraft_id,
        rb.booking_date,
        rb.start_time,
        rb.end_time,
        rb.booking_status,
        rb.created_at,
        r.runway_code,
        r.runway_id,
        r.length,
        r.status as runway_status,
        ap.airport_name,
        ap.airport_code,
        ap.city,
        ap.country,
        pa.registration_number,
        pa.model_name,
        pa.manufacturer,
        pa.status as aircraft_status
      FROM Runway_bookings rb
      JOIN Runways r ON rb.runway_id = r.runway_id
      JOIN Airport ap ON r.airport_id = ap.airport_id
      LEFT JOIN private_aircraft pa ON rb.private_aircraft_id = pa.private_aircraft_id
      WHERE rb.booking_id = ?
      `,
      [Number(id)]
    );

    if (!booking) {
      return errorResponse('Runway booking not found', 404);
    }

    // Verify ownership
    if (booking.private_aircraft_id) {
      const aircraft = await queryOne<any>(
        `SELECT user_id FROM private_aircraft WHERE private_aircraft_id = ?`,
        [booking.private_aircraft_id]
      );

      if (aircraft?.user_id !== user.user_id) {
        return errorResponse('Unauthorized', 403);
      }
    }

    return successResponse(booking, 'Runway booking details retrieved successfully');
  } catch (error: any) {
    console.error('Get runway booking error:', error);
    return errorResponse('Failed to retrieve runway booking: ' + error.message, 500);
  }
}

export const GET = requireAuth(getHandler);