export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { taskCreateSchema, validateData } from '@/lib/validations';
import { requireStaff, AuthenticatedRequest } from '@/lib/auth-middleware';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

async function getHandler(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const flight_schedule_id = searchParams.get('flight_schedule_id');
    const task_type = searchParams.get('task_type');
    const task_status = searchParams.get('task_status');
    const required_role = searchParams.get('required_role');

    let sql = `
      SELECT 
        t.*,
        fs.departure_datetime,
        fs.arrival_datetime,
        fs.flight_status,
        f.flight_number,
        al.airline_name,
        src.airport_name as source_airport,
        dest.airport_name as destination_airport,
        (SELECT COUNT(*) FROM Task_Assignments ta WHERE ta.task_id = t.task_id) as assignments_count
      FROM Tasks t
      LEFT JOIN Flight_Schedule fs ON t.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (flight_schedule_id) {
      sql += ' AND t.flight_schedule_id = ?';
      params.push(parseInt(flight_schedule_id));
    }

    if (task_type) {
      sql += ' AND t.task_type = ?';
      params.push(task_type);
    }

    if (task_status) {
      sql += ' AND t.task_status = ?';
      params.push(task_status);
    }

    if (required_role) {
      sql += ' AND t.required_role = ?';
      params.push(required_role);
    }

    sql += ' ORDER BY t.start_time ASC';

    const tasks = await query(sql, params);

    return successResponse(tasks, 'Tasks retrieved successfully');
  } catch (error: any) {
    console.error('Get tasks error:', error);
    return errorResponse('Failed to retrieve tasks: ' + error.message, 500);
  }
}

export const GET = requireStaff(getHandler);

async function postHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json();

    const validation = validateData(taskCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data!;

    const schedule = await queryOne(
      'SELECT * FROM Flight_Schedule WHERE flight_schedule_id = ?',
      [data.flight_schedule_id]
    );

    if (!schedule) {
      return errorResponse('Flight schedule not found', 404);
    }

    const startTime = new Date(data.start_time);
    const endTime = new Date(data.end_time);

    if (endTime <= startTime) {
      return errorResponse('End time must be after start time', 400);
    }

    const result = await query<any>(
      `INSERT INTO Tasks (
        flight_schedule_id, task_type, required_role, 
        start_time, end_time, task_status
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.flight_schedule_id,
        data.task_type,
        data.required_role,
        data.start_time,
        data.end_time,
        data.task_status || 'Pending'
      ]
    );

    const newTask = await queryOne(
      `SELECT t.*, f.flight_number, fs.departure_datetime
       FROM Tasks t
       LEFT JOIN Flight_Schedule fs ON t.flight_schedule_id = fs.flight_schedule_id
       LEFT JOIN Flights f ON fs.flight_id = f.flight_id
       WHERE t.task_id = ?`,
      [result.insertId]
    );

    return createdResponse(newTask, 'Task created successfully');
  } catch (error: any) {
    console.error('Create task error:', error);
    return errorResponse('Failed to create task: ' + error.message, 500);
  }
}

export const POST = requireStaff(postHandler);