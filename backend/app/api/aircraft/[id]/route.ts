import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { aircraftUpdateSchema, validateData } from '@/lib/validations';

// ========== GET /api/aircraft/[id] - Get single aircraft ==========
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const aircraftId = parseInt(params.id);

    if (isNaN(aircraftId)) {
      return errorResponse('Invalid aircraft ID', 400);
    }

    const aircraft = await queryOne(
      `SELECT 
        a.*,
        al.airline_name,
        al.airline_code,
        al.country as airline_country,
        at.model_name,
        at.manufacturer,
        at.seat_capacity as type_seat_capacity,
        ap.airport_name as current_airport_name,
        ap.airport_code as current_airport_code,
        ap.city as current_airport_city
      FROM Aircraft a
      LEFT JOIN Airline al ON a.airline_id = al.airline_id
      LEFT JOIN Aircraft_Type at ON a.aircraft_type_id = at.aircraft_type_id
      LEFT JOIN Airport ap ON a.current_airport = ap.airport_id
      WHERE a.aircraft_id = ?`,
      [aircraftId]
    );

    if (!aircraft) {
      return notFoundResponse('Aircraft not found');
    }

    return successResponse(aircraft, 'Aircraft retrieved successfully');
  } catch (error: any) {
    console.error('Get aircraft error:', error);
    return errorResponse('Failed to retrieve aircraft: ' + error.message, 500);
  }
}

// ========== PUT /api/aircraft/[id] - Update aircraft ==========
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const aircraftId = parseInt(params.id);

    if (isNaN(aircraftId)) {
      return errorResponse('Invalid aircraft ID', 400);
    }

    // Check if aircraft exists
    const existing = await queryOne(
      'SELECT * FROM Aircraft WHERE aircraft_id = ?',
      [aircraftId]
    );

    if (!existing) {
      return notFoundResponse('Aircraft not found');
    }

    const body = await request.json();

    // Validate input
    const validation = validateData(aircraftUpdateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const updateData = validation.data!;

    // Check if registration number is being changed and if it's unique
    if (updateData.registration_number && updateData.registration_number !== (existing as any).registration_number) {
      const regExists = await queryOne(
        'SELECT aircraft_id FROM Aircraft WHERE registration_number = ? AND aircraft_id != ?',
        [updateData.registration_number, aircraftId]
      );

      if (regExists) {
        return errorResponse('Registration number already exists', 409);
      }
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

    // Verify aircraft type exists if being updated
    if (updateData.aircraft_type_id) {
      const aircraftType = await queryOne(
        'SELECT aircraft_type_id FROM Aircraft_Type WHERE aircraft_type_id = ?',
        [updateData.aircraft_type_id]
      );

      if (!aircraftType) {
        return errorResponse('Aircraft type not found', 404);
      }
    }

    // Verify current airport exists if being updated
    if (updateData.current_airport) {
      const airport = await queryOne(
        'SELECT airport_id FROM Airport WHERE airport_id = ?',
        [updateData.current_airport]
      );

      if (!airport) {
        return errorResponse('Airport not found', 404);
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.airline_id !== undefined) {
      updates.push('airline_id = ?');
      values.push(updateData.airline_id);
    }
    if (updateData.aircraft_type_id !== undefined) {
      updates.push('aircraft_type_id = ?');
      values.push(updateData.aircraft_type_id);
    }
    if (updateData.registration_number !== undefined) {
      updates.push('registration_number = ?');
      values.push(updateData.registration_number);
    }
    if (updateData.status !== undefined) {
      updates.push('status = ?');
      values.push(updateData.status);
    }
    if (updateData.economy_seats !== undefined) {
      updates.push('economy_seats = ?');
      values.push(updateData.economy_seats);
    }
    if (updateData.business_seats !== undefined) {
      updates.push('business_seats = ?');
      values.push(updateData.business_seats);
    }
    if (updateData.first_class_seats !== undefined) {
      updates.push('first_class_seats = ?');
      values.push(updateData.first_class_seats);
    }
    if (updateData.max_speed_kmh !== undefined) {
      updates.push('max_speed_kmh = ?');
      values.push(updateData.max_speed_kmh);
    }
    if (updateData.fuel_capacity_litres !== undefined) {
      updates.push('fuel_capacity_litres = ?');
      values.push(updateData.fuel_capacity_litres);
    }
    if (updateData.manufactered_date !== undefined) {
      updates.push('manufactered_date = ?');
      values.push(updateData.manufactered_date);
    }
    if (updateData.latest_maintenance !== undefined) {
      updates.push('latest_maintenance = ?');
      values.push(updateData.latest_maintenance);
    }
    if (updateData.next_maintenance_due !== undefined) {
      updates.push('next_maintenance_due = ?');
      values.push(updateData.next_maintenance_due);
    }
    if (updateData.current_airport !== undefined) {
      updates.push('current_airport = ?');
      values.push(updateData.current_airport);
    }

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    values.push(aircraftId);

    await query(
      `UPDATE Aircraft SET ${updates.join(', ')} WHERE aircraft_id = ?`,
      values
    );

    // Fetch updated aircraft with joined data
    const updatedAircraft = await queryOne(
      `SELECT 
        a.*,
        al.airline_name,
        at.model_name,
        at.manufacturer,
        ap.airport_name as current_airport_name
      FROM Aircraft a
      LEFT JOIN Airline al ON a.airline_id = al.airline_id
      LEFT JOIN Aircraft_Type at ON a.aircraft_type_id = at.aircraft_type_id
      LEFT JOIN Airport ap ON a.current_airport = ap.airport_id
      WHERE a.aircraft_id = ?`,
      [aircraftId]
    );

    return successResponse(updatedAircraft, 'Aircraft updated successfully');
  } catch (error: any) {
    console.error('Update aircraft error:', error);
    return errorResponse('Failed to update aircraft: ' + error.message, 500);
  }
}

// ========== DELETE /api/aircraft/[id] - Delete aircraft ==========
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const aircraftId = parseInt(params.id);

    if (isNaN(aircraftId)) {
      return errorResponse('Invalid aircraft ID', 400);
    }

    // Check if aircraft exists
    const existing = await queryOne(
      'SELECT * FROM Aircraft WHERE aircraft_id = ?',
      [aircraftId]
    );

    if (!existing) {
      return notFoundResponse('Aircraft not found');
    }

    // Check if aircraft has flight schedules
    const hasSchedules = await queryOne(
      'SELECT COUNT(*) as count FROM Flight_Schedule WHERE aircraft_id = ?',
      [aircraftId]
    );

    if ((hasSchedules as any).count > 0) {
      return errorResponse('Cannot delete aircraft with existing flight schedules', 409);
    }

    // Check if aircraft has maintenance records
    const hasMaintenance = await queryOne(
      'SELECT COUNT(*) as count FROM Aircraft_Maintenance WHERE aircraft_id = ?',
      [aircraftId]
    );

    if ((hasMaintenance as any).count > 0) {
      return errorResponse('Cannot delete aircraft with existing maintenance records', 409);
    }

    // Check if aircraft has runway bookings
    const hasBookings = await queryOne(
      'SELECT COUNT(*) as count FROM Runway_Booking WHERE aircraft_id = ?',
      [aircraftId]
    );

    if ((hasBookings as any).count > 0) {
      return errorResponse('Cannot delete aircraft with existing runway bookings', 409);
    }

    // Delete aircraft
    await query('DELETE FROM Aircraft WHERE aircraft_id = ?', [aircraftId]);

    return noContentResponse();
  } catch (error: any) {
    console.error('Delete aircraft error:', error);
    return errorResponse('Failed to delete aircraft: ' + error.message, 500);
  }
}