export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { shiftCreateSchema, validateData } from '@/lib/validations';
import { requireAdmin, requireStaff, AuthenticatedRequest } from '@/lib/auth-middleware';
import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

async function getHandler(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const staff_id = searchParams.get("staff_id");
    const date = searchParams.get("shift_date");
    const status = searchParams.get("availability_status");

    let sql = `
      SELECT 
        sh.*,
        st.first_name as staff_first_name,
        st.last_name as staff_last_name,
        st.role as staff_role,
        st.staff_type
      FROM Shifts sh
      LEFT JOIN Staff st ON sh.staff_id = st.staff_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (staff_id) {
      sql += ' AND sh.staff_id = ?';
      params.push(Number(staff_id));
    }
    if (date) {
      sql += ' AND sh.shift_date = ?';
      params.push(date);
    }
    if (status) {
      sql += ' AND sh.availability_status = ?';
      params.push(status);
    }
    sql += " ORDER BY sh.shift_date DESC, sh.shift_start DESC";

    const shifts = await query(sql, params);

    return successResponse(shifts, "Shifts retrieved successfully");
  } catch (error: any) {
    console.error("Get shifts error:", error);
    return errorResponse("Failed to retrieve shifts: " + error.message, 500);
  }
}

export const GET = requireStaff(getHandler);

async function postHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json();

    const validation = validateData(shiftCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }
    const data = validation.data!;

    const staff = await queryOne('SELECT * FROM Staff WHERE staff_id = ?', [data.staff_id]);
    if (!staff) return errorResponse('Staff not found', 404);
    if (staff.status !== 'Active') return errorResponse('Staff member is not active', 400);

    const overlap = await queryOne(
      `SELECT shift_id
       FROM Shifts
       WHERE staff_id = ?
         AND shift_date = ?
         AND (
           (? < shift_end AND ? > shift_start) -- new start < old end, new end > old start
         )`,
      [data.staff_id, data.shift_date, data.shift_start, data.shift_end]
    );
    if (overlap) return errorResponse('Shift overlaps existing shift for this staff member on same date', 409);

    const result = await query<any>(
      `INSERT INTO Shifts (staff_id, shift_date, shift_start, shift_end, availability_status)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.staff_id,
        data.shift_date,
        data.shift_start,
        data.shift_end,
        data.availability_status || "Available"
      ]
    );

    const newShift = await queryOne(
      `SELECT sh.*, st.first_name as staff_first_name, st.last_name as staff_last_name, st.role as staff_role, st.staff_type
       FROM Shifts sh
       LEFT JOIN Staff st ON sh.staff_id = st.staff_id
       WHERE sh.shift_id = ?`, [result.insertId]
    );

    return createdResponse(newShift, 'Shift created successfully');
  } catch (error: any) {
    console.error('Create shift error:', error);
    return errorResponse('Failed to create shift: ' + error.message, 500);
  }
}

export const POST = requireAdmin(postHandler);
