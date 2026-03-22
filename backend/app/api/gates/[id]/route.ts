import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { gateUpdateSchema, validateData } from '@/lib/validations';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gateId = parseInt(params.id);

    if (isNaN(gateId)) {
      return errorResponse('Invalid gate ID', 400);
    }

    const gate = await queryOne(
      `SELECT 
        g.*,
        t.terminal_name,
        t.terminal_code,
        a.airport_name,
        a.airport_code,
        a.city,
        a.country,
        (SELECT COUNT(*) FROM Flight_schedules
         WHERE gate_id = g.gate_id 
         AND flight_status NOT IN ('Cancelled', 'Completed')) as active_flights,
        (SELECT COUNT(*) FROM Boarding_records 
         WHERE gate_id = g.gate_id 
         AND DATE(boarding_time) = CURDATE()) as today_boardings
      FROM Gates g
      LEFT JOIN Terminals t ON g.terminal_id = t.terminal_id
      LEFT JOIN Airport a ON t.airport_id = a.airport_id
      WHERE g.gate_id = ?`,
      [gateId]
    );

    if (!gate) {
      return notFoundResponse('Gate not found');
    }

    return successResponse(gate, 'Gate retrieved successfully');
  } catch (error: any) {
    console.error('Get gate error:', error);
    return errorResponse('Failed to retrieve gate: ' + error.message, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gateId = parseInt(params.id);

    if (isNaN(gateId)) {
      return errorResponse('Invalid gate ID', 400);
    }

    const existing = await queryOne<any>(
      'SELECT * FROM Gates WHERE gate_id = ?',
      [gateId]
    );

    if (!existing) {
      return notFoundResponse('Gate not found');
    }

    const body = await request.json();

    const validation = validateData(gateUpdateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const updateData = validation.data!;

    if (updateData.gate_number && updateData.gate_number !== existing.gate_number) {
      const gateExists = await queryOne(
        'SELECT gate_id FROM Gates WHERE terminal_id = ? AND gate_number = ? AND gate_id != ?',
        [existing.terminal_id, updateData.gate_number, gateId]
      );

      if (gateExists) {
        return errorResponse('Gate with this number already exists in this terminal', 409);
      }
    }

    if (updateData.status && updateData.status !== 'Available' && existing.status === 'Available') {
      const activeFlights = await queryOne<any>(
        `SELECT COUNT(*) as count FROM Flight_schedules
         WHERE gate_id = ? 
         AND flight_status NOT IN ('Cancelled', 'Completed')
         AND departure_datetime > NOW()`,
        [gateId]
      );

      if (activeFlights.count > 0) {
        return errorResponse(
          `Cannot change gate status. Gate has ${activeFlights.count} scheduled flight(s)`,
          400
        );
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.gate_number !== undefined) {
      updates.push('gate_number = ?');
      values.push(updateData.gate_number);
    }
    if (updateData.status !== undefined) {
      updates.push('status = ?');
      values.push(updateData.status);
    }

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    values.push(gateId);

    await query(
      `UPDATE Gates SET ${updates.join(', ')} WHERE gate_id = ?`,
      values
    );

    const updatedGate = await queryOne(
      `SELECT 
        g.*,
        t.terminal_name,
        t.terminal_code,
        a.airport_name,
        a.airport_code
      FROM Gates g
      LEFT JOIN Terminals t ON g.terminal_id = t.terminal_id
      LEFT JOIN Airport a ON t.airport_id = a.airport_id
      WHERE g.gate_id = ?`,
      [gateId]
    );

    return successResponse(updatedGate, 'Gate updated successfully');
  } catch (error: any) {
    console.error('Update gate error:', error);
    return errorResponse('Failed to update gate: ' + error.message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gateId = parseInt(params.id);

    if (isNaN(gateId)) {
      return errorResponse('Invalid gate ID', 400);
    }

    const existing = await queryOne(
      'SELECT * FROM Gates WHERE gate_id = ?',
      [gateId]
    );

    if (!existing) {
      return notFoundResponse('Gate not found');
    }

    const hasSchedules = await queryOne<any>(
      'SELECT COUNT(*) as count FROM Flight_schedulesWHERE gate_id = ?',
      [gateId]
    );

    if (hasSchedules.count > 0) {
      return errorResponse('Cannot delete gate with existing flight schedules', 409);
    }

    const hasBoardingRecords = await queryOne<any>(
      'SELECT COUNT(*) as count FROM Boarding_records WHERE gate_id = ?',
      [gateId]
    );

    if (hasBoardingRecords.count > 0) {
      return errorResponse('Cannot delete gate with existing boarding records', 409);
    }

    await query('DELETE FROM Gates WHERE gate_id = ?', [gateId]);

    return noContentResponse();
  } catch (error: any) {
    console.error('Delete gate error:', error);
    return errorResponse('Failed to delete gate: ' + error.message, 500);
  }
}