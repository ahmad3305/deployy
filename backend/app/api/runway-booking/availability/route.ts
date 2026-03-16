export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/response';
import { runwayAvailabilitySchema, validateData } from '@/lib/validations';

// GET /api/runway-bookings/availability?airport_id=1&booking_date=YYYY-MM-DD&start_time=HH:MM:SS&end_time=HH:MM:SS
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const raw = {
      airport_id: searchParams.get('airport_id')
        ? parseInt(searchParams.get('airport_id')!, 10)
        : undefined,
      booking_date: searchParams.get('booking_date') ?? undefined,
      start_time: searchParams.get('start_time') ?? undefined,
      end_time: searchParams.get('end_time') ?? undefined,
    };

    const validation = validateData(runwayAvailabilitySchema, raw);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const { airport_id, booking_date, start_time, end_time } = validation.data!;

    if (start_time >= end_time) {
      return errorResponse('start_time must be before end_time', 400);
    }

    // Overlap: newStart < existingEnd AND newEnd > existingStart
    const availableRunways = await query(
      `
      SELECT
        r.runway_id,
        r.airport_id,
        r.runway_code,
        r.length,
        r.status
      FROM Runways r
      WHERE r.airport_id = ?
        AND r.status = 'active'
        AND NOT EXISTS (
          SELECT 1
          FROM Runway_bookings rb
          WHERE rb.runway_id = r.runway_id
            AND rb.booking_date = ?
            AND rb.booking_status IN ('Reserved', 'Approved')
            AND (? < rb.end_time AND ? > rb.start_time)
        )
      ORDER BY r.runway_code ASC
      `,
      [airport_id, booking_date, start_time, end_time]
    );

    if (!availableRunways || availableRunways.length === 0) {
      return successResponse(false, 'No runway available for the selected time slot');
    }

    return successResponse(availableRunways, 'Available runways retrieved successfully');
  } catch (error: any) {
    console.error('Runway availability error:', error);
    return errorResponse('Failed to check runway availability: ' + error.message, 500);
  }
}