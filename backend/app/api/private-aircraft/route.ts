export const runtime = 'nodejs';

import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { query, queryOne } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  createdResponse,
  validationErrorResponse,
} from '@/lib/response';
import { privateAircraftCreateSchema, validateData } from '@/lib/validations';

// ========== GET /api/private-aircraft - List my private aircraft ==========
async function getHandler(req: AuthenticatedRequest) {
  try {
    const user = req.user!;

    const aircraft = await query(
      `
      SELECT
        pa.private_aircraft_id,
        pa.user_id,
        pa.registration_number,
        pa.model_name,
        pa.manufacturer,
        pa.seat_capacity,
        pa.status,
        pa.created_at
      FROM private_aircraft pa
      WHERE pa.user_id = ?
      ORDER BY pa.created_at DESC
      `,
      [user.user_id]
    );

    return successResponse(aircraft, 'Private aircraft retrieved successfully');
  } catch (error: any) {
    console.error('Get private aircraft error:', error);
    return errorResponse('Failed to retrieve private aircraft: ' + error.message, 500);
  }
}

export const GET = requireAuth(getHandler);

// ========== POST /api/private-aircraft - Create private aircraft ==========
async function postHandler(req: AuthenticatedRequest) {
  try {
    const user = req.user!;
    const body = await req.json();

    const validation = validateData(privateAircraftCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data!;

    // prevent duplicates by registration_number (DB should also have UNIQUE)
    const existing = await queryOne(
      `SELECT private_aircraft_id FROM private_aircraft WHERE registration_number = ?`,
      [data.registration_number]
    );
    if (existing) {
      return errorResponse('Private aircraft with this registration_number already exists', 409);
    }

    const result = await query<any>(
      `
      INSERT INTO private_aircraft (
        user_id,
        registration_number,
        model_name,
        manufacturer,
        seat_capacity,
        status
      ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        user.user_id,
        data.registration_number,
        data.model_name ?? null,
        data.manufacturer ?? null,
        data.seat_capacity ?? null,
        data.status ?? 'Active',
      ]
    );

    const created = await queryOne(
      `
      SELECT
        pa.private_aircraft_id,
        pa.user_id,
        pa.registration_number,
        pa.model_name,
        pa.manufacturer,
        pa.seat_capacity,
        pa.status,
        pa.created_at
      FROM private_aircraft pa
      WHERE pa.private_aircraft_id = ?
      `,
      [result.insertId]
    );

    return createdResponse(created, 'Private aircraft created successfully');
  } catch (error: any) {
    console.error('Create private aircraft error:', error);
    return errorResponse('Failed to create private aircraft: ' + error.message, 500);
  }
}

export const POST = requireAuth(postHandler);