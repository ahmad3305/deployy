export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { shiftCreateSchema, validateData } from '@/lib/validations';
import { verifyToken } from '@/lib/auth';
import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse('Authentication required', 401);
    }
    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user || (user.role !== 'Admin' && user.role !== 'Staff')) {
      return errorResponse('Access denied. Staff or Admin role required.', 403);
    }

    const shiftId = parseInt(params.id);
    if (isNaN(shiftId)) return errorResponse('Invalid shift ID', 400);

    const shift = await queryOne(
      `SELECT sh.*, 
              st.first_name as staff_first_name, 
              st.last_name as staff_last_name, 
              st.role as staff_role, 
              st.staff_type
         FROM Shifts sh
         LEFT JOIN Staff st ON sh.staff_id = st.staff_id
         WHERE sh.shift_id = ?`,
      [shiftId]
    );

    if (!shift) return notFoundResponse('Shift not found');
    return successResponse(shift, 'Shift retrieved successfully');
  } catch (error: any) {
    console.error('Get shift error:', error);
    return errorResponse('Failed to retrieve shift: ' + error.message, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse('Authentication required', 401);
    }
    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user || user.role !== 'Admin') {
      return errorResponse('Admin access required', 403);
    }

    const shiftId = parseInt(params.id);
    if (isNaN(shiftId)) return errorResponse('Invalid shift ID', 400);

    const existing = await queryOne('SELECT * FROM Shifts WHERE shift_id = ?', [shiftId]);
    if (!existing) return notFoundResponse('Shift not found');

    const body = await request.json();
    const patch = { ...existing, ...body };
    const validation = validateData(shiftCreateSchema, patch);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }
    const data = validation.data!;

    const checkOverlap =
      data.staff_id !== existing.staff_id ||
      data.shift_date !== existing.shift_date ||
      data.shift_start !== existing.shift_start ||
      data.shift_end !== existing.shift_end;

    if (checkOverlap) {
      const overlap = await queryOne(
        `SELECT shift_id FROM Shifts
         WHERE staff_id = ?
           AND shift_date = ?
           AND shift_id != ?
           AND (? < shift_end AND ? > shift_start)`,
        [
          data.staff_id,
          data.shift_date,
          shiftId,
          data.shift_start,
          data.shift_end
        ]
      );
      if (overlap) return errorResponse('Shift overlaps existing shift for this staff member on same date', 409);
    }

    const updates: string[] = [];
    const values: any[] = [];
    if (data.staff_id !== undefined) {
      updates.push('staff_id = ?');
      values.push(data.staff_id);
    }
    if (data.shift_date !== undefined) {
      updates.push('shift_date = ?');
      values.push(data.shift_date);
    }
    if (data.shift_start !== undefined) {
      updates.push('shift_start = ?');
      values.push(data.shift_start);
    }
    if (data.shift_end !== undefined) {
      updates.push('shift_end = ?');
      values.push(data.shift_end);
    }
    if (data.availability_status !== undefined) {
      updates.push('availability_status = ?');
      values.push(data.availability_status);
    }
    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }
    values.push(shiftId);

    await query(
      `UPDATE Shifts SET ${updates.join(', ')} WHERE shift_id = ?`,
      values
    );

    const updated = await queryOne(
      `SELECT sh.*, st.first_name as staff_first_name, st.last_name as staff_last_name, st.role as staff_role, st.staff_type
         FROM Shifts sh
         LEFT JOIN Staff st ON sh.staff_id = st.staff_id
         WHERE sh.shift_id = ?`,
      [shiftId]
    );

    return successResponse(updated, 'Shift updated successfully');
  } catch (error: any) {
    console.error('Update shift error:', error);
    return errorResponse('Failed to update shift: ' + error.message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse('Authentication required', 401);
    }
    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user || user.role !== 'Admin') {
      return errorResponse('Admin access required', 403);
    }

    const shiftId = parseInt(params.id);
    if (isNaN(shiftId)) return errorResponse('Invalid shift ID', 400);

    const existing = await queryOne('SELECT * FROM Shifts WHERE shift_id = ?', [shiftId]);
    if (!existing) return notFoundResponse('Shift not found');

    await query('DELETE FROM Shifts WHERE shift_id = ?', [shiftId]);

    return noContentResponse();
  } catch (error: any) {
    console.error('Delete shift error:', error);
    return errorResponse('Failed to delete shift: ' + error.message, 500);
  }
}
