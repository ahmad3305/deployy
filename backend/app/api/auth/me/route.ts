export const runtime = 'nodejs'; // Add this line at the top

import { NextRequest } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { successResponse, errorResponse } from '@/lib/response';
import { queryOne } from '@/lib/db';

async function handler(req: AuthenticatedRequest) {
  try {
    const user = req.user!;

    // Get full user details with staff/passenger info
    const userDetails = await queryOne(
      `SELECT 
        u.user_id, u.email, u.role, u.passenger_id, u.staff_id, u.is_active, u.created_at,
        s.first_name as staff_first_name,
        s.last_name as staff_last_name,
        s.role as staff_role,
        s.staff_type,
        s.status as staff_status,
        p.first_name as passenger_first_name,
        p.last_name as passenger_last_name,
        p.passport_number
      FROM Users u
      LEFT JOIN Staff s ON u.staff_id = s.staff_id
      LEFT JOIN Passengers p ON u.passenger_id = p.passenger_id
      WHERE u.user_id = ?`,
      [user.user_id]
    );

    return successResponse(userDetails, 'User details retrieved successfully');
  } catch (error: any) {
    console.error('Get user details error:', error);
    return errorResponse('Failed to get user details: ' + error.message, 500);
  }
}

export const GET = requireAuth(handler);