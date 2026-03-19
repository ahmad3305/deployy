import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { airportCreateSchema, airportUpdateSchema, validateData } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const country = searchParams.get('country');
    const airport_code = searchParams.get('airport_code');

    let sql = 'SELECT * FROM Airport WHERE 1=1';
    const params: any[] = [];

    if (city) {
      sql += ' AND city = ?';
      params.push(city);
    }

    if (country) {
      sql += ' AND country = ?';
      params.push(country);
    }

    if (airport_code) {
      sql += ' AND airport_code = ?';
      params.push(airport_code);
    }

    sql += ' ORDER BY airport_name ASC';

    const airports = await query(sql, params);

    return successResponse(airports, 'Airports retrieved successfully');
  } catch (error: any) {
    console.error('Get airports error:', error);
    return errorResponse('Failed to retrieve airports: ' + error.message, 500);
  }
}

export async function POST(request: NextRequest) {

  const token = request.headers.get('authorization')?.substring(7);
  const user = verifyToken(token!);
  
  if (!user || user.role !== 'Admin') {
    return errorResponse('Admin access required', 403);
  }

  try {
    const body = await request.json();

    const validation = validateData(airportCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const { airport_name, city, country, airport_code, timezone } = validation.data!;

    const existing = await queryOne(
      'SELECT airport_id FROM Airport WHERE airport_code = ?',
      [airport_code]
    );

    if (existing) {
      return errorResponse('Airport code already exists', 409);
    }

    const result = await query<any>(
      'INSERT INTO Airport (airport_name, city, country, airport_code, timezone) VALUES (?, ?, ?, ?, ?)',
      [airport_name, city, country, airport_code, timezone]
    );

    const newAirport = await queryOne(
      'SELECT * FROM Airport WHERE airport_id = ?',
      [result.insertId]
    );

    return createdResponse(newAirport, 'Airport created successfully');
  } catch (error: any) {
    console.error('Create airport error:', error);
    return errorResponse('Failed to create airport: ' + error.message, 500);
  }
}


