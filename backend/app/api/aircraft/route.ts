import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { aircraftTypeCreateSchema, aircraftTypeUpdateSchema, validateData } from '@/lib/validations';

// ========== GET /api/aircraft-types - Get all aircraft types ==========
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const manufacturer = searchParams.get('manufacturer');
    const model_name = searchParams.get('model_name');

    let sql = 'SELECT * FROM Aircraft_types WHERE 1=1';
    const params: any[] = [];

    // Filter by manufacturer
    if (manufacturer) {
      sql += ' AND manufacturer = ?';
      params.push(manufacturer);
    }

    // Filter by model name
    if (model_name) {
      sql += ' AND model_name LIKE ?';
      params.push(`%${model_name}%`);
    }

    sql += ' ORDER BY manufacturer ASC, model_name ASC';

    const aircraftTypes = await query(sql, params);

    return successResponse(aircraftTypes, 'Aircraft types retrieved successfully');
  } catch (error: any) {
    console.error('Get aircraft types error:', error);
    return errorResponse('Failed to retrieve aircraft types: ' + error.message, 500);
  }
}

// ========== POST /api/aircraft-types - Create new aircraft type ==========
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateData(aircraftTypeCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const { model_name, manufacturer, seat_capacity } = validation.data!;

    // Check if aircraft type already exists (same model and manufacturer)
    const existing = await queryOne(
      'SELECT aircraft_type_id FROM Aircraft_types WHERE model_name = ? AND manufacturer = ?',
      [model_name, manufacturer]
    );

    if (existing) {
      return errorResponse('Aircraft type with this model name and manufacturer already exists', 409);
    }

    // Insert aircraft type
    const result = await query<any>(
      'INSERT INTO Aircraft_types (model_name, manufacturer, seat_capacity) VALUES (?, ?, ?)',
      [model_name, manufacturer, seat_capacity]
    );

    const newAircraftType = await queryOne(
      'SELECT * FROM Aircraft_types WHERE aircraft_type_id = ?',
      [result.insertId]
    );

    return createdResponse(newAircraftType, 'Aircraft type created successfully');
  } catch (error: any) {
    console.error('Create aircraft type error:', error);
    return errorResponse('Failed to create aircraft type: ' + error.message, 500);
  }
}