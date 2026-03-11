import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, AuthUser } from './auth';
import { errorResponse } from './response';

export interface AuthenticatedRequest extends NextRequest {
  user?: AuthUser;
}

// Authentication middleware - verifies JWT token
export function authenticate(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return async (req: AuthenticatedRequest): Promise<NextResponse> => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.get('authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return errorResponse('No token provided. Please login first.', 401);
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      // Verify token
      const user = verifyToken(token);
      
      if (!user) {
        return errorResponse('Invalid or expired token. Please login again.', 401);
      }

      // Attach user to request
      req.user = user;

      // Call the actual handler
      return handler(req);
    } catch (error: any) {
      console.error('Authentication error:', error);
      return errorResponse('Authentication failed: ' + error.message, 401);
    }
  };
}

// Authorization middleware - checks user role
export function authorize(...allowedRoles: Array<'Admin' | 'Staff' | 'Customer'>) {
  return (handler: (req: AuthenticatedRequest) => Promise<NextResponse>) => {
    return authenticate(async (req: AuthenticatedRequest): Promise<NextResponse> => {
      const user = req.user;

      if (!user) {
        return errorResponse('Unauthorized', 401);
      }

      // Check if user role is allowed
      if (!allowedRoles.includes(user.role)) {
        return errorResponse(
          `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${user.role}`,
          403
        );
      }

      // Call the actual handler
      return handler(req);
    });
  };
}

// Convenience functions for common role checks
export const requireAdmin = authorize('Admin');
export const requireStaff = authorize('Admin', 'Staff');
export const requireAuth = authenticate;