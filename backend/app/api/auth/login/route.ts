export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { comparePassword, generateToken } from '@/lib/auth';
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/response';
import { userLoginSchema, validateData } from '@/lib/validations';

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

    const validation = validateData(userLoginSchema, body);
    if (!validation.success) {
      return withCORS(validationErrorResponse(validation.errors || []));
    }

    const { email, password } = validation.data!;

    const user = await queryOne<any>(
      `SELECT 
        u.*,
        s.first_name  AS staff_first_name,
        s.last_name   AS staff_last_name,
        s.role        AS staff_role,
        p.first_name  AS passenger_first_name,
        p.last_name   AS passenger_last_name
      FROM Users u
      LEFT JOIN Staff      s ON u.staff_id     = s.staff_id
      LEFT JOIN Passengers p ON u.passenger_id = p.passenger_id
      WHERE u.email = ?`,
      [email]
    );

    if (!user) {
      return withCORS(errorResponse('Invalid email or password', 401));
    }
    if (!user.is_active) {
      return withCORS(errorResponse('Account is deactivated. Please contact support.', 403));
    }

    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      return withCORS(errorResponse('Invalid email or password', 401));
    }

    // Resolve display name across all three roles
    const name =
      user.staff_first_name
        ? `${user.staff_first_name} ${user.staff_last_name}`
        : user.passenger_first_name
        ? `${user.passenger_first_name} ${user.passenger_last_name}`
        : user.email.split('@')[0]; // fallback for standalone Admin

    const token = generateToken({
      user_id:      user.user_id,
      email:        user.email,
      contact:      user.contact,
      role:         user.role,
      passenger_id: user.passenger_id,
      staff_id:     user.staff_id,
    });

    return withCORS(
      successResponse(
        {
          token,
          user: {
            user_id:      user.user_id,
            email:        user.email,
            contact:      user.contact,
            role:         user.role,          // 'Admin' | 'Staff' | 'Customer'
            passenger_id: user.passenger_id,
            staff_id:     user.staff_id,
            name,
            staff_role:   user.staff_role,   // e.g. 'Manager', 'Security', etc.
          },
        },
        'Login successful'
      )
    );
  } catch (error: any) {
    console.error('Login error:', error);
    return withCORS(errorResponse('Login failed: ' + error.message, 500));
  }
}

function withCORS(resp: Response) {
  resp.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  return resp;
}