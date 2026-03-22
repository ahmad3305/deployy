export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { taskUpdateSchema, validateData } from '@/lib/validations';
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

    if (!user) {
      return errorResponse('Invalid or expired token', 401);
    }

    if (user.role !== 'Admin' && user.role !== 'Staff') {
      return errorResponse('Access denied. Staff or Admin role required.', 403);
    }

    const taskId = parseInt(params.id);

    if (isNaN(taskId)) {
      return errorResponse('Invalid task ID', 400);
    }

    const task = await queryOne(
      `SELECT 
        t.*,
        fs.departure_datetime,
        fs.arrival_datetime,
        fs.flight_status,
        f.flight_number,
        al.airline_name,
        src.airport_name as source_airport,
        dest.airport_name as destination_airport,
        (SELECT COUNT(*) FROM Task_Assignments ta WHERE ta.task_id = t.task_id) as assignments_count,
        (SELECT COUNT(*) FROM Task_Assignments ta WHERE ta.task_id = t.task_id AND ta.assignment_status = 'Completed') as completed_count
      FROM Tasks t
      LEFT JOIN Flight_Schedule fs ON t.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE t.task_id = ?`,
      [taskId]
    );

    if (!task) {
      return notFoundResponse('Task not found');
    }

    return successResponse(task, 'Task retrieved successfully');
  } catch (error: any) {
    console.error('Get task error:', error);
    return errorResponse('Failed to retrieve task: ' + error.message, 500);
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

    if (!user) {
      return errorResponse('Invalid or expired token', 401);
    }

    if (user.role !== 'Admin' && user.role !== 'Staff') {
      return errorResponse('Access denied. Staff or Admin role required.', 403);
    }

    const taskId = parseInt(params.id);

    if (isNaN(taskId)) {
      return errorResponse('Invalid task ID', 400);
    }

    const existing = await queryOne<any>(
      'SELECT * FROM Tasks WHERE task_id = ?',
      [taskId]
    );

    if (!existing) {
      return notFoundResponse('Task not found');
    }

    const body = await request.json();

    const validation = validateData(taskUpdateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const updateData = validation.data!;

    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.task_type !== undefined) {
      updates.push('task_type = ?');
      values.push(updateData.task_type);
    }
    if (updateData.required_role !== undefined) {
      updates.push('required_role = ?');
      values.push(updateData.required_role);
    }
    if (updateData.start_time !== undefined) {
      updates.push('start_time = ?');
      values.push(updateData.start_time);
    }
    if (updateData.end_time !== undefined) {
      updates.push('end_time = ?');
      values.push(updateData.end_time);
    }
    if (updateData.task_status !== undefined) {
      updates.push('task_status = ?');
      values.push(updateData.task_status);
    }

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    if (updateData.start_time && updateData.end_time) {
      const startTime = new Date(updateData.start_time);
      const endTime = new Date(updateData.end_time);
      if (endTime <= startTime) {
        return errorResponse('End time must be after start time', 400);
      }
    }

    values.push(taskId);

    await query(
      `UPDATE Tasks SET ${updates.join(', ')} WHERE task_id = ?`,
      values
    );

    const updatedTask = await queryOne(
      'SELECT * FROM Tasks WHERE task_id = ?',
      [taskId]
    );

    return successResponse(updatedTask, 'Task updated successfully');
  } catch (error: any) {
    console.error('Update task error:', error);
    return errorResponse('Failed to update task: ' + error.message, 500);
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

    if (!user) {
      return errorResponse('Invalid or expired token', 401);
    }

    if (user.role !== 'Admin') {
      return errorResponse('Access denied. Admin role required.', 403);
    }

    const taskId = parseInt(params.id);

    if (isNaN(taskId)) {
      return errorResponse('Invalid task ID', 400);
    }

    const existing = await queryOne(
      'SELECT * FROM Tasks WHERE task_id = ?',
      [taskId]
    );

    if (!existing) {
      return notFoundResponse('Task not found');
    }

    const assignments = await queryOne(
      'SELECT COUNT(*) as count FROM Task_Assignments WHERE task_id = ?',
      [taskId]
    );

    if (assignments && (assignments as any).count > 0) {
      return errorResponse('Cannot delete task with existing assignments. Delete assignments first.', 409);
    }

    await query('DELETE FROM Tasks WHERE task_id = ?', [taskId]);

    return noContentResponse();
  } catch (error: any) {
    console.error('Delete task error:', error);
    return errorResponse('Failed to delete task: ' + error.message, 500);
  }
}