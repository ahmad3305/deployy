export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { taskAssignmentCreateSchema, validateData } from '@/lib/validations';
import { requireStaff, AuthenticatedRequest } from '@/lib/auth-middleware';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

async function getHandler(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const task_id = searchParams.get('task_id');
    const staff_id = searchParams.get('staff_id');
    const assignment_status = searchParams.get('assignment_status');

    let sql = `
      SELECT 
        ta.*,
        t.task_type,
        t.required_role,
        t.start_time as task_start_time,
        t.end_time as task_end_time,
        t.task_status,
        s.first_name as staff_first_name,
        s.last_name as staff_last_name,
        s.role as staff_role,
        s.staff_type,
        f.flight_number,
        fs.departure_datetime,
        al.airline_name
      FROM Task_Assignments ta
      LEFT JOIN Tasks t ON ta.task_id = t.task_id
      LEFT JOIN Staff s ON ta.staff_id = s.staff_id
      LEFT JOIN Flight_Schedule fs ON t.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (task_id) {
      sql += ' AND ta.task_id = ?';
      params.push(parseInt(task_id));
    }

    if (staff_id) {
      sql += ' AND ta.staff_id = ?';
      params.push(parseInt(staff_id));
    }

    if (assignment_status) {
      sql += ' AND ta.assignment_status = ?';
      params.push(assignment_status);
    }

    sql += ' ORDER BY ta.assignment_time DESC';

    const assignments = await query(sql, params);

    return successResponse(assignments, 'Task assignments retrieved successfully');
  } catch (error: any) {
    console.error('Get task assignments error:', error);
    return errorResponse('Failed to retrieve task assignments: ' + error.message, 500);
  }
}

export const GET = requireStaff(getHandler);

async function postHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json();

    const validation = validateData(taskAssignmentCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data!;

    const task = await queryOne<any>(
      'SELECT * FROM Tasks WHERE task_id = ?',
      [data.task_id]
    );

    if (!task) {
      return errorResponse('Task not found', 404);
    }

    const staff = await queryOne<any>(
      'SELECT * FROM Staff WHERE staff_id = ?',
      [data.staff_id]
    );

    if (!staff) {
      return errorResponse('Staff not found', 404);
    }

    if (staff.status !== 'Active') {
      return errorResponse('Staff member is not active', 400);
    }

    const existingAssignment = await queryOne(
      'SELECT assignment_id FROM Task_Assignments WHERE task_id = ? AND staff_id = ? AND assignment_status != ?',
      [data.task_id, data.staff_id, 'Cancelled']
    );

    if (existingAssignment) {
      return errorResponse('Staff member is already assigned to this task', 409);
    }

    const conflicting = await queryOne(
      `SELECT ta.assignment_id 
       FROM Task_Assignments ta
       JOIN Tasks t ON ta.task_id = t.task_id
       WHERE ta.staff_id = ?
       AND ta.assignment_status = 'Assigned'
       AND (
         (t.start_time <= ? AND t.end_time > ?) 
         OR (t.start_time < ? AND t.end_time >= ?)
       )`,
      [data.staff_id, task.start_time, task.start_time, task.end_time, task.end_time]
    );

    if (conflicting) {
      return errorResponse('Staff member has a conflicting assignment at this time', 409);
    }

    const result = await query<any>(
      `INSERT INTO Task_Assignments (
        task_id, staff_id, assignment_time, assignment_status, end_time
      ) VALUES (?, ?, NOW(), ?, ?)`,
      [
        data.task_id,
        data.staff_id,
        data.assignment_status || 'Assigned',
        data.end_time || null
      ]
    );

    if (task.task_status === 'Pending') {
      await query(
        'UPDATE Tasks SET task_status = ? WHERE task_id = ?',
        ['Assigned', data.task_id]
      );
    }

    const newAssignment = await queryOne(
      `SELECT ta.*, t.task_type, s.first_name, s.last_name, s.role as staff_role
       FROM Task_Assignments ta
       LEFT JOIN Tasks t ON ta.task_id = t.task_id
       LEFT JOIN Staff s ON ta.staff_id = s.staff_id
       WHERE ta.assignment_id = ?`,
      [result.insertId]
    );

    return createdResponse(newAssignment, 'Task assigned successfully');
  } catch (error: any) {
    console.error('Create task assignment error:', error);
    return errorResponse('Failed to create task assignment: ' + error.message, 500);
  }
}

export const POST = requireStaff(postHandler);