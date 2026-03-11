export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { staffUpdateSchema, validateData } from '@/lib/validations';
import { verifyToken } from '@/lib/auth';

// ========== GET /api/staff/[id] - Get single staff (Staff+) ==========
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse('Authentication required', 401);
    }

    const token = authHeader.substring(7);
    const user = verifyToken(token);

    if (!user) {
      return errorResponse('Invalid or expired token', 401);
    }

    if (user.role !== 'Admin' && user.role !== 'Staff') {
      return errorResponse('Access denied. Staff or Admin role required.', 403);
    }

    // Main logic
    const staffId = parseInt(params.id);

    if (isNaN(staffId)) {
      return errorResponse('Invalid staff ID', 400);
    }

    const staff = await queryOne(
      `SELECT 
        s.*,
        a.airport_name,
        a.airport_code,
        a.city,
        (SELECT COUNT(*) FROM Shifts sh WHERE sh.staff_id = s.staff_id) as total_shifts,
        (SELECT COUNT(*) FROM Task_Assignments ta WHERE ta.staff_id = s.staff_id) as total_tasks
      FROM Staff s
      LEFT JOIN Airport a ON s.airport_id = a.airport_id
      WHERE s.staff_id = ?`,
      [staffId]
    );

    if (!staff) {
      return notFoundResponse('Staff not found');
    }

    return successResponse(staff, 'Staff retrieved successfully');
  } catch (error: any) {
    console.error('Get staff error:', error);
    return errorResponse('Failed to retrieve staff: ' + error.message, 500);
  }
}

// ========== PUT /api/staff/[id] - Update staff (Admin only) ==========
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse('Authentication required', 401);
    }

    const token = authHeader.substring(7);
    const user = verifyToken(token);

    if (!user) {
      return errorResponse('Invalid or expired token', 401);
    }

    if (user.role !== 'Admin') {
      return errorResponse('Access denied. Admin role required.', 403);
    }

    // Main logic
    const staffId = parseInt(params.id);

    if (isNaN(staffId)) {
      return errorResponse('Invalid staff ID', 400);
    }

    const existing = await queryOne(
      'SELECT * FROM Staff WHERE staff_id = ?',
      [staffId]
    );

    if (!existing) {
      return notFoundResponse('Staff not found');
    }

    const body = await request.json();

    const validation = validateData(staffUpdateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const updateData = validation.data!;

    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.first_name !== undefined) {
      updates.push('first_name = ?');
      values.push(updateData.first_name);
    }
    if (updateData.last_name !== undefined) {
      updates.push('last_name = ?');
      values.push(updateData.last_name);
    }
    if (updateData.role !== undefined) {
      updates.push('role = ?');
      values.push(updateData.role);
    }
    if (updateData.staff_type !== undefined) {
      updates.push('staff_type = ?');
      values.push(updateData.staff_type);
    }
    if (updateData.license_number !== undefined) {
      updates.push('license_number = ?');
      values.push(updateData.license_number);
    }
    if (updateData.status !== undefined) {
      updates.push('status = ?');
      values.push(updateData.status);
    }

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    values.push(staffId);

    await query(
      `UPDATE Staff SET ${updates.join(', ')} WHERE staff_id = ?`,
      values
    );

    const updatedStaff = await queryOne(
      'SELECT * FROM Staff WHERE staff_id = ?',
      [staffId]
    );

    return successResponse(updatedStaff, 'Staff updated successfully');
  } catch (error: any) {
    console.error('Update staff error:', error);
    return errorResponse('Failed to update staff: ' + error.message, 500);
  }
}

// ========== DELETE /api/staff/[id] - Delete staff (Admin only) ==========
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse('Authentication required', 401);
    }

    const token = authHeader.substring(7);
    const user = verifyToken(token);

    if (!user) {
      return errorResponse('Invalid or expired token', 401);
    }

    if (user.role !== 'Admin') {
      return errorResponse('Access denied. Admin role required.', 403);
    }

    // Main logic
    const staffId = parseInt(params.id);

    if (isNaN(staffId)) {
      return errorResponse('Invalid staff ID', 400);
    }

    const existing = await queryOne(
      'SELECT * FROM Staff WHERE staff_id = ?',
      [staffId]
    );

    if (!existing) {
      return notFoundResponse('Staff not found');
    }

    await query('DELETE FROM Staff WHERE staff_id = ?', [staffId]);

    return noContentResponse();
  } catch (error: any) {
    console.error('Delete staff error:', error);
    return errorResponse('Failed to delete staff: ' + error.message, 500);
  }
}