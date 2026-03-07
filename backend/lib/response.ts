import { NextResponse } from 'next/server';

// Success response
export function successResponse(data: any, message: string = 'Success', statusCode: number = 200) {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
    },
    { status: statusCode }
  );
}

// Error response
export function errorResponse(message: string, statusCode: number = 400, errors?: any) {
  return NextResponse.json(
    {
      success: false,
      message,
      ...(errors && { errors }),
    },
    { status: statusCode }
  );
}

// Created response (for POST requests)
export function createdResponse(data: any, message: string = 'Created successfully') {
  return successResponse(data, message, 201);
}

// No content response (for DELETE requests)
export function noContentResponse() {
  return new NextResponse(null, { status: 204 });
}

// Unauthorized response
export function unauthorizedResponse(message: string = 'Unauthorized') {
  return errorResponse(message, 401);
}

// Forbidden response
export function forbiddenResponse(message: string = 'Forbidden') {
  return errorResponse(message, 403);
}

// Not found response
export function notFoundResponse(message: string = 'Resource not found') {
  return errorResponse(message, 404);
}

// Validation error response
export function validationErrorResponse(errors: any) {
  return errorResponse('Validation failed', 422, errors);
}

// Internal server error response
export function serverErrorResponse(message: string = 'Internal server error') {
  return errorResponse(message, 500);
}