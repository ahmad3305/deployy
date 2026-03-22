import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { runwayUpdateSchema, validateData } from '@/lib/validations';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const runwayId = parseInt(params.id);

    if (isNaN(runwayId)) {
      return errorResponse('Invalid runway ID', 400);
    }

    const runway = await queryOne(
      `SELECT 
        r.*,
        a.airport_name,
        a.airport_code,
        a.city,
        a.country,
        a.timezone
      FROM Runways r
      LEFT JOIN Airport a ON r.airport_id = a.airport_id
      WHERE r.runway_id = ?`,
      [runwayId]
    );

    if (!runway) {
      return notFoundResponse('Runway not found');
    }

    return successResponse(runway, 'Runway retrieved successfully');
  } catch (error: any) {
    console.error('Get runway error:', error);
    return errorResponse('Failed to retrieve runway: ' + error.message, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const runwayId = parseInt(params.id);

    if (isNaN(runwayId)) {
      return errorResponse('Invalid runway ID', 400);
    }

    const existing = await queryOne<any>(
      'SELECT * FROM Runways WHERE runway_id = ?',
      [runwayId]
    );

    if (!existing) {
      return notFoundResponse('Runway not found');
    }

    const body = await request.json();

    const validation = validateData(runwayUpdateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const updateData = validation.data!;

    if (updateData.runway_number && updateData.runway_number !== existing.runway_number) {
      const runwayExists = await queryOne(
        'SELECT runway_id FROM Runways WHERE airport_id = ? AND runway_number = ? AND runway_id != ?',
        [existing.airport_id, updateData.runway_number, runwayId]
      );

      if (runwayExists) {
        return errorResponse('Runway with this number already exists at this airport', 409);
      }
    }

    if (updateData.length_meters !== undefined && updateData.length_meters <= 0) {
      return errorResponse('Length must be greater than 0', 400);
    }

    if (updateData.width_meters !== undefined && updateData.width_meters <= 0) {
      return errorResponse('Width must be greater than 0', 400);
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.runway_number !== undefined) {
      updates.push('runway_number = ?');
      values.push(updateData.runway_number);
    }
    if (updateData.length_meters !== undefined) {
      updates.push('length_meters = ?');
      values.push(updateData.length_meters);
    }
    if (updateData.width_meters !== undefined) {
      updates.push('width_meters = ?');
      values.push(updateData.width_meters);
    }
    if (updateData.surface_type !== undefined) {
      updates.push('surface_type = ?');
      values.push(updateData.surface_type);
    }
    if (updateData.status !== undefined) {
      updates.push('status = ?');
      values.push(updateData.status);
    }

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    values.push(runwayId);

    await query(
      `UPDATE Runways SET ${updates.join(', ')} WHERE runway_id = ?`,
      values
    );

    const updatedRunway = await queryOne(
      `SELECT 
        r.*,
        a.airport_name,
        a.airport_code,
        a.city,
        a.country
      FROM Runways r
      LEFT JOIN Airport a ON r.airport_id = a.airport_id
      WHERE r.runway_id = ?`,
      [runwayId]
    );

    return successResponse(updatedRunway, 'Runway updated successfully');
  } catch (error: any) {
    console.error('Update runway error:', error);
    return errorResponse('Failed to update runway: ' + error.message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const runwayId = parseInt(params.id);

    if (isNaN(runwayId)) {
      return errorResponse('Invalid runway ID', 400);
    }

    const existing = await queryOne(
      'SELECT * FROM Runways WHERE runway_id = ?',
      [runwayId]
    );

    if (!existing) {
      return notFoundResponse('Runway not found');
    }

    await query('DELETE FROM Runways WHERE runway_id = ?', [runwayId]);

    return noContentResponse();
  } catch (error: any) {
    console.error('Delete runway error:', error);
    return errorResponse('Failed to delete runway: ' + error.message, 500);
  }
}