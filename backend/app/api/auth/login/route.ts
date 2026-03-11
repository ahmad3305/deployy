export const runtime = 'nodejs'; // Add this line at the top

import { NextRequest } from 'next/server';
import { queryOne } from '@/lib/db';
import { comparePassword, generateToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return errorResponse('Email and password are required', 400);
    }

    // Find user with related staff/passenger info
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
      return errorResponse('Invalid email or password', 401);
    }

    // Check if user is active
    if (!user.is_active) {
      return errorResponse('Account is deactivated. Please contact support.', 403);
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password_hash);

    if (!isValidPassword) {
      return errorResponse('Invalid email or password', 401);
    }

    // Generate token
    const token = generateToken({
      user_id: user.user_id,
      email: user.email,
      role: user.role,
      passenger_id: user.passenger_id,
      staff_id: user.staff_id,
    });

    return successResponse(
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
    );
  } catch (error: any) {
    console.error('Login error:', error);
    return errorResponse('Login failed: ' + error.message, 500);
  }
}