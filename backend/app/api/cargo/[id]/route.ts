import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { cargoUpdateSchema, validateData } from '@/lib/validations';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cargoId = parseInt(params.id);

    if (isNaN(cargoId)) {
      return errorResponse('Invalid cargo ID', 400);
    }

    const cargo = await queryOne(
      `SELECT 
        c.*,
        f.flight_number,
        f.flight_type,
        f.estimated_duration,
        al.airline_name,
        al.airline_code,
        origin.airport_name as origin_airport_name,
        origin.airport_code as origin_airport_code,
        origin.city as origin_city,
        origin.country as origin_country,
        origin.timezone as origin_timezone,
        dest.airport_name as destination_airport_name,
        dest.airport_code as destination_airport_code,
        dest.city as destination_city,
        dest.country as destination_country,
        dest.timezone as destination_timezone
      FROM Cargo c
      LEFT JOIN Flights f ON c.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport origin ON c.origin_airport_id = origin.airport_id
      LEFT JOIN Airport dest ON c.destination_airport_id = dest.airport_id
      WHERE c.cargo_id = ?`,
      [cargoId]
    );

    if (!cargo) {
      return notFoundResponse('Cargo not found');
    }

    return successResponse(cargo, 'Cargo retrieved successfully');
  } catch (error: any) {
    console.error('Get cargo error:', error);
    return errorResponse('Failed to retrieve cargo: ' + error.message, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cargoId = parseInt(params.id);

    if (isNaN(cargoId)) {
      return errorResponse('Invalid cargo ID', 400);
    }

    const existing = await queryOne<any>(
      'SELECT * FROM Cargo WHERE cargo_id = ?',
      [cargoId]
    );

    if (!existing) {
      return notFoundResponse('Cargo not found');
    }

    const body = await request.json();

    const validation = validateData(cargoUpdateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const updateData = validation.data!;

    if (existing.status === 'Delivered' && Object.keys(updateData).some(key => key !== 'status')) {
      return errorResponse('Cannot update delivered cargo (except status)', 400);
    }

    if (existing.status === 'Cancelled' && Object.keys(updateData).some(key => key !== 'status')) {
      return errorResponse('Cannot update cancelled cargo (except status)', 400);
    }

    if (updateData.tracking_number && updateData.tracking_number !== existing.tracking_number) {
      const trackingExists = await queryOne(
        'SELECT cargo_id FROM Cargo WHERE tracking_number = ? AND cargo_id != ?',
        [updateData.tracking_number, cargoId]
      );

      if (trackingExists) {
        return errorResponse('Tracking number already exists', 409);
      }
    }

    if (updateData.flight_id) {
      const flight = await queryOne(
        'SELECT flight_id FROM Flights WHERE flight_id = ?',
        [updateData.flight_id]
      );

      if (!flight) {
        return errorResponse('Flight not found', 404);
      }
    }

    if (updateData.origin_airport_id) {
      const originAirport = await queryOne(
        'SELECT airport_id FROM Airport WHERE airport_id = ?',
        [updateData.origin_airport_id]
      );

      if (!originAirport) {
        return errorResponse('Origin airport not found', 404);
      }
    }

    if (updateData.destination_airport_id) {
      const destAirport = await queryOne(
        'SELECT airport_id FROM Airport WHERE airport_id = ?',
        [updateData.destination_airport_id]
      );

      if (!destAirport) {
        return errorResponse('Destination airport not found', 404);
      }
    }

    const newOriginId = updateData.origin_airport_id || existing.origin_airport_id;
    const newDestId = updateData.destination_airport_id || existing.destination_airport_id;

    if (newOriginId === newDestId) {
      return errorResponse('Origin and destination airports must be different', 400);
    }

    if (updateData.weight_kg !== undefined && updateData.weight_kg <= 0) {
      return errorResponse('Weight must be greater than 0', 400);
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.flight_id !== undefined) {
      updates.push('flight_id = ?');
      values.push(updateData.flight_id);
    }
    if (updateData.tracking_number !== undefined) {
      updates.push('tracking_number = ?');
      values.push(updateData.tracking_number);
    }
    if (updateData.cargo_type !== undefined) {
      updates.push('cargo_type = ?');
      values.push(updateData.cargo_type);
    }
    if (updateData.description !== undefined) {
      updates.push('description = ?');
      values.push(updateData.description);
    }
    if (updateData.weight_kg !== undefined) {
      updates.push('weight_kg = ?');
      values.push(updateData.weight_kg);
    }
    if (updateData.origin_airport_id !== undefined) {
      updates.push('origin_airport_id = ?');
      values.push(updateData.origin_airport_id);
    }
    if (updateData.destination_airport_id !== undefined) {
      updates.push('destination_airport_id = ?');
      values.push(updateData.destination_airport_id);
    }
    if (updateData.sender_name !== undefined) {
      updates.push('sender_name = ?');
      values.push(updateData.sender_name);
    }
    if (updateData.sender_contact !== undefined) {
      updates.push('sender_contact = ?');
      values.push(updateData.sender_contact);
    }
    if (updateData.reciever_name !== undefined) {
      updates.push('reciever_name = ?');
      values.push(updateData.reciever_name);
    }
    if (updateData.reciever_contact !== undefined) {
      updates.push('reciever_contact = ?');
      values.push(updateData.reciever_contact);
    }
    if (updateData.status !== undefined) {
      updates.push('status = ?');
      values.push(updateData.status);
    }
    if (updateData.is_insured !== undefined) {
      updates.push('is_insured = ?');
      values.push(updateData.is_insured);
    }

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    values.push(cargoId);

    await query(
      `UPDATE Cargo SET ${updates.join(', ')} WHERE cargo_id = ?`,
      values
    );

    const updatedCargo = await queryOne(
      `SELECT 
        c.*,
        f.flight_number,
        al.airline_name,
        origin.airport_name as origin_airport_name,
        origin.airport_code as origin_airport_code,
        dest.airport_name as destination_airport_name,
        dest.airport_code as destination_airport_code
      FROM Cargo c
      LEFT JOIN Flights f ON c.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport origin ON c.origin_airport_id = origin.airport_id
      LEFT JOIN Airport dest ON c.destination_airport_id = dest.airport_id
      WHERE c.cargo_id = ?`,
      [cargoId]
    );

    return successResponse(updatedCargo, 'Cargo updated successfully');
  } catch (error: any) {
    console.error('Update cargo error:', error);
    return errorResponse('Failed to update cargo: ' + error.message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cargoId = parseInt(params.id);

    if (isNaN(cargoId)) {
      return errorResponse('Invalid cargo ID', 400);
    }

    const existing = await queryOne<any>(
      'SELECT * FROM Cargo WHERE cargo_id = ?',
      [cargoId]
    );

    if (!existing) {
      return notFoundResponse('Cargo not found');
    }

    if (existing.status === 'Cancelled') {
      return errorResponse('Cargo is already cancelled', 400);
    }

    if (existing.status === 'Delivered') {
      return errorResponse('Cannot cancel delivered cargo', 400);
    }

    await query(
      'UPDATE Cargo SET status = ? WHERE cargo_id = ?',
      ['Cancelled', cargoId]
    );

    return successResponse(
      { cargo_id: cargoId, status: 'Cancelled' },
      'Cargo cancelled successfully'
    );
  } catch (error: any) {
    console.error('Cancel cargo error:', error);
    return errorResponse('Failed to cancel cargo: ' + error.message, 500);
  }
}