import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { airportUpdateSchema, validateData } from '@/lib/validations';

// ========== GET /api/airports/[id] - Get single airport ==========
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const airportId = parseInt(params.id);

    if (isNaN(airportId)) {
      return errorResponse('Invalid airport ID', 400);
    }

    const airport = await queryOne(
      'SELECT * FROM Airport WHERE airport_id = ?',
      [airportId]
    );

    if (!airport) {
      return notFoundResponse('Airport not found');
    }

    return successResponse(airport, 'Airport retrieved successfully');
  } catch (error: any) {
    console.error('Get airport error:', error);
    return errorResponse('Failed to retrieve airport: ' + error.message, 500);
  }
}

// ========== PUT /api/airports/[id] - Update airport ==========
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const airportId = parseInt(params.id);

    if (isNaN(airportId)) {
      return errorResponse('Invalid airport ID', 400);
    }

    // Check if airport exists
    const existing = await queryOne(
      'SELECT * FROM Airport WHERE airport_id = ?',
      [airportId]
    );

    if (!existing) {
      return notFoundResponse('Airport not found');
    }

    const body = await request.json();

    // Validate input
    const validation = validateData(airportUpdateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const updateData = validation.data!;

    // Check if airport_code is being changed and if it's unique
    if (updateData.airport_code && updateData.airport_code !== (existing as any).airport_code) {
      const codeExists = await queryOne(
        'SELECT airport_id FROM Airport WHERE airport_code = ? AND airport_id != ?',
        [updateData.airport_code, airportId]
      );

      if (codeExists) {
        return errorResponse('Airport code already exists', 409);
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.airport_name !== undefined) {
      updates.push('airport_name = ?');
      values.push(updateData.airport_name);
    }
    if (updateData.city !== undefined) {
      updates.push('city = ?');
      values.push(updateData.city);
    }
    if (updateData.country !== undefined) {
      updates.push('country = ?');
      values.push(updateData.country);
    }
    if (updateData.airport_code !== undefined) {
      updates.push('airport_code = ?');
      values.push(updateData.airport_code);
    }
    if (updateData.timezone !== undefined) {
      updates.push('timezone = ?');
      values.push(updateData.timezone);
    }

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    values.push(airportId);

    await query(
      `UPDATE Airport SET ${updates.join(', ')} WHERE airport_id = ?`,
      values
    );

    // Fetch updated airport
    const updatedAirport = await queryOne(
      'SELECT * FROM Airport WHERE airport_id = ?',
      [airportId]
    );

    return successResponse(updatedAirport, 'Airport updated successfully');
  } catch (error: any) {
    console.error('Update airport error:', error);
    return errorResponse('Failed to update airport: ' + error.message, 500);
  }
}

// ========== DELETE /api/airports/[id] - Delete airport ==========
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const airportId = parseInt(params.id);

    if (isNaN(airportId)) {
      return errorResponse('Invalid airport ID', 400);
    }

    // Check if airport exists
    const existing = await queryOne(
      'SELECT * FROM Airport WHERE airport_id = ?',
      [airportId]
    );

    if (!existing) {
      return notFoundResponse('Airport not found');
    }

    // Check if airport has flights as source
    const hasSourceFlights = await queryOne(
      'SELECT COUNT(*) as count FROM Flights WHERE source_airport_id = ?',
      [airportId]
    );

    if ((hasSourceFlights as any).count > 0) {
      return errorResponse('Cannot delete airport with existing source flights', 409);
    }

    // Check if airport has flights as destination
    const hasDestFlights = await queryOne(
      'SELECT COUNT(*) as count FROM Flights WHERE destination_airport_id = ?',
      [airportId]
    );

    if ((hasDestFlights as any).count > 0) {
      return errorResponse('Cannot delete airport with existing destination flights', 409);
    }

    // Check if airport has staff
    const hasStaff = await queryOne(
      'SELECT COUNT(*) as count FROM Staff WHERE airport_id = ?',
      [airportId]
    );

    if ((hasStaff as any).count > 0) {
      return errorResponse('Cannot delete airport with existing staff', 409);
    }

    // Check if airport has terminals
    const hasTerminals = await queryOne(
      'SELECT COUNT(*) as count FROM Terminals WHERE airport_id = ?',
      [airportId]
    );

    if ((hasTerminals as any).count > 0) {
      return errorResponse('Cannot delete airport with existing terminals', 409);
    }

    // Check if airport has runways
    const hasRunways = await queryOne(
      'SELECT COUNT(*) as count FROM Runways WHERE airport_id = ?',
      [airportId]
    );

    if ((hasRunways as any).count > 0) {
      return errorResponse('Cannot delete airport with existing runways', 409);
    }

    // Delete airport
    await query('DELETE FROM Airport WHERE airport_id = ?', [airportId]);

    return noContentResponse();
  } catch (error: any) {
    console.error('Delete airport error:', error);
    return errorResponse('Failed to delete airport: ' + error.message, 500);
  }
}