import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { airlineUpdateSchema, validateData } from '@/lib/validations';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const airlineId = parseInt(params.id);

    if (isNaN(airlineId)) {
      return errorResponse('Invalid airline ID', 400);
    }

    const airline = await queryOne(
      'SELECT * FROM Airline WHERE airline_id = ?',
      [airlineId]
    );

    if (!airline) {
      return notFoundResponse('Airline not found');
    }

    return successResponse(airline, 'Airline retrieved successfully');
  } catch (error: any) {
    console.error('Get airline error:', error);
    return errorResponse('Failed to retrieve airline: ' + error.message, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const airlineId = parseInt(params.id);

    if (isNaN(airlineId)) {
      return errorResponse('Invalid airline ID', 400);
    }

    const existing = await queryOne(
      'SELECT * FROM Airline WHERE airline_id = ?',
      [airlineId]
    );

    if (!existing) {
      return notFoundResponse('Airline not found');
    }

    const body = await request.json();

    const validation = validateData(airlineUpdateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const updateData = validation.data!;

    if (updateData.airline_code && updateData.airline_code !== (existing as any).airline_code) {
      const codeExists = await queryOne(
        'SELECT airline_id FROM Airline WHERE airline_code = ? AND airline_id != ?',
        [updateData.airline_code, airlineId]
      );

      if (codeExists) {
        return errorResponse('Airline code already exists', 409);
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.airline_name !== undefined) {
      updates.push('airline_name = ?');
      values.push(updateData.airline_name);
    }
    if (updateData.country !== undefined) {
      updates.push('country = ?');
      values.push(updateData.country);
    }
    if (updateData.airline_code !== undefined) {
      updates.push('airline_code = ?');
      values.push(updateData.airline_code);
    }

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    values.push(airlineId);

    await query(
      `UPDATE Airline SET ${updates.join(', ')} WHERE airline_id = ?`,
      values
    );

    const updatedAirline = await queryOne(
      'SELECT * FROM Airline WHERE airline_id = ?',
      [airlineId]
    );

    return successResponse(updatedAirline, 'Airline updated successfully');
  } catch (error: any) {
    console.error('Update airline error:', error);
    return errorResponse('Failed to update airline: ' + error.message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const airlineId = parseInt(params.id);

    if (isNaN(airlineId)) {
      return errorResponse('Invalid airline ID', 400);
    }

    const existing = await queryOne(
      'SELECT * FROM Airline WHERE airline_id = ?',
      [airlineId]
    );

    if (!existing) {
      return notFoundResponse('Airline not found');
    }

    const hasFlights = await queryOne(
      'SELECT COUNT(*) as count FROM Flights WHERE airline_id = ?',
      [airlineId]
    );

    if ((hasFlights as any).count > 0) {
      return errorResponse('Cannot delete airline with existing flights', 409);
    }

    const hasAircraft = await queryOne(
      'SELECT COUNT(*) as count FROM Aircraft WHERE airline_id = ?',
      [airlineId]
    );

    if ((hasAircraft as any).count > 0) {
      return errorResponse('Cannot delete airline with existing aircraft', 409);
    }

    await query('DELETE FROM Airline WHERE airline_id = ?', [airlineId]);

    return noContentResponse();
  } catch (error: any) {
    console.error('Delete airline error:', error);
    return errorResponse('Failed to delete airline: ' + error.message, 500);
  }
}