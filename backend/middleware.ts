import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Set your allowed origin for development and replace for production deployment.
const allowedOrigin = 'http://localhost:3001';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle CORS preflight globally
  if (request.method === 'OPTIONS' && pathname.startsWith('/api')) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Skip auth routes
  if (pathname.startsWith('/api/auth/')) {
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Max-Age', '86400');
    return response;
  }

  // Skip non-API routes
  if (!pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Public GET routes - no auth needed
  const publicGetRoutes = [
    '/api/airports',
    '/api/airlines',
    '/api/aircraft-types',
    '/api/flights',
    '/api/flight-schedules',
    '/api/terminals',
    '/api/gates',
    '/api/runways',
  ];

  const isPublicGet =
    publicGetRoutes.some(route => pathname.startsWith(route)) &&
    request.method === 'GET';

  if (isPublicGet) {
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Max-Age', '86400');
    return response;
  }

  // For all other routes, require Bearer token
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new NextResponse(
      JSON.stringify({ success: false, message: 'Authentication required' }),
      {
        status: 401,
        headers: {
          'Access-Control-Allow-Origin': allowedOrigin,
          'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Authenticated route: set CORS headers on successful response
  const response = NextResponse.next();
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

export const config = {
  matcher: '/api/:path*',
};