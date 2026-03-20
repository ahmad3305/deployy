import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth routes
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // Skip non-API routes
  if (!pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Public GET routes - no auth needed
  const publicGetRoutes = [
    '/api/passengers',
    '/api/airports',
    '/api/airlines',
    '/api/aircraft-types',
    '/api/flights',
    '/api/flight-schedules',
    '/api/terminals',
    '/api/gates',
    '/api/runways',
  ];


  const isPublicGet = publicGetRoutes.some(route => pathname.startsWith(route)) 
                      && request.method === 'GET';
  
  if (isPublicGet) {
    return NextResponse.next();
  }

  // For all other routes, require token (route handlers check roles)
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, message: 'Authentication required' },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};