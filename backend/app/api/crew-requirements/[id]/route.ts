import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { crewRequirementUpdateSchema, validateData } from '@/lib/validations';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requirementId = parseInt(params.id);

    if (isNaN(requirementId)) {
      return errorResponse('Invalid requirement ID', 400);
    }

    const requirement = await queryOne(
      `SELECT 
        cr.*,
        fs.departure_datetime,
        fs.arrival_datetime,
        fs.flight_status,
        f.flight_number,
        f.flight_type,
        al.airline_name,
        al.airline_code,
        src.airport_name as source_airport_name,
        src.airport_code as source_airport_code,
        src.city as source_city,
        dest.airport_name as destination_airport_name,
        dest.airport_code as destination_airport_code,
        dest.city as destination_city,
        (SELECT COUNT(DISTINCT ta.staff_id) 
         FROM Task_Assignments ta
         JOIN Tasks t ON ta.task_id = t.task_id
         JOIN Staff s ON ta.staff_id = s.staff_id
         WHERE t.flight_schedule_id = cr.flight_schedule_id 
         AND s.role = cr.role_required
         AND ta.assignment_status != 'Cancelled') as assigned_count
      FROM Crew_requirements cr
      LEFT JOIN Flight_schedules fs ON cr.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE cr.requirement_id = ?`,
      [requirementId]
    );

    if (!requirement) {
      return notFoundResponse('Crew requirement not found');
    }

    return successResponse(requirement, 'Crew requirement retrieved successfully');
  } catch (error: any) {
    console.error('Get crew requirement error:', error);
    return errorResponse('Failed to retrieve crew requirement: ' + error.message, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requirementId = parseInt(params.id);

    if (isNaN(requirementId)) {
      return errorResponse('Invalid requirement ID', 400);
    }

    const existing = await queryOne<any>(
      `SELECT cr.*, fs.flight_status 
       FROM Crew_requirements cr
       LEFT JOIN Flight_schedules fs ON cr.flight_schedule_id = fs.flight_schedule_id
       WHERE cr.requirement_id = ?`,
      [requirementId]
    );

    if (!existing) {
      return notFoundResponse('Crew requirement not found');
    }

    if (existing.flight_status === 'Completed') {
      return errorResponse('Cannot update crew requirements for completed flight', 400);
    }

    const body = await request.json();

    const validation = validateData(crewRequirementUpdateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const updateData = validation.data!;

    if (updateData.role_required && updateData.role_required !== existing.role_required) {
      const roleExists = await queryOne(
        'SELECT requirement_id FROM Crew_requirements WHERE flight_schedule_id = ? AND role_required = ? AND requirement_id != ?',
        [existing.flight_schedule_id, updateData.role_required, requirementId]
      );

      if (roleExists) {
        return errorResponse('Crew requirement for this role already exists for this flight', 409);
      }
    }

    if (updateData.number_required !== undefined && updateData.number_required <= 0) {
      return errorResponse('Number required must be greater than 0', 400);
    }

    if (updateData.number_required !== undefined && updateData.number_required < existing.number_required) {
      const assignedCount = await queryOne<any>(
        `SELECT COUNT(DISTINCT ta.staff_id) as count 
         FROM Task_Assignments ta
         JOIN Tasks t ON ta.task_id = t.task_id
         JOIN Staff s ON ta.staff_id = s.staff_id
         WHERE t.flight_schedule_id = ? 
         AND s.role = ?
         AND ta.assignment_status != 'Cancelled'`,
        [existing.flight_schedule_id, existing.role_required]
      );

      if (assignedCount.count > updateData.number_required) {
        return errorResponse(
          `Cannot reduce requirement. ${assignedCount.count} crew members already assigned for this role`,
          400
        );
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.role_required !== undefined) {
      updates.push('role_required = ?');
      values.push(updateData.role_required);
    }
    if (updateData.number_required !== undefined) {
      updates.push('number_required = ?');
      values.push(updateData.number_required);
    }

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    values.push(requirementId);

    await query(
      `UPDATE Crew_requirements SET ${updates.join(', ')} WHERE requirement_id = ?`,
      values
    );

    const updatedRequirement = await queryOne(
      `SELECT 
        cr.*,
        fs.departure_datetime,
        f.flight_number,
        al.airline_name,
        src.airport_name as source_airport_name,
        dest.airport_name as destination_airport_name,
        (SELECT COUNT(DISTINCT ta.staff_id) 
         FROM Task_Assignments ta
         JOIN Tasks t ON ta.task_id = t.task_id
         JOIN Staff s ON ta.staff_id = s.staff_id
         WHERE t.flight_schedule_id = cr.flight_schedule_id 
         AND s.role = cr.role_required
         AND ta.assignment_status != 'Cancelled') as assigned_count
      FROM Crew_requirements cr
      LEFT JOIN Flight_schedules fs ON cr.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE cr.requirement_id = ?`,
      [requirementId]
    );

    return successResponse(updatedRequirement, 'Crew requirement updated successfully');
  } catch (error: any) {
    console.error('Update crew requirement error:', error);
    return errorResponse('Failed to update crew requirement: ' + error.message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requirementId = parseInt(params.id);

    if (isNaN(requirementId)) {
      return errorResponse('Invalid requirement ID', 400);
    }

    const existing = await queryOne<any>(
      `SELECT cr.*, fs.flight_status 
       FROM Crew_requirements cr
       LEFT JOIN Flight_schedules fs ON cr.flight_schedule_id = fs.flight_schedule_id
       WHERE cr.requirement_id = ?`,
      [requirementId]
    );

    if (!existing) {
      return notFoundResponse('Crew requirement not found');
    }

    if (existing.flight_status === 'Completed') {
      return errorResponse('Cannot delete crew requirements for completed flight', 400);
    }

    const hasAssignments = await queryOne<any>(
      `SELECT COUNT(DISTINCT ta.staff_id) as count 
       FROM Task_Assignments ta
       JOIN Tasks t ON ta.task_id = t.task_id
       JOIN Staff s ON ta.staff_id = s.staff_id
       WHERE t.flight_schedule_id = ? 
       AND s.role = ?
       AND ta.assignment_status != 'Cancelled'`,
      [existing.flight_schedule_id, existing.role_required]
    );

    if (hasAssignments.count > 0) {
      return errorResponse(
        `Cannot delete requirement. ${hasAssignments.count} crew member(s) already assigned for this role`,
        409
      );
    }

    await query('DELETE FROM Crew_requirements WHERE requirement_id = ?', [requirementId]);

    return noContentResponse();
  } catch (error: any) {
    console.error('Delete crew requirement error:', error);
    return errorResponse('Failed to delete crew requirement: ' + error.message, 500);
  }
}