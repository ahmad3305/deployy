export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, withTransaction } from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';
import { createdResponse, errorResponse } from '@/lib/response';

const allowedOrigin = 'http://localhost:3001';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      password,
      role,
      staff_id,
      first_name,
      last_name,
      gender,
      passport_number,
      nationality,
      date_of_birth,
      contact_number,
    } = body;

    // --- Basic validation ---
    if (!email || !password) {
      return withCORS(errorResponse('Email and password are required', 400));
    }
    if (password.length < 6) {
      return withCORS(errorResponse('Password must be at least 6 characters', 400));
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return withCORS(errorResponse('Invalid email format', 400));
    }

    const existingUser = await queryOne('SELECT user_id FROM Users WHERE email = ?', [email]);
    if (existingUser) {
      return withCORS(errorResponse('User with this email already exists', 409));
    }

    const userRole = role && ['Admin', 'Staff', 'Customer'].includes(role) ? role : 'Customer';
    const password_hash = await hashPassword(password);

    // ================================================================
    // CUSTOMER REGISTRATION
    // ================================================================
    if (userRole === 'Customer') {
      const missing: string[] = [];
      if (!first_name)      missing.push('first_name');
      if (!last_name)       missing.push('last_name');
      if (!gender)          missing.push('gender');
      if (!passport_number) missing.push('passport_number');
      if (!nationality)     missing.push('nationality');
      if (!date_of_birth)   missing.push('date_of_birth');
      if (!contact_number)  missing.push('contact_number');

      if (missing.length > 0) {
        return withCORS(errorResponse(`Missing required fields: ${missing.join(', ')}`, 400));
      }

      if (gender !== 'male' && gender !== 'female') {
        return withCORS(errorResponse("gender must be 'male' or 'female'", 400));
      }

      const existingPassport = await queryOne(
        'SELECT passenger_id FROM Passengers WHERE passport_number = ?',
        [passport_number]
      );
      if (existingPassport) {
        return withCORS(errorResponse('A passenger with this passport number already exists', 409));
      }

      const result = await withTransaction(async (conn) => {
        const [passInsert]: any = await conn.execute(
          `INSERT INTO Passengers 
            (first_name, last_name, gender, passport_number, nationality, date_of_birth, contact_number, email)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [first_name, last_name, gender, passport_number, nationality, date_of_birth, contact_number, email]
        );
        const newPassengerId = passInsert.insertId;

        const [userInsert]: any = await conn.execute(
          `INSERT INTO Users (email, contact, password_hash, role, passenger_id, staff_id)
           VALUES (?, ?, ?, 'Customer', ?, NULL)`,
          [email, contact_number, password_hash, newPassengerId]
        );
        const newUserId = userInsert.insertId;

        return { newUserId, newPassengerId };
      });

      const token = generateToken({
        user_id: result.newUserId,
        email,
        contact: contact_number,
        role: 'Customer',
        passenger_id: result.newPassengerId,
        staff_id: null,
      });

      return withCORS(
        createdResponse(
          {
            token,
            user: {
              user_id: result.newUserId,
              email,
              contact: contact_number,
              role: 'Customer',
              passenger_id: result.newPassengerId,
              staff_id: null,
              name: `${first_name} ${last_name}`,
            },
          },
          'Registration successful'
        )
      );
    }

    // ================================================================
    // STAFF / ADMIN REGISTRATION
    // ================================================================
    if (userRole === 'Staff' || userRole === 'Admin') {
      // staff_id must reference an existing Staff record
      if (!staff_id) {
        return withCORS(
          errorResponse('staff_id is required when registering as Staff or Admin', 400)
        );
      }

      const staffRecord = await queryOne<any>(
        'SELECT staff_id, first_name, last_name, contact_number FROM Staff WHERE staff_id = ?',
        [staff_id]
      );
      if (!staffRecord) {
        return withCORS(errorResponse('Staff member not found with the given staff_id', 404));
      }

      // Make sure this staff_id isn't already linked to a user account
      const existingLink = await queryOne(
        'SELECT user_id FROM Users WHERE staff_id = ?',
        [staff_id]
      );
      if (existingLink) {
        return withCORS(
          errorResponse('This staff member already has a linked user account', 409)
        );
      }

      const staffContact = staffRecord.contact_number ?? null;

      const [userInsert]: any = await query(
        `INSERT INTO Users (email, contact, password_hash, role, passenger_id, staff_id)
         VALUES (?, ?, ?, ?, NULL, ?)`,
        [email, staffContact, password_hash, userRole, staff_id]
      );

      const newUserId = userInsert.insertId;

      const token = generateToken({
        user_id: newUserId,
        email,
        contact: staffContact,
        role: userRole,
        passenger_id: null,
        staff_id,
      });

      return withCORS(
        createdResponse(
          {
            token,
            user: {
              user_id: newUserId,
              email,
              contact: staffContact,
              role: userRole,
              passenger_id: null,
              staff_id,
              name: `${staffRecord.first_name} ${staffRecord.last_name}`,
            },
          },
          'Registration successful'
        )
      );
    }

    // Should never reach here
    return withCORS(errorResponse('Invalid role specified', 400));

  } catch (error: any) {
    console.error('Registration error:', error);
    return withCORS(errorResponse('Registration failed: ' + error.message, 500));
  }
}

function withCORS(resp: Response) {
  resp.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  return resp;
}