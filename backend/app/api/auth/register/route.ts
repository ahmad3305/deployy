export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { query, queryOne, withTransaction } from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';
import { createdResponse, errorResponse } from '@/lib/response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      email,
      password,
      role,

      passenger_id,
      staff_id,

      first_name,
      last_name,
      gender,
      passport_number,
      nationality,
      date_of_birth,
      contact_number,
    } = body;

    if (!email || !password) {
      return errorResponse('Email and password are required', 400);
    }

    if (password.length < 6) {
      return errorResponse('Password must be at least 6 characters', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse('Invalid email format', 400);
    }

    const existingUser = await queryOne('SELECT user_id FROM Users WHERE email = ?', [email]);
    if (existingUser) {
      return errorResponse('User with this email already exists', 409);
    }

    const userRole = role && ['Admin', 'Staff', 'Customer'].includes(role) ? role : 'Customer';

    if (staff_id) {
      const staff = await queryOne('SELECT staff_id FROM Staff WHERE staff_id = ?', [staff_id]);
      if (!staff) return errorResponse('Staff member not found', 404);
    }

    if (userRole !== 'Customer' && passenger_id) {
      const passenger = await queryOne('SELECT passenger_id FROM Passengers WHERE passenger_id = ?', [passenger_id]);
      if (!passenger) return errorResponse('Passenger not found', 404);
    }

    if (userRole === 'Customer') {
      if (passenger_id) {
        return errorResponse('Do not provide passenger_id when registering as Customer', 400);
      }

      const missing: string[] = [];
      if (!first_name) missing.push('first_name');
      if (!last_name) missing.push('last_name');
      if (!gender) missing.push('gender');
      if (!passport_number) missing.push('passport_number');
      if (!nationality) missing.push('nationality');
      if (!date_of_birth) missing.push('date_of_birth');
      if (!contact_number) missing.push('contact_number');

      if (missing.length > 0) {
        return errorResponse(`Missing required passenger fields: ${missing.join(', ')}`, 400);
      }

      if (gender !== 'male' && gender !== 'female') {
        return errorResponse("gender must be 'male' or 'female'", 400);
      }

      const existingPassengerEmail = await queryOne(
        'SELECT passenger_id FROM Passengers WHERE email = ?',
        [email]
      );
      if (existingPassengerEmail) {
        return errorResponse('Passenger with this email already exists', 409);
      }

      const existingPassengerPassport = await queryOne(
        'SELECT passenger_id FROM Passengers WHERE passport_number = ?',
        [passport_number]
      );
      if (existingPassengerPassport) {
        return errorResponse('Passenger with this passport number already exists', 409);
      }

      const password_hash = await hashPassword(password);

      const result = await withTransaction(async (conn) => {
        const [passInsert]: any = await conn.execute(
          `INSERT INTO Passengers (
            first_name, last_name, gender, passport_number,
            nationality, date_of_birth, contact_number, email
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            first_name,
            last_name,
            gender,
            passport_number,
            nationality,
            date_of_birth,
            contact_number,
            email, 
          ]
        );

        const newPassengerId = passInsert.insertId;

        const [userInsert]: any = await conn.execute(
          `INSERT INTO Users (email, password_hash, role, passenger_id, staff_id)
           VALUES (?, ?, ?, ?, ?)`,
          [email, password_hash, 'Customer', newPassengerId, null]
        );

        const newUserId = userInsert.insertId;

        return { newUserId, newPassengerId };
      });

      const token = generateToken({
        user_id: result.newUserId,
        email,
        role: 'Customer',
        passenger_id: result.newPassengerId,
        staff_id: null,
      });

      return createdResponse(
        {
          token,
          user: {
            user_id: result.newUserId,
            email,
            role: 'Customer',
            passenger_id: result.newPassengerId,
            staff_id: null,
          },
        },
        'Registration successful'
      );
    }

    
    if (userRole === 'Staff' || userRole === 'Admin') {
      
    }

    const password_hash = await hashPassword(password);

    const result = await query<any>(
      `INSERT INTO Users (email, password_hash, role, passenger_id, staff_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [email, password_hash, userRole, passenger_id || null, staff_id || null]
    );

    const token = generateToken({
      user_id: result.insertId,
      email,
      role: userRole,
      passenger_id: passenger_id || null,
      staff_id: staff_id || null,
    });

    return createdResponse(
      {
        token,
        user: {
          user_id: result.insertId,
          email,
          role: userRole,
          passenger_id: passenger_id || null,
          staff_id: staff_id || null,
        },
      },
      'Registration successful'
    );
  } catch (error: any) {
    console.error('Registration error:', error);
    return errorResponse('Registration failed: ' + error.message, 500);
  }
}