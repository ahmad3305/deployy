import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, AuthUser } from './auth';
import { errorResponse } from './response';

export interface AuthenticatedRequest extends NextRequest {
  user?: AuthUser;
}

// Generic context type for Next.js route handlers
type RouteContext = { params?: Record<string, string> };

// Authentication middleware - verifies JWT token
export function authenticate(
  handler: (req: AuthenticatedRequest, ctx?: RouteContext) => Promise<NextResponse>
) {
  return async (req: NextRequest, ctx?: RouteContext): Promise<NextResponse> => {
    try {
      const authHeader = req.headers.get('authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return errorResponse('No token provided. Please login first.', 401);
      }

      const token = authHeader.substring(7);

      const user = verifyToken(token);

      if (!user) {
        return errorResponse('Invalid or expired token. Please login again.', 401);
      }

      // Attach user to request
      (req as AuthenticatedRequest).user = user;

      // Call the actual handler, forwarding ctx
      return handler(req as AuthenticatedRequest, ctx);
    } catch (error: any) {
      console.error('Authentication error:', error);
      return errorResponse('Authentication failed: ' + error.message, 401);
    }
  };
}

// Authorization middleware - checks user role
export function authorize(...allowedRoles: Array<'Admin' | 'Staff' | 'Customer'>) {
  return (
    handler: (req: AuthenticatedRequest, ctx?: RouteContext) => Promise<NextResponse>
  ) => {
    return authenticate(async (req: AuthenticatedRequest, ctx?: RouteContext) => {
      const user = req.user;

      if (!user) {
        return errorResponse('Unauthorized', 401);
      }

      if (!allowedRoles.includes(user.role)) {
        return errorResponse(
          `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${user.role}`,
          403
        );
      }

      return handler(req, ctx);
    });
  };
}

export const requireAdmin = authorize('Admin');
export const requireStaff = authorize('Admin', 'Staff');
export const requireAuth = authenticate;