export const runtime = 'nodejs';

import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { withTransaction } from '@/lib/db';
import { createdResponse, errorResponse, validationErrorResponse } from '@/lib/response';
import { privateRunwayBookingCreateSchema, validateData } from '@/lib/validations';

async function handler(req: AuthenticatedRequest) {
  try {
    const user = req.user!;

    const body = await req.json();
    const validation = validateData(privateRunwayBookingCreateSchema, body);

    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const { private_aircraft_id, runway_id, booking_date, start_time, end_time } =
      validation.data!;

    if (start_time >= end_time) {
      return errorResponse('start_time must be before end_time', 400);
    }

    const result = await withTransaction(async (connection) => {
      // 1) Ensure private aircraft belongs to logged-in user
      const [aircraftRows] = await connection.query<any[]>(
        `
        SELECT private_aircraft_id, user_id, registration_number, status
        FROM private_aircraft
        WHERE private_aircraft_id = ?
        `,
        [private_aircraft_id]
      );
      const aircraft = aircraftRows?.[0];

      if (!aircraft) {
        return { ok: false as const, code: 404, message: 'Private aircraft not found' };
      }
      if (aircraft.user_id !== user.user_id) {
        return { ok: false as const, code: 403, message: 'You do not own this private aircraft' };
      }
      if (aircraft.status && aircraft.status !== 'Active') {
        return { ok: false as const, code: 400, message: 'Private aircraft is not Active' };
      }

      // 2) Lock runway row to prevent race-condition bookings per runway
      const [runwayRows] = await connection.query<any[]>(
        `
        SELECT runway_id, runway_code, status
        FROM Runways
        WHERE runway_id = ?
        FOR UPDATE
        `,
        [runway_id]
      );
      const runway = runwayRows?.[0];

      if (!runway) {
        return { ok: false as const, code: 404, message: 'Runway not found' };
      }
      if (runway.status !== 'active') {
        return { ok: false as const, code: 400, message: 'Runway is not active' };
      }

      // 3) Overlap check (Reserved/Approved block)
      const [overlapRows] = await connection.query<any[]>(
        `
        SELECT booking_id
        FROM Runway_bookings
        WHERE runway_id = ?
          AND booking_date = ?
          AND booking_status IN ('Reserved', 'Approved')
          AND (? < end_time AND ? > start_time)
        LIMIT 1
        `,
        [runway_id, booking_date, start_time, end_time]
      );

      if (overlapRows && overlapRows.length > 0) {
        return {
          ok: false as const,
          code: 409,
          message: 'Selected runway is not available for the selected time slot',
        };
      }

      // 4) Insert booking
      const [insertResult] = await connection.query<any>(
        `
        INSERT INTO Runway_bookings (
          runway_id,
          aircraft_id,
          private_aircraft_id,
          booking_date,
          start_time,
          end_time,
          booking_status
        ) VALUES (?, NULL, ?, ?, ?, ?, 'Reserved')
        `,
        [runway_id, private_aircraft_id, booking_date, start_time, end_time]
      );

      const bookingId = insertResult.insertId;

      // 5) Return created booking
      const [bookingRows] = await connection.query<any[]>(
        `
        SELECT
          rb.*,
          r.runway_code,
          pa.registration_number
        FROM Runway_bookings rb
        JOIN Runways r ON rb.runway_id = r.runway_id
        LEFT JOIN private_aircraft pa ON rb.private_aircraft_id = pa.private_aircraft_id
        WHERE rb.booking_id = ?
        `,
        [bookingId]
      );

      return { ok: true as const, booking: bookingRows?.[0] };
    });

    if (!result.ok) {
      return errorResponse(result.message, result.code);
    }

    return createdResponse(result.booking, 'Runway booked successfully');
  } catch (error: any) {
    console.error('Private runway booking error:', error);
    return errorResponse('Failed to book runway: ' + error.message, 500);
  }
}

export const POST = requireAuth(handler);