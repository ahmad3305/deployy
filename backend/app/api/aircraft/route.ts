import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { aircraftCreateSchema, validateData } from '@/lib/validations';
import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

// ========== GET /api/aircraft - Get all aircraft ==========
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const airline_id = searchParams.get('airline_id');
    const status = searchParams.get('status');
    const current_airport = searchParams.get('current_airport');
    const aircraft_type_id = searchParams.get('aircraft_type_id');

    let sql = `
      SELECT 
        a.*,
        al.airline_name,
        al.airline_code,
        al.country as airline_country,
        at.model_name,
        at.manufacturer,
        at.seat_capacity as type_seat_capacity,
        ap.airport_name as current_airport_name,
        ap.airport_code as current_airport_code,
        ap.city as current_airport_city
      FROM Aircraft a
      LEFT JOIN Airline al ON a.airline_id = al.airline_id
      LEFT JOIN Aircraft_types at ON a.aircraft_type_id = at.aircraft_type_id
      LEFT JOIN Airport ap ON a.current_airport = ap.airport_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (airline_id) {
      sql += ' AND a.airline_id = ?';
      params.push(parseInt(airline_id));
    }
    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    }
    if (current_airport) {
      sql += ' AND a.current_airport = ?';
      params.push(parseInt(current_airport));
    }
    if (aircraft_type_id) {
      sql += ' AND a.aircraft_type_id = ?';
      params.push(parseInt(aircraft_type_id));
    }

    sql += ' ORDER BY a.aircraft_id DESC';

    const aircraft = await query(sql, params);

    return successResponse(aircraft, 'Aircraft retrieved successfully');
  } catch (error: any) {
    console.error('Get aircraft error:', error);
    return errorResponse('Failed to retrieve aircraft: ' + error.message, 500);
  }
}

// ========== POST /api/aircraft - Create aircraft ==========
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = validateData(aircraftCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data!;

    // Verify airline exists
    const airline = await queryOne(
      'SELECT airline_id FROM Airline WHERE airline_id = ?',
      [data.airline_id]
    );
    if (!airline) {
      return errorResponse('Airline not found', 404);
    }

    // Verify aircraft type exists
    const aircraftType = await queryOne(
      'SELECT aircraft_type_id FROM Aircraft_types WHERE aircraft_type_id = ?',
      [data.aircraft_type_id]
    );
    if (!aircraftType) {
      return errorResponse('Aircraft type not found', 404);
    }

    // Verify airport exists
    const airport = await queryOne(
      'SELECT airport_id FROM Airport WHERE airport_id = ?',
      [data.current_airport]
    );
    if (!airport) {
      return errorResponse('Airport not found', 404);
    }

    // Check registration number uniqueness
    const regExists = await queryOne(
      'SELECT aircraft_id FROM Aircraft WHERE registration_number = ?',
      [data.registration_number]
    );
    if (regExists) {
      return errorResponse('Registration number already exists', 409);
    }

    const result = await query<any>(
      `INSERT INTO Aircraft (
        airline_id,
        aircraft_type_id,
        registration_number,
        status,
        economy_seats,
        business_seats,
        first_class_seats,
        max_speed_kmh,
        fuel_capacity_litres,
        manufactered_date,
        latest_maintenance,
        next_maintenance_due,
        current_airport
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.airline_id,
        data.aircraft_type_id,
        data.registration_number,
        data.status ?? 'Active',
        data.economy_seats,
        data.business_seats,
        data.first_class_seats,
        data.max_speed_kmh,
        data.fuel_capacity_litres,
        data.manufactered_date,
        data.latest_maintenance ?? null,
        data.next_maintenance_due ?? null,
        data.current_airport,
      ]
    );

    const newAircraft = await queryOne(
      `SELECT 
        a.*,
        al.airline_name,
        al.airline_code,
        al.country as airline_country,
        at.model_name,
        at.manufacturer,
        at.seat_capacity as type_seat_capacity,
        ap.airport_name as current_airport_name,
        ap.airport_code as current_airport_code,
        ap.city as current_airport_city
      FROM Aircraft a
      LEFT JOIN Airline al ON a.airline_id = al.airline_id
      LEFT JOIN Aircraft_types at ON a.aircraft_type_id = at.aircraft_type_id
      LEFT JOIN Airport ap ON a.current_airport = ap.airport_id
      WHERE a.aircraft_id = ?`,
      [result.insertId]
    );

    return createdResponse(newAircraft, 'Aircraft created successfully');
  } catch (error: any) {
    console.error('Create aircraft error:', error);
    return errorResponse('Failed to create aircraft: ' + error.message, 500);
  }
}