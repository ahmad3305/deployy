import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { airlineCreateSchema, airlineUpdateSchema, validateData } from '@/lib/validations';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    const airline_code = searchParams.get('airline_code');

    let sql = 'SELECT * FROM Airline WHERE 1=1';
    const params: any[] = [];

    if (country) {
      sql += ' AND country = ?';
      params.push(country);
    }

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = validateData(airlineCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const { airline_name, country, airline_code } = validation.data!;

    const existing = await queryOne(
      'SELECT airline_id FROM Airline WHERE airline_code = ?',
      [airline_code]
    );

    if (existing) {
      return errorResponse('Airline code already exists', 409);
    }

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