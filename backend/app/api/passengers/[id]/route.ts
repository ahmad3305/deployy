import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { passengerUpdateSchema, validateData } from '@/lib/validations';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const passengerId = parseInt(params.id);

    if (isNaN(passengerId)) {
      return errorResponse('Invalid passenger ID', 400);
    }

    const passenger = await queryOne(
      'SELECT * FROM Passengers WHERE passenger_id = ?',
      [passengerId]
    );

    if (!passenger) {
      return notFoundResponse('Passenger not found');
    }

    return successResponse(passenger, 'Passenger retrieved successfully');
  } catch (error: any) {
    console.error('Get passenger error:', error);
    return errorResponse('Failed to retrieve passenger: ' + error.message, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const passengerId = parseInt(params.id);

    if (isNaN(passengerId)) {
      return errorResponse('Invalid passenger ID', 400);
    }

    const existing = await queryOne(
      'SELECT * FROM Passengers WHERE passenger_id = ?',
      [passengerId]
    );

    if (!existing) {
      return notFoundResponse('Passenger not found');
    }

    const body = await request.json();

    const validation = validateData(passengerUpdateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const updateData = validation.data!;

    if (updateData.email && updateData.email !== (existing as any).email) {
      const emailExists = await queryOne(
        'SELECT passenger_id FROM Passengers WHERE email = ? AND passenger_id != ?',
        [updateData.email, passengerId]
      );

      if (emailExists) {
        return errorResponse('Email already exists', 409);
      }
    }

    if (updateData.passport_number && updateData.passport_number !== (existing as any).passport_number) {
      const passportExists = await queryOne(
        'SELECT passenger_id FROM Passengers WHERE passport_number = ? AND passenger_id != ?',
        [updateData.passport_number, passengerId]
      );

      if (passportExists) {
        return errorResponse('Passport number already exists', 409);
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.first_name !== undefined) {
      updates.push('first_name = ?');
      values.push(updateData.first_name);
    }
    if (updateData.last_name !== undefined) {
      updates.push('last_name = ?');
      values.push(updateData.last_name);
    }
    if (updateData.gender !== undefined) {
      updates.push('gender = ?');
      values.push(updateData.gender);
    }
    if (updateData.passport_number !== undefined) {
      updates.push('passport_number = ?');
      values.push(updateData.passport_number);
    }
    if (updateData.nationality !== undefined) {
      updates.push('nationality = ?');
      values.push(updateData.nationality);
    }
    if (updateData.date_of_birth !== undefined) {
      updates.push('date_of_birth = ?');
      values.push(updateData.date_of_birth);
    }
    if (updateData.contact_number !== undefined) {
      updates.push('contact_number = ?');
      values.push(updateData.contact_number);
    }
    if (updateData.email !== undefined) {
      updates.push('email = ?');
      values.push(updateData.email);
    }

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    values.push(passengerId);

    await query(
      `UPDATE Passengers SET ${updates.join(', ')} WHERE passenger_id = ?`,
      values
    );

    const updatedPassenger = await queryOne(
      'SELECT * FROM Passengers WHERE passenger_id = ?',
      [passengerId]
    );

    return successResponse(updatedPassenger, 'Passenger updated successfully');
  } catch (error: any) {
    console.error('Update passenger error:', error);
    return errorResponse('Failed to update passenger: ' + error.message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const passengerId = parseInt(params.id);

    if (isNaN(passengerId)) {
      return errorResponse('Invalid passenger ID', 400);
    }

    const existing = await queryOne(
      'SELECT * FROM Passengers WHERE passenger_id = ?',
      [passengerId]
    );

    if (!existing) {
      return notFoundResponse('Passenger not found');
    }

    const hasTickets = await queryOne(
      'SELECT COUNT(*) as count FROM Tickets WHERE passenger_id = ?',
      [passengerId]
    );

    if ((hasTickets as any).count > 0) {
      return errorResponse('Cannot delete passenger with existing tickets', 409);
    }

    await query('DELETE FROM Passengers WHERE passenger_id = ?', [passengerId]);

    return noContentResponse();
  } catch (error: any) {
    console.error('Delete passenger error:', error);
    return errorResponse('Failed to delete passenger: ' + error.message, 500);
  }
}