import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { gateCreateSchema, validateData } from '@/lib/validations';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const terminal_id = searchParams.get('terminal_id');
    const airport_id = searchParams.get('airport_id');
    const status = searchParams.get('status');
    const gate_number = searchParams.get('gate_number');

    let sql = `
      SELECT 
        g.*,
        t.terminal_name,
        t.terminal_code,
        a.airport_name,
        a.airport_code,
        a.city,
        a.country
      FROM Gates g
      LEFT JOIN Terminals t ON g.terminal_id = t.terminal_id
      LEFT JOIN Airport a ON t.airport_id = a.airport_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (terminal_id) {
      sql += ' AND g.terminal_id = ?';
      params.push(parseInt(terminal_id));
    }

    if (airport_id) {
      sql += ' AND t.airport_id = ?';
      params.push(parseInt(airport_id));
    }

    if (status) {
      sql += ' AND g.status = ?';
      params.push(status);
    }

    if (gate_number) {
      sql += ' AND g.gate_number = ?';
      params.push(gate_number);
    }

    sql += ' ORDER BY a.airport_name ASC, t.terminal_code ASC, g.gate_number ASC';

    const gates = await query(sql, params);

    return successResponse(gates, 'Gates retrieved successfully');
  } catch (error: any) {
    console.error('Get gates error:', error);
    return errorResponse('Failed to retrieve gates: ' + error.message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = validateData(gateCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data!;

    const terminal = await queryOne(
      'SELECT terminal_id FROM Terminals WHERE terminal_id = ?',
      [data.terminal_id]
    );

    if (!terminal) {
      return errorResponse('Terminal not found', 404);
    }

    const existingGate = await queryOne(
      'SELECT gate_id FROM Gates WHERE terminal_id = ? AND gate_number = ?',
      [data.terminal_id, data.gate_number]
    );

    if (existingGate) {
      return errorResponse('Gate with this number already exists in this terminal', 409);
    }

    const result = await query<any>(
      `INSERT INTO Gates (
        terminal_id, gate_number, status
      ) VALUES (?, ?, ?)`,
      [
        data.terminal_id,
        data.gate_number,
        data.status || 'Available'
      ]
    );

    const newGate = await queryOne(
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
      [result.insertId]
    );

    return createdResponse(newGate, 'Gate created successfully');
  } catch (error: any) {
    console.error('Create gate error:', error);
    return errorResponse('Failed to create gate: ' + error.message, 500);
  }
}