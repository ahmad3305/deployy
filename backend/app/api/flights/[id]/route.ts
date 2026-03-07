import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { flightUpdateSchema, validateData } from '@/lib/validations';

// ========== GET /api/flights/[id] - Get single flight ==========
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const flightId = parseInt(params.id);

    if (isNaN(flightId)) {
      return errorResponse('Invalid flight ID', 400);
    }

    const flight = await queryOne(
      `SELECT 
        f.*,
        al.airline_name,
        al.airline_code,
        al.country as airline_country,
        src.airport_name as source_airport_name,
        src.airport_code as source_airport_code,
        src.city as source_city,
        src.country as source_country,
        src.timezone as source_timezone,
        dest.airport_name as destination_airport_name,
        dest.airport_code as destination_airport_code,
        dest.city as destination_city,
        dest.country as destination_country,
        dest.timezone as destination_timezone
      FROM Flights f
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE f.flight_id = ?`,
      [flightId]
    );

    if (!flight) {
      return notFoundResponse('Flight not found');
    }

    return successResponse(flight, 'Flight retrieved successfully');
  } catch (error: any) {
    console.error('Get flight error:', error);
    return errorResponse('Failed to retrieve flight: ' + error.message, 500);
  }
}

// ========== PUT /api/flights/[id] - Update flight ==========
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const flightId = parseInt(params.id);

    if (isNaN(flightId)) {
      return errorResponse('Invalid flight ID', 400);
    }

    // Check if flight exists
    const existing = await queryOne(
      'SELECT * FROM Flights WHERE flight_id = ?',
      [flightId]
    );

    if (!existing) {
      return notFoundResponse('Flight not found');
    }

    const body = await request.json();

    // Validate input
    const validation = validateData(flightUpdateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const updateData = validation.data!;

    // Verify source and destination are different if both are provided
    const newSourceId = updateData.source_airport_id || (existing as any).source_airport_id;
    const newDestId = updateData.destination_airport_id || (existing as any).destination_airport_id;

    if (newSourceId === newDestId) {
      return errorResponse('Source and destination airports must be different', 400);
    }

    // Verify airline exists if being updated
    if (updateData.airline_id) {
      const airline = await queryOne(
        'SELECT airline_id FROM Airline WHERE airline_id = ?',
        [updateData.airline_id]
      );

      if (!airline) {
        return errorResponse('Airline not found', 404);
      }
    }

    // Verify source airport exists if being updated
    if (updateData.source_airport_id) {
      const sourceAirport = await queryOne(
        'SELECT airport_id FROM Airport WHERE airport_id = ?',
        [updateData.source_airport_id]
      );

      if (!sourceAirport) {
        return errorResponse('Source airport not found', 404);
      }
    }

    // Verify destination airport exists if being updated
    if (updateData.destination_airport_id) {
      const destAirport = await queryOne(
        'SELECT airport_id FROM Airport WHERE airport_id = ?',
        [updateData.destination_airport_id]
      );

      if (!destAirport) {
        return errorResponse('Destination airport not found', 404);
      }
    }

    // Check if flight number is being changed and if it's unique for the airline
    if (updateData.flight_number || updateData.airline_id) {
      const newFlightNumber = updateData.flight_number || (existing as any).flight_number;
      const newAirlineId = updateData.airline_id || (existing as any).airline_id;

      if (newFlightNumber !== (existing as any).flight_number || newAirlineId !== (existing as any).airline_id) {
        const flightExists = await queryOne(
          'SELECT flight_id FROM Flights WHERE airline_id = ? AND flight_number = ? AND flight_id != ?',
          [newAirlineId, newFlightNumber, flightId]
        );

        if (flightExists) {
          return errorResponse('Flight number already exists for this airline', 409);
        }
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.airline_id !== undefined) {
      updates.push('airline_id = ?');
      values.push(updateData.airline_id);
    }
    if (updateData.flight_number !== undefined) {
      updates.push('flight_number = ?');
      values.push(updateData.flight_number);
    }
    if (updateData.source_airport_id !== undefined) {
      updates.push('source_airport_id = ?');
      values.push(updateData.source_airport_id);
    }
    if (updateData.destination_airport_id !== undefined) {
      updates.push('destination_airport_id = ?');
      values.push(updateData.destination_airport_id);
    }
    if (updateData.flight_type !== undefined) {
      updates.push('flight_type = ?');
      values.push(updateData.flight_type);
    }
    if (updateData.estimated_duration !== undefined) {
      updates.push('estimated_duration = ?');
      values.push(updateData.estimated_duration);
    }

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    values.push(flightId);

    await query(
      `UPDATE Flights SET ${updates.join(', ')} WHERE flight_id = ?`,
      values
    );

    // Fetch updated flight with joined data
    const updatedFlight = await queryOne(
      `SELECT 
        f.*,
        al.airline_name,
        al.airline_code,
        src.airport_name as source_airport_name,
        src.airport_code as source_airport_code,
        dest.airport_name as destination_airport_name,
        dest.airport_code as destination_airport_code
      FROM Flights f
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE f.flight_id = ?`,
      [flightId]
    );

    return successResponse(updatedFlight, 'Flight updated successfully');
  } catch (error: any) {
    console.error('Update flight error:', error);
    return errorResponse('Failed to update flight: ' + error.message, 500);
  }
}

// ========== DELETE /api/flights/[id] - Delete flight ==========
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const flightId = parseInt(params.id);

    if (isNaN(flightId)) {
      return errorResponse('Invalid flight ID', 400);
    }

    // Check if flight exists
    const existing = await queryOne(
      'SELECT * FROM Flights WHERE flight_id = ?',
      [flightId]
    );

    if (!existing) {
      return notFoundResponse('Flight not found');
    }

    // Check if flight has schedules
    const hasSchedules = await queryOne(
      'SELECT COUNT(*) as count FROM Flight_Schedule WHERE flight_id = ?',
      [flightId]
    );

    if ((hasSchedules as any).count > 0) {
      return errorResponse('Cannot delete flight with existing schedules', 409);
    }

    // Check if flight has cargo
    const hasCargo = await queryOne(
      'SELECT COUNT(*) as count FROM Cargo WHERE flight_id = ?',
      [flightId]
    );

    if ((hasCargo as any).count > 0) {
      return errorResponse('Cannot delete flight with existing cargo', 409);
    }

    // Delete flight
    await query('DELETE FROM Flights WHERE flight_id = ?', [flightId]);

    return noContentResponse();
  } catch (error: any) {
    console.error('Delete flight error:', error);
    return errorResponse('Failed to delete flight: ' + error.message, 500);
  }
}