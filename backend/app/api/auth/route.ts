import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { generateToken, verifyToken } from '@/lib/auth';
import { successResponse, errorResponse, createdResponse, unauthorizedResponse } from '@/lib/response';

// Define the shape of our decoded token
interface DecodedToken {
  userId: number;
  email: string;
  userType?: string;
}

// ========== POST /api/auth - Login (Simple - by email or passport) ==========
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, passport_number } = body;

    // ========== LOGIN (Simple - no password) ==========
    if (action === 'login') {
      // Validate required fields
      if (!email && !passport_number) {
        return errorResponse('Email or passport number is required', 400);
      }

      // Find passenger by email or passport
      let passenger;
      if (email) {
        passenger = await queryOne<any>(
          'SELECT * FROM Passengers WHERE email = ?',
          [email]
        );
      } else if (passport_number) {
        passenger = await queryOne<any>(
          'SELECT * FROM Passengers WHERE passport_number = ?',
          [passport_number]
        );
      }

      if (!passenger) {
        return unauthorizedResponse('Passenger not found');
      }

      // Generate token
      const token = generateToken({
        userId: passenger.passenger_id,
        email: passenger.email,
        userType: 'passenger'
      });

      return successResponse(
        {
          token,
          user: {
            passenger_id: passenger.passenger_id,
            email: passenger.email,
            first_name: passenger.first_name,
            last_name: passenger.last_name,
            passport_number: passenger.passport_number,
            nationality: passenger.nationality,
            userType: 'passenger'
          }
        },
        'Login successful'
      );
    }

    // ========== REFRESH TOKEN ==========
    if (action === 'refresh') {
      const { token } = body;

      if (!token) {
        return errorResponse('Token is required', 400);
      }

      const decoded = verifyToken(token) as DecodedToken | null;

      if (!decoded) {
        return unauthorizedResponse('Invalid or expired token');
      }

      // Generate new token
      const newToken = generateToken({
        userId: decoded.userId,
        email: decoded.email,
        userType: decoded.userType || 'passenger'
      });

      return successResponse({ token: newToken }, 'Token refreshed successfully');
    }

    // ========== VERIFY TOKEN ==========
    if (action === 'verify') {
      const { token } = body;

      if (!token) {
        return errorResponse('Token is required', 400);
      }

      const decoded = verifyToken(token) as DecodedToken | null;

      if (!decoded) {
        return unauthorizedResponse('Invalid or expired token');
      }

      // Get user details
      const passenger = await queryOne<any>(
        'SELECT passenger_id, email, first_name, last_name, passport_number, nationality, date_of_birth, contact_number, gender FROM Passengers WHERE passenger_id = ?',
        [decoded.userId]
      );

      if (!passenger) {
        return unauthorizedResponse('User not found');
      }

      return successResponse(
        {
          user: {
            passenger_id: passenger.passenger_id,
            email: passenger.email,
            first_name: passenger.first_name,
            last_name: passenger.last_name,
            passport_number: passenger.passport_number,
            nationality: passenger.nationality,
            userType: 'passenger'
          }
        },
        'Token is valid'
      );
    }

    return errorResponse('Invalid action. Use "login", "refresh", or "verify"', 400);

  } catch (error: any) {
    console.error('Auth error:', error);
    return errorResponse('Authentication failed: ' + error.message, 500);
  }
}

// ========== GET /api/auth - Get Current User ==========
export async function GET(request: NextRequest) {
  try {
    // Get token from cookie
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return unauthorizedResponse('No token provided');
    }

    const decoded = verifyToken(token) as DecodedToken | null;

    if (!decoded) {
      return unauthorizedResponse('Invalid token');
    }

    // Get passenger details
    const passenger = await queryOne<any>(
      'SELECT passenger_id, email, first_name, last_name, passport_number, nationality, date_of_birth, contact_number, gender, created_at FROM Passengers WHERE passenger_id = ?',
      [decoded.userId]
    );

    if (!passenger) {
      return unauthorizedResponse('User not found');
    }

    return successResponse(passenger, 'User retrieved successfully');

  } catch (error: any) {
    console.error('Get user error:', error);
    return errorResponse('Failed to get user: ' + error.message, 500);
  }
}