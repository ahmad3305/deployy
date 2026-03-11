export const runtime = 'nodejs'; // Add this line at the top

import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';
import { successResponse, errorResponse, createdResponse } from '@/lib/response';

export async function POST(request: NextRequest) {
  try {
    const { email, password, role, passenger_id, staff_id } = await request.json();

    // Validate input
    if (!email || !password) {
      return errorResponse('Email and password are required', 400);
    }

    if (password.length < 6) {
      return errorResponse('Password must be at least 6 characters', 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse('Invalid email format', 400);
    }

    // Check if user already exists
    const existingUser = await queryOne(
      'SELECT user_id FROM Users WHERE email = ?',
      [email]
    );

    if (existingUser) {
      return errorResponse('User with this email already exists', 409);
    }

    // Verify passenger_id if provided
    if (passenger_id) {
      const passenger = await queryOne(
        'SELECT passenger_id FROM Passengers WHERE passenger_id = ?',
        [passenger_id]
      );
      if (!passenger) {
        return errorResponse('Passenger not found', 404);
      }
    }

    // Verify staff_id if provided
    if (staff_id) {
      const staff = await queryOne(
        'SELECT staff_id FROM Staff WHERE staff_id = ?',
        [staff_id]
      );
      if (!staff) {
        return errorResponse('Staff member not found', 404);
      }
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Determine role (default to Customer)
    const userRole = role && ['Admin', 'Staff', 'Customer'].includes(role) ? role : 'Customer';

    // Insert user
    const result = await query<any>(
      `INSERT INTO Users (email, password_hash, role, passenger_id, staff_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [email, password_hash, userRole, passenger_id || null, staff_id || null]
    );

    // Generate token
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