export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { comparePassword, generateToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';

const allowedOrigin = 'http://localhost:3001'; // Make sure this matches your frontend port

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
    const { email, password } = await request.json();

    if (!email || !password) {
      return withCORS(errorResponse('Email and password are required', 400));
    }

    const user = await queryOne<any>(
      `SELECT 
        u.*,
        s.first_name as staff_first_name,
        s.last_name as staff_last_name,
        s.role as staff_role,
        p.first_name as passenger_first_name,
        p.last_name as passenger_last_name
      FROM Users u
      LEFT JOIN Staff s ON u.staff_id = s.staff_id
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

    const token = generateToken({
      user_id: user.user_id,
      email: user.email,
      role: user.role,
      passenger_id: user.passenger_id,
      staff_id: user.staff_id,
    });

    return withCORS(successResponse(
      {
        token,
        user: {
          user_id: user.user_id,
          email: user.email,
          role: user.role,
          passenger_id: user.passenger_id,
          staff_id: user.staff_id,
          name: user.staff_first_name 
            ? `${user.staff_first_name} ${user.staff_last_name}` 
            : user.passenger_first_name 
            ? `${user.passenger_first_name} ${user.passenger_last_name}`
            : null,
          staff_role: user.staff_role,
        },
      },
      'Login successful'
    ));
  } catch (error: any) {
    console.error('Login error:', error);
    return withCORS(errorResponse('Login failed: ' + error.message, 500));
  }
}

function withCORS(resp: Response) {
  resp.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  return resp;
}