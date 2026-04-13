export const runtime = 'nodejs';

import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { query, withTransaction } from '@/lib/db';
import { successResponse, createdResponse, errorResponse, validationErrorResponse } from '@/lib/response';
import { privateRunwayBookingCreateSchema, validateData } from '@/lib/validations';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

async function getHandler(req: AuthenticatedRequest) {
  try {
    const user = req.user!;

    console.log('=== GET Runway Bookings ===');
    console.log('User ID:', user.user_id);
    console.log('User email:', user.email);

    // First, check if there are any private aircraft for this user
    const aircraftQuery = `
      SELECT private_aircraft_id, user_id, registration_number
      FROM private_aircraft
      WHERE user_id = ?
    `;
    
    console.log('Checking for private aircraft...');
    const aircraft = await query(aircraftQuery, [user.user_id]);
    console.log('Aircraft found:', aircraft.length);
    console.log('Aircraft data:', aircraft);

    if (aircraft.length === 0) {
      console.log('No aircraft found for user');
      return successResponse([], 'No private aircraft found for this user');
    }

    // Get all runway bookings for this user's private aircraft
    const bookingsQuery = `
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
        r.airport_id,
        pa.registration_number,
        pa.model_name,
        pa.manufacturer,
        pa.status as aircraft_status
      FROM Runway_bookings rb
      JOIN Runways r ON rb.runway_id = r.runway_id
      LEFT JOIN private_aircraft pa ON rb.private_aircraft_id = pa.private_aircraft_id
      WHERE pa.user_id = ?
      ORDER BY rb.booking_date DESC, rb.start_time DESC
    `;

    console.log('Fetching runway bookings with query...');
    const bookings = await query(bookingsQuery, [user.user_id]);

    console.log(`Retrieved ${bookings.length} runway bookings for user ${user.user_id}`);
    console.log('Bookings:', bookings);

    return successResponse(bookings, 'Runway bookings retrieved successfully');
  } catch (error: any) {
    console.error('Get runway bookings error:', error);
    console.error('Error stack:', error.stack);
    return errorResponse('Failed to retrieve runway bookings: ' + error.message, 500);
  }
}

export const GET = requireAuth(getHandler);

async function postHandler(req: AuthenticatedRequest) {
  try {
    const user = req.user!;

    console.log('=== POST Create Runway Booking ===');
    console.log('User ID:', user.user_id);

    const body = await req.json();
    console.log('Request body:', body);

    const validation = validateData(privateRunwayBookingCreateSchema, body);

    if (!validation.success) {
      console.log('Validation failed:', validation.errors);
      return validationErrorResponse(validation.errors);
    }

    const { private_aircraft_id, runway_id, booking_date, start_time, end_time } =
      validation.data!;

    if (start_time >= end_time) {
      return errorResponse('start_time must be before end_time', 400);
    }

    const result = await withTransaction(async (connection) => {
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
        console.log('Aircraft not found:', private_aircraft_id);
        return { ok: false as const, code: 404, message: 'Private aircraft not found' };
      }
      
      console.log('Aircraft found:', aircraft);
      
      if (aircraft.user_id !== user.user_id) {
        console.log('Aircraft ownership mismatch. Aircraft user:', aircraft.user_id, 'Request user:', user.user_id);
        return { ok: false as const, code: 403, message: 'You do not own this private aircraft' };
      }
      
      if (aircraft.status && aircraft.status !== 'Active') {
        console.log('Aircraft not active:', aircraft.status);
        return { ok: false as const, code: 400, message: 'Private aircraft is not Active' };
      }

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
        console.log('Runway not found:', runway_id);
        return { ok: false as const, code: 404, message: 'Runway not found' };
      }
      
      console.log('Runway found:', runway);
      
      if (runway.status !== 'active') {
        console.log('Runway not active:', runway.status);
        return { ok: false as const, code: 400, message: 'Runway is not active' };
      }

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
        console.log('Booking conflict found');
        return {
          ok: false as const,
          code: 409,
          message: 'Selected runway is not available for the selected time slot',
        };
      }

      console.log('No conflicts. Creating booking...');

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
      console.log('Booking created with ID:', bookingId);

      const [bookingRows] = await connection.query<any[]>(
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
          r.airport_id,
          pa.registration_number,
          pa.model_name,
          pa.manufacturer
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

    console.log('Runway booked successfully:', result.booking.booking_id);
    return createdResponse(result.booking, 'Runway booked successfully');
  } catch (error: any) {
    console.error('Private runway booking error:', error);
    console.error('Error stack:', error.stack);
    return errorResponse('Failed to book runway: ' + error.message, 500);
  }
}

export const POST = requireAuth(postHandler);