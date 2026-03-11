export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { staffCreateSchema, validateData } from '@/lib/validations';
import { requireStaff, requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';

// ========== GET /api/staff - Get all staff (Staff+ only) ==========
async function getHandler(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const airport_id = searchParams.get('airport_id');
    const role = searchParams.get('role');
    const staff_type = searchParams.get('staff_type');
    const status = searchParams.get('status');

    let sql = `
      SELECT 
        s.*,
        a.airport_name,
        a.airport_code,
        (SELECT COUNT(*) FROM Shifts sh WHERE sh.staff_id = s.staff_id) as total_shifts
      FROM Staff s
      LEFT JOIN Airport a ON s.airport_id = a.airport_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (airport_id) {
      sql += ' AND s.airport_id = ?';
      params.push(parseInt(airport_id));
    }

    if (role) {
      sql += ' AND s.role = ?';
      params.push(role);
    }

    if (staff_type) {
      sql += ' AND s.staff_type = ?';
      params.push(staff_type);
    }

    if (status) {
      sql += ' AND s.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY s.created_at DESC';

    const staff = await query(sql, params);

    return successResponse(staff, 'Staff retrieved successfully');
  } catch (error: any) {
    console.error('Get staff error:', error);
    return errorResponse('Failed to retrieve staff: ' + error.message, 500);
  }
}

export const GET = requireStaff(getHandler);

// ========== POST /api/staff - Create new staff (Admin only) ==========
async function postHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json();

    const validation = validateData(staffCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data!;

    // Verify airport exists
    const airport = await queryOne(
      'SELECT airport_id FROM Airport WHERE airport_id = ?',
      [data.airport_id]
    );

    if (!airport) {
      return errorResponse('Airport not found', 404);
    }

    // Create staff
    const result = await query<any>(
      `INSERT INTO Staff (
        airport_id, first_name, last_name, role, staff_type,
        hire_date, license_number, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.airport_id,
        data.first_name,
        data.last_name,
        data.role,
        data.staff_type,
        data.hire_date || new Date().toISOString().split('T')[0],
        data.license_number || null,
        data.status || 'Active'
      ]
    );

    const newStaff = await queryOne(
      `SELECT s.*, a.airport_name 
       FROM Staff s 
       LEFT JOIN Airport a ON s.airport_id = a.airport_id 
       WHERE s.staff_id = ?`,
      [result.insertId]
    );

    return createdResponse(newStaff, 'Staff created successfully');
  } catch (error: any) {
    console.error('Create staff error:', error);
    return errorResponse('Failed to create staff: ' + error.message, 500);
  }
}

export const POST = requireAdmin(postHandler);