export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { query, queryOne } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  noContentResponse,
  validationErrorResponse,
} from '@/lib/response';
import { privateAircraftUpdateSchema, validateData } from '@/lib/validations';

type Ctx = { params: { id: string } };

// ---- GET ----
const getHandler = (ctx: Ctx) =>
  async (req: AuthenticatedRequest) => {
    try {
      const user = req.user!;
      const id = parseInt(ctx.params.id, 10);

      if (Number.isNaN(id)) {
        return errorResponse('Invalid private aircraft ID', 400);
      }

      const aircraft = await queryOne<any>(
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
        WHERE pa.private_aircraft_id = ? AND pa.user_id = ?
        `,
        [id, user.user_id]
      );

      if (!aircraft) {
        return notFoundResponse('Private aircraft not found');
      }

      return successResponse(aircraft, 'Private aircraft retrieved successfully');
    } catch (error: any) {
      console.error('Get private aircraft by id error:', error);
      return errorResponse('Failed to retrieve private aircraft: ' + error.message, 500);
    }
  };

export async function GET(req: NextRequest, ctx: Ctx) {
  return requireAuth(getHandler(ctx))(req as any);
}

// ---- PUT ----
const putHandler = (ctx: Ctx) =>
  async (req: AuthenticatedRequest) => {
    try {
      const user = req.user!;
      const id = parseInt(ctx.params.id, 10);

      if (Number.isNaN(id)) {
        return errorResponse('Invalid private aircraft ID', 400);
      }

      const existing = await queryOne<any>(
        `SELECT * FROM private_aircraft WHERE private_aircraft_id = ? AND user_id = ?`,
        [id, user.user_id]
      );

      if (!existing) {
        return notFoundResponse('Private aircraft not found');
      }

      const body = await req.json();
      const validation = validateData(privateAircraftUpdateSchema, body);
      if (!validation.success) {
        return validationErrorResponse(validation.errors);
      }

      const updateData = validation.data!;

      const updates: string[] = [];
      const values: any[] = [];

      if (updateData.registration_number !== undefined) {
        if (updateData.registration_number !== existing.registration_number) {
          const dupe = await queryOne(
            `
            SELECT private_aircraft_id
            FROM private_aircraft
            WHERE registration_number = ? AND private_aircraft_id != ?
            `,
            [updateData.registration_number, id]
          );
          if (dupe) {
            return errorResponse(
              'Private aircraft with this registration_number already exists',
              409
            );
          }
        }

        updates.push('registration_number = ?');
        values.push(updateData.registration_number);
      }

      if (updateData.model_name !== undefined) {
        updates.push('model_name = ?');
        values.push(updateData.model_name);
      }
      if (updateData.manufacturer !== undefined) {
        updates.push('manufacturer = ?');
        values.push(updateData.manufacturer);
      }
      if (updateData.seat_capacity !== undefined) {
        updates.push('seat_capacity = ?');
        values.push(updateData.seat_capacity);
      }
      if (updateData.status !== undefined) {
        updates.push('status = ?');
        values.push(updateData.status);
      }

      if (updates.length === 0) {
        return errorResponse('No fields to update', 400);
      }

      values.push(id, user.user_id);

      await query(
        `UPDATE private_aircraft SET ${updates.join(', ')} WHERE private_aircraft_id = ? AND user_id = ?`,
        values
      );

      const updated = await queryOne<any>(
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
        WHERE pa.private_aircraft_id = ? AND pa.user_id = ?
        `,
        [id, user.user_id]
      );

      return successResponse(updated, 'Private aircraft updated successfully');
    } catch (error: any) {
      console.error('Update private aircraft error:', error);
      return errorResponse('Failed to update private aircraft: ' + error.message, 500);
    }
  };

export async function PUT(req: NextRequest, ctx: Ctx) {
  return requireAuth(putHandler(ctx))(req as any);
}

// ---- DELETE ----
const deleteHandler = (ctx: Ctx) =>
  async (req: AuthenticatedRequest) => {
    try {
      const user = req.user!;
      const id = parseInt(ctx.params.id, 10);

      if (Number.isNaN(id)) {
        return errorResponse('Invalid private aircraft ID', 400);
      }

      const existing = await queryOne<any>(
        `SELECT private_aircraft_id FROM private_aircraft WHERE private_aircraft_id = ? AND user_id = ?`,
        [id, user.user_id]
      );

      if (!existing) {
        return notFoundResponse('Private aircraft not found');
      }

      await query(
        `DELETE FROM private_aircraft WHERE private_aircraft_id = ? AND user_id = ?`,
        [id, user.user_id]
      );

      return noContentResponse();
    } catch (error: any) {
      console.error('Delete private aircraft error:', error);
      return errorResponse('Failed to delete private aircraft: ' + error.message, 500);
    }
  };

export async function DELETE(req: NextRequest, ctx: Ctx) {
  return requireAuth(deleteHandler(ctx))(req as any);
}