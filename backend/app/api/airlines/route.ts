import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { airlineCreateSchema, airlineUpdateSchema, validateData } from '@/lib/validations';

// ========== GET /api/airlines - Get all airlines ==========
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    const airline_code = searchParams.get('airline_code');

    let sql = 'SELECT * FROM Airline WHERE 1=1';
    const params: any[] = [];

    // Filter by country
    if (country) {
      sql += ' AND country = ?';
      params.push(country);
    }

    // Filter by airline code
    if (airline_code) {
      sql += ' AND airline_code = ?';
      params.push(airline_code);
    }

    sql += ' ORDER BY airline_name ASC';

    const airlines = await query(sql, params);

    return successResponse(airlines, 'Airlines retrieved successfully');
  } catch (error: any) {
    console.error('Get airlines error:', error);
    return errorResponse('Failed to retrieve airlines: ' + error.message, 500);
  }
}

// ========== POST /api/airlines - Create new airline ==========
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateData(airlineCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const { airline_name, country, airline_code } = validation.data!;

    // Check if airline code already exists
    const existing = await queryOne(
      'SELECT airline_id FROM Airline WHERE airline_code = ?',
      [airline_code]
    );

    if (existing) {
      return errorResponse('Airline code already exists', 409);
    }

    // Insert airline
    const result = await query<any>(
      'INSERT INTO Airline (airline_name, country, airline_code) VALUES (?, ?, ?)',
      [airline_name, country, airline_code]
    );

    const newAirline = await queryOne(
      'SELECT * FROM Airline WHERE airline_id = ?',
      [result.insertId]
    );

    return createdResponse(newAirline, 'Airline created successfully');
  } catch (error: any) {
    console.error('Create airline error:', error);
    return errorResponse('Failed to create airline: ' + error.message, 500);
  }
}