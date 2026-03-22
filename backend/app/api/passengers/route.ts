import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { passengerCreateSchema, validateData } from '@/lib/validations';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const passport_number = searchParams.get('passport_number');
    const nationality = searchParams.get('nationality');
    const search = searchParams.get('search'); 

    let sql = 'SELECT * FROM Passengers WHERE 1=1';
    const params: any[] = [];

    if (email) {
      sql += ' AND email = ?';
      params.push(email);
    }

    if (passport_number) {
      sql += ' AND passport_number = ?';
      params.push(passport_number);
    }

    if (nationality) {
      sql += ' AND nationality = ?';
      params.push(nationality);
    }

    if (search) {
      sql += ' AND (first_name LIKE ? OR last_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY last_name ASC, first_name ASC';

    const passengers = await query(sql, params);

    return successResponse(passengers, 'Passengers retrieved successfully');
  } catch (error: any) {
    console.error('Get passengers error:', error);
    return errorResponse('Failed to retrieve passengers: ' + error.message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = validateData(passengerCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data!;

    const existingEmail = await queryOne(
      'SELECT passenger_id FROM Passengers WHERE email = ?',
      [data.email]
    );

    if (existingEmail) {
      return errorResponse('Email already exists', 409);
    }

    const existingPassport = await queryOne(
      'SELECT passenger_id FROM Passengers WHERE passport_number = ?',
      [data.passport_number]
    );

    if (existingPassport) {
      return errorResponse('Passport number already exists', 409);
    }

    const result = await query<any>(
      `INSERT INTO Passengers (
        first_name, last_name, gender, passport_number, 
        nationality, date_of_birth, contact_number, email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.first_name,
        data.last_name,
        data.gender,
        data.passport_number,
        data.nationality,
        data.date_of_birth,
        data.contact_number,
        data.email
      ]
    );

    const newPassenger = await queryOne(
      'SELECT * FROM Passengers WHERE passenger_id = ?',
      [result.insertId]
    );

    return createdResponse(newPassenger, 'Passenger created successfully');
  } catch (error: any) {
    console.error('Create passenger error:', error);
    return errorResponse('Failed to create passenger: ' + error.message, 500);
  }
}