import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { terminalUpdateSchema, validateData } from '@/lib/validations';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const terminalId = parseInt(params.id);

    if (isNaN(terminalId)) {
      return errorResponse('Invalid terminal ID', 400);
    }

    const terminal = await queryOne(
      `SELECT 
        t.*,
        a.airport_name,
        a.airport_code,
        a.city,
        a.country,
        a.timezone,
        (SELECT COUNT(*) FROM Gates WHERE terminal_id = t.terminal_id) as gate_count,
        (SELECT COUNT(*) FROM Gates WHERE terminal_id = t.terminal_id AND status = 'Available') as available_gates,
        (SELECT COUNT(*) FROM Gates WHERE terminal_id = t.terminal_id AND status = 'Occupied') as occupied_gates
      FROM Terminals t
      LEFT JOIN Airport a ON t.airport_id = a.airport_id
      WHERE t.terminal_id = ?`,
      [terminalId]
    );

    if (!terminal) {
      return notFoundResponse('Terminal not found');
    }

    return successResponse(terminal, 'Terminal retrieved successfully');
  } catch (error: any) {
    console.error('Get terminal error:', error);
    return errorResponse('Failed to retrieve terminal: ' + error.message, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const terminalId = parseInt(params.id);

    if (isNaN(terminalId)) {
      return errorResponse('Invalid terminal ID', 400);
    }

    const existing = await queryOne<any>(
      'SELECT * FROM Terminals WHERE terminal_id = ?',
      [terminalId]
    );

    if (!existing) {
      return notFoundResponse('Terminal not found');
    }

    const body = await request.json();

    const validation = validateData(terminalUpdateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const updateData = validation.data!;

    if (updateData.terminal_name && updateData.terminal_name !== existing.terminal_name) {
      const nameExists = await queryOne(
        'SELECT terminal_id FROM Terminals WHERE airport_id = ? AND terminal_name = ? AND terminal_id != ?',
        [existing.airport_id, updateData.terminal_name, terminalId]
      );

      if (nameExists) {
        return errorResponse('Terminal with this name already exists at this airport', 409);
      }
    }

    if (updateData.terminal_code && updateData.terminal_code !== existing.terminal_code) {
      const codeExists = await queryOne(
        'SELECT terminal_id FROM Terminals WHERE airport_id = ? AND terminal_code = ? AND terminal_id != ?',
        [existing.airport_id, updateData.terminal_code, terminalId]
      );

      if (codeExists) {
        return errorResponse('Terminal with this code already exists at this airport', 409);
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.terminal_name !== undefined) {
      updates.push('terminal_name = ?');
      values.push(updateData.terminal_name);
    }
    if (updateData.terminal_code !== undefined) {
      updates.push('terminal_code = ?');
      values.push(updateData.terminal_code);
    }

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    values.push(terminalId);

    await query(
      `UPDATE Terminals SET ${updates.join(', ')} WHERE terminal_id = ?`,
      values
    );

    const updatedTerminal = await queryOne(
      `SELECT 
        t.*,
        a.airport_name,
        a.airport_code,
        a.city,
        a.country
      FROM Terminals t
      LEFT JOIN Airport a ON t.airport_id = a.airport_id
      WHERE t.terminal_id = ?`,
      [terminalId]
    );

    return successResponse(updatedTerminal, 'Terminal updated successfully');
  } catch (error: any) {
    console.error('Update terminal error:', error);
    return errorResponse('Failed to update terminal: ' + error.message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const terminalId = parseInt(params.id);

    if (isNaN(terminalId)) {
      return errorResponse('Invalid terminal ID', 400);
    }

    const existing = await queryOne(
      'SELECT * FROM Terminals WHERE terminal_id = ?',
      [terminalId]
    );

    if (!existing) {
      return notFoundResponse('Terminal not found');
    }

    const hasGates = await queryOne<any>(
      'SELECT COUNT(*) as count FROM Gates WHERE terminal_id = ?',
      [terminalId]
    );

    if (hasGates.count > 0) {
      return errorResponse('Cannot delete terminal with existing gates', 409);
    }

    await query('DELETE FROM Terminals WHERE terminal_id = ?', [terminalId]);

    return noContentResponse();
  } catch (error: any) {
    console.error('Delete terminal error:', error);
    return errorResponse('Failed to delete terminal: ' + error.message, 500);
  }
}