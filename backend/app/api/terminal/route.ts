import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { terminalCreateSchema, validateData } from '@/lib/validations';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const airport_id = searchParams.get('airport_id');
    const terminal_name = searchParams.get('terminal_name');
    const terminal_code = searchParams.get('terminal_code');

    let sql = `
      SELECT 
        t.*,
        a.airport_name,
        a.airport_code,
        a.city,
        a.country,
        (SELECT COUNT(*) FROM Gates WHERE terminal_id = t.terminal_id) as gate_count
      FROM Terminals t
      LEFT JOIN Airport a ON t.airport_id = a.airport_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (airport_id) {
      sql += ' AND t.airport_id = ?';
      params.push(parseInt(airport_id));
    }

    if (terminal_name) {
      sql += ' AND t.terminal_name LIKE ?';
      params.push(`%${terminal_name}%`);
    }

    if (terminal_code) {
      sql += ' AND t.terminal_code = ?';
      params.push(terminal_code);
    }

    sql += ' ORDER BY a.airport_name ASC, t.terminal_code ASC';

    const terminals = await query(sql, params);

    return successResponse(terminals, 'Terminals retrieved successfully');
  } catch (error: any) {
    console.error('Get terminals error:', error);
    return errorResponse('Failed to retrieve terminals: ' + error.message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = validateData(terminalCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data!;

    const airport = await queryOne(
      'SELECT airport_id FROM Airport WHERE airport_id = ?',
      [data.airport_id]
    );

    if (!airport) {
      return errorResponse('Airport not found', 404);
    }

    const existingName = await queryOne(
      'SELECT terminal_id FROM Terminals WHERE airport_id = ? AND terminal_name = ?',
      [data.airport_id, data.terminal_name]
    );

    if (existingName) {
      return errorResponse('Terminal with this name already exists at this airport', 409);
    }

    const existingCode = await queryOne(
      'SELECT terminal_id FROM Terminals WHERE airport_id = ? AND terminal_code = ?',
      [data.airport_id, data.terminal_code]
    );

    if (existingCode) {
      return errorResponse('Terminal with this code already exists at this airport', 409);
    }

    const result = await query<any>(
      `INSERT INTO Terminals (
        airport_id, terminal_name, terminal_code
      ) VALUES (?, ?, ?)`,
      [
        data.airport_id,
        data.terminal_name,
        data.terminal_code
      ]
    );

    const newTerminal = await queryOne(
      `SELECT 
        t.*,
        a.airport_name,
        a.airport_code,
        a.city,
        a.country
      FROM Terminals t
      LEFT JOIN Airport a ON t.airport_id = a.airport_id
      WHERE t.terminal_id = ?`,
      [result.insertId]
    );

    return createdResponse(newTerminal, 'Terminal created successfully');
  } catch (error: any) {
    console.error('Create terminal error:', error);
    return errorResponse('Failed to create terminal: ' + error.message, 500);
  }
}