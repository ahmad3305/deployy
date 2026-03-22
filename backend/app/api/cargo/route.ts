import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { cargoCreateSchema, validateData } from '@/lib/validations';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const flight_id = searchParams.get('flight_id');
    const origin_airport_id = searchParams.get('origin_airport_id');
    const destination_airport_id = searchParams.get('destination_airport_id');
    const status = searchParams.get('status');
    const tracking_number = searchParams.get('tracking_number');
    const cargo_type = searchParams.get('cargo_type');

    let sql = `
      SELECT 
        c.*,
        f.flight_number,
        al.airline_name,
        al.airline_code,
        origin.airport_name as origin_airport_name,
        origin.airport_code as origin_airport_code,
        origin.city as origin_city,
        origin.country as origin_country,
        dest.airport_name as destination_airport_name,
        dest.airport_code as destination_airport_code,
        dest.city as destination_city,
        dest.country as destination_country
      FROM Cargo c
      LEFT JOIN Flights f ON c.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport origin ON c.origin_airport_id = origin.airport_id
      LEFT JOIN Airport dest ON c.destination_airport_id = dest.airport_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (flight_id) {
      sql += ' AND c.flight_id = ?';
      params.push(parseInt(flight_id));
    }

    if (origin_airport_id) {
      sql += ' AND c.origin_airport_id = ?';
      params.push(parseInt(origin_airport_id));
    }

    if (destination_airport_id) {
      sql += ' AND c.destination_airport_id = ?';
      params.push(parseInt(destination_airport_id));
    }

    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    }

    if (tracking_number) {
      sql += ' AND c.tracking_number = ?';
      params.push(tracking_number);
    }

    if (cargo_type) {
      sql += ' AND c.cargo_type = ?';
      params.push(cargo_type);
    }

    sql += ' ORDER BY c.cargo_id DESC';

    const cargo = await query(sql, params);

    return successResponse(cargo, 'Cargo retrieved successfully');
  } catch (error: any) {
    console.error('Get cargo error:', error);
    return errorResponse('Failed to retrieve cargo: ' + error.message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = validateData(cargoCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data!;

    const flight = await queryOne(
      'SELECT * FROM Flights WHERE flight_id = ?',
      [data.flight_id]
    );

    if (!flight) {
      return errorResponse('Flight not found', 404);
    }

    const originAirport = await queryOne(
      'SELECT airport_id FROM Airport WHERE airport_id = ?',
      [data.origin_airport_id]
    );

    if (!originAirport) {
      return errorResponse('Origin airport not found', 404);
    }

    const destAirport = await queryOne(
      'SELECT airport_id FROM Airport WHERE airport_id = ?',
      [data.destination_airport_id]
    );

    if (!destAirport) {
      return errorResponse('Destination airport not found', 404);
    }

    if (data.origin_airport_id === data.destination_airport_id) {
      return errorResponse('Origin and destination airports must be different', 400);
    }

    if (data.weight_kg <= 0) {
      return errorResponse('Weight must be greater than 0', 400);
    }

    const existingTracking = await queryOne(
      'SELECT cargo_id FROM Cargo WHERE tracking_number = ?',
      [data.tracking_number]
    );

    if (existingTracking) {
      return errorResponse('Tracking number already exists', 409);
    }

    const result = await query<any>(
      `INSERT INTO Cargo (
        flight_id, tracking_number, cargo_type, description, weight_kg,
        origin_airport_id, destination_airport_id, 
        sender_name, sender_contact, reciever_name, reciever_contact,
        status, is_insured
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Booked', ?)`,
      [
        data.flight_id,
        data.tracking_number,
        data.cargo_type,
        data.description || null,
        data.weight_kg,
        data.origin_airport_id,
        data.destination_airport_id,
        data.sender_name,
        data.sender_contact,
        data.reciever_name,
        data.reciever_contact,
        data.is_insured || false
      ]
    );

    const newCargo = await queryOne(
      `SELECT 
        c.*,
        f.flight_number,
        al.airline_name,
        al.airline_code,
        origin.airport_name as origin_airport_name,
        origin.airport_code as origin_airport_code,
        origin.city as origin_city,
        dest.airport_name as destination_airport_name,
        dest.airport_code as destination_airport_code,
        dest.city as destination_city
      FROM Cargo c
      LEFT JOIN Flights f ON c.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport origin ON c.origin_airport_id = origin.airport_id
      LEFT JOIN Airport dest ON c.destination_airport_id = dest.airport_id
      WHERE c.cargo_id = ?`,
      [result.insertId]
    );

    return createdResponse(newCargo, 'Cargo shipment created successfully');
  } catch (error: any) {
    console.error('Create cargo error:', error);
    return errorResponse('Failed to create cargo shipment: ' + error.message, 500);
  }
}