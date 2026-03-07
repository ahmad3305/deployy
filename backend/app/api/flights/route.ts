import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { flightCreateSchema, validateData } from '@/lib/validations';

// ========== GET /api/flights - Get all flights ==========
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const airline_id = searchParams.get('airline_id');
    const source_airport_id = searchParams.get('source_airport_id');
    const destination_airport_id = searchParams.get('destination_airport_id');
    const flight_type = searchParams.get('flight_type');
    const flight_number = searchParams.get('flight_number');

    let sql = `
      SELECT 
        f.*,
        al.airline_name,
        al.airline_code,
        src.airport_name as source_airport_name,
        src.airport_code as source_airport_code,
        src.city as source_city,
        src.country as source_country,
        dest.airport_name as destination_airport_name,
        dest.airport_code as destination_airport_code,
        dest.city as destination_city,
        dest.country as destination_country
      FROM Flights f
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filter by airline
    if (airline_id) {
      sql += ' AND f.airline_id = ?';
      params.push(parseInt(airline_id));
    }

    // Filter by source airport
    if (source_airport_id) {
      sql += ' AND f.source_airport_id = ?';
      params.push(parseInt(source_airport_id));
    }

    // Filter by destination airport
    if (destination_airport_id) {
      sql += ' AND f.destination_airport_id = ?';
      params.push(parseInt(destination_airport_id));
    }

    // Filter by flight type
    if (flight_type) {
      sql += ' AND f.flight_type = ?';
      params.push(flight_type);
    }

    // Filter by flight number
    if (flight_number) {
      sql += ' AND f.flight_number = ?';
      params.push(parseInt(flight_number));
    }

    sql += ' ORDER BY al.airline_code ASC, f.flight_number ASC';

    const flights = await query(sql, params);

    return successResponse(flights, 'Flights retrieved successfully');
  } catch (error: any) {
    console.error('Get flights error:', error);
    return errorResponse('Failed to retrieve flights: ' + error.message, 500);
  }
}

// ========== POST /api/flights - Create new flight ==========
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateData(flightCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data!;

    // Verify source and destination are different
    if (data.source_airport_id === data.destination_airport_id) {
      return errorResponse('Source and destination airports must be different', 400);
    }

    // Verify airline exists
    const airline = await queryOne(
      'SELECT airline_id FROM Airline WHERE airline_id = ?',
      [data.airline_id]
    );

    if (!airline) {
      return errorResponse('Airline not found', 404);
    }

    // Verify source airport exists
    const sourceAirport = await queryOne(
      'SELECT airport_id FROM Airport WHERE airport_id = ?',
      [data.source_airport_id]
    );

    if (!sourceAirport) {
      return errorResponse('Source airport not found', 404);
    }

    // Verify destination airport exists
    const destAirport = await queryOne(
      'SELECT airport_id FROM Airport WHERE airport_id = ?',
      [data.destination_airport_id]
    );

    if (!destAirport) {
      return errorResponse('Destination airport not found', 404);
    }

    // Check if flight number already exists for this airline
    const existingFlight = await queryOne(
      'SELECT flight_id FROM Flights WHERE airline_id = ? AND flight_number = ?',
      [data.airline_id, data.flight_number]
    );

    if (existingFlight) {
      return errorResponse('Flight number already exists for this airline', 409);
    }

    // Insert flight
    const result = await query<any>(
      `INSERT INTO Flights (
        airline_id, flight_number, source_airport_id, 
        destination_airport_id, flight_type, estimated_duration
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.airline_id,
        data.flight_number,
        data.source_airport_id,
        data.destination_airport_id,
        data.flight_type,
        data.estimated_duration
      ]
    );

    // Fetch created flight with joined data
    const newFlight = await queryOne(
      `SELECT 
        f.*,
        al.airline_name,
        al.airline_code,
        src.airport_name as source_airport_name,
        src.airport_code as source_airport_code,
        dest.airport_name as destination_airport_name,
        dest.airport_code as destination_airport_code
      FROM Flights f
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE f.flight_id = ?`,
      [result.insertId]
    );

    return createdResponse(newFlight, 'Flight created successfully');
  } catch (error: any) {
    console.error('Create flight error:', error);
    return errorResponse('Failed to create flight: ' + error.message, 500);
  }
}