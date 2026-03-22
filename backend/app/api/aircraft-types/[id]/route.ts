import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { aircraftTypeUpdateSchema, validateData } from '@/lib/validations';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

// ========== GET /api/aircraft-types/[id] - Get single aircraft type ==========
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const aircraftTypeId = parseInt(params.id);

    if (isNaN(aircraftTypeId)) {
      return errorResponse('Invalid aircraft type ID', 400);
    }

    const aircraftType = await queryOne(
      'SELECT * FROM Aircraft_types WHERE aircraft_type_id = ?',
      [aircraftTypeId]
    );

    if (!aircraftType) {
      return notFoundResponse('Aircraft type not found');
    }

    return successResponse(aircraftType, 'Aircraft type retrieved successfully');
  } catch (error: any) {
    console.error('Get aircraft type error:', error);
    return errorResponse('Failed to retrieve aircraft type: ' + error.message, 500);
  }
}

// ========== PUT /api/aircraft-types/[id] - Update aircraft type ==========
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const aircraftTypeId = parseInt(params.id);

    if (isNaN(aircraftTypeId)) {
      return errorResponse('Invalid aircraft type ID', 400);
    }

    // Check if aircraft type exists
    const existing = await queryOne(
      'SELECT * FROM Aircraft_types WHERE aircraft_type_id = ?',
      [aircraftTypeId]
    );

    if (!existing) {
      return notFoundResponse('Aircraft type not found');
    }

    const body = await request.json();

    // Validate input
    const validation = validateData(aircraftTypeUpdateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const updateData = validation.data!;

    // Check if model_name + manufacturer combination is being changed and if it's unique
    if (updateData.model_name || updateData.manufacturer) {
      const newModelName = updateData.model_name || (existing as any).model_name;
      const newManufacturer = updateData.manufacturer || (existing as any).manufacturer;

      if (newModelName !== (existing as any).model_name || newManufacturer !== (existing as any).manufacturer) {
        const duplicateExists = await queryOne(
          'SELECT aircraft_type_id FROM Aircraft_types WHERE model_name = ? AND manufacturer = ? AND aircraft_type_id != ?',
          [newModelName, newManufacturer, aircraftTypeId]
        );

        if (duplicateExists) {
          return errorResponse('Aircraft type with this model name and manufacturer already exists', 409);
        }
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

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

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    values.push(aircraftTypeId);

    await query(
      `UPDATE Aircraft_types SET ${updates.join(', ')} WHERE aircraft_type_id = ?`,
      values
    );

    // Fetch updated aircraft type
    const updatedAircraftType = await queryOne(
      'SELECT * FROM Aircraft_types WHERE aircraft_type_id = ?',
      [aircraftTypeId]
    );

    return successResponse(updatedAircraftType, 'Aircraft type updated successfully');
  } catch (error: any) {
    console.error('Update aircraft type error:', error);
    return errorResponse('Failed to update aircraft type: ' + error.message, 500);
  }
}

// ========== DELETE /api/aircraft-types/[id] - Delete aircraft type ==========
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const aircraftTypeId = parseInt(params.id);

    if (isNaN(aircraftTypeId)) {
      return errorResponse('Invalid aircraft type ID', 400);
    }

    // Check if aircraft type exists
    const existing = await queryOne(
      'SELECT * FROM Aircraft_types WHERE aircraft_type_id = ?',
      [aircraftTypeId]
    );

    if (!existing) {
      return notFoundResponse('Aircraft type not found');
    }

    // Check if aircraft type has aircraft using it
    const hasAircraft = await queryOne(
      'SELECT COUNT(*) as count FROM Aircraft WHERE aircraft_type_id = ?',
      [aircraftTypeId]
    );

    if ((hasAircraft as any).count > 0) {
      return errorResponse('Cannot delete aircraft type with existing aircraft', 409);
    }

    // Delete aircraft type
    await query('DELETE FROM Aircraft_types WHERE aircraft_type_id = ?', [aircraftTypeId]);

    return noContentResponse();
  } catch (error: any) {
    console.error('Delete aircraft type error:', error);
    return errorResponse('Failed to delete aircraft type: ' + error.message, 500);
  }
}