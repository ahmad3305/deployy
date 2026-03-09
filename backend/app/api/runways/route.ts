import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { runwayCreateSchema, validateData } from '@/lib/validations';

// ========== GET /api/runways - Get all runways ==========
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const airport_id = searchParams.get('airport_id');
    const status = searchParams.get('status');
    const runway_number = searchParams.get('runway_number');

    let sql = `
      SELECT 
        r.*,
        a.airport_name,
        a.airport_code,
        a.city,
        a.country
      FROM Runways r
      LEFT JOIN Airport a ON r.airport_id = a.airport_id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filter by airport
    if (airport_id) {
      sql += ' AND r.airport_id = ?';
      params.push(parseInt(airport_id));
    }

    // Filter by status
    if (status) {
      sql += ' AND r.status = ?';
      params.push(status);
    }

    // Filter by runway number
    if (runway_number) {
      sql += ' AND r.runway_number = ?';
      params.push(runway_number);
    }

    sql += ' ORDER BY a.airport_name ASC, r.runway_number ASC';

    const runways = await query(sql, params);

    return successResponse(runways, 'Runways retrieved successfully');
  } catch (error: any) {
    console.error('Get runways error:', error);
    return errorResponse('Failed to retrieve runways: ' + error.message, 500);
  }
}

// ========== POST /api/runways - Create new runway ==========
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateData(runwayCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data!;

    // Verify airport exists
    const airport = await queryOne(
      'SELECT airport_id FROM Airport WHERE airport_id = ?',
      [data.airport_id]
    );

    if (!airport) {
      return errorResponse('Airport not found', 404);
    }

    // Check if runway number already exists at this airport
    const existingRunway = await queryOne(
      'SELECT runway_id FROM Runways WHERE airport_id = ? AND runway_number = ?',
      [data.airport_id, data.runway_number]
    );

    if (existingRunway) {
      return errorResponse('Runway with this number already exists at this airport', 409);
    }

    // Validate dimensions
    if (data.length_meters <= 0) {
      return errorResponse('Length must be greater than 0', 400);
    }

    if (data.width_meters <= 0) {
      return errorResponse('Width must be greater than 0', 400);
    }

    // Insert runway
    const result = await query<any>(
      `INSERT INTO Runways (
        airport_id, runway_number, length_meters, 
        width_meters, surface_type, status
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.airport_id,
        data.runway_number,
        data.length_meters,
        data.width_meters,
        data.surface_type,
        data.status || 'Available'
      ]
    );

    // Fetch created runway with joined data
    const newRunway = await queryOne(
      `SELECT 
        r.*,
        a.airport_name,
        a.airport_code,
        a.city,
        a.country
      FROM Runways r
      LEFT JOIN Airport a ON r.airport_id = a.airport_id
      WHERE r.runway_id = ?`,
      [result.insertId]
    );

    return createdResponse(newRunway, 'Runway created successfully');
  } catch (error: any) {
    console.error('Create runway error:', error);
    return errorResponse('Failed to create runway: ' + error.message, 500);
  }
}