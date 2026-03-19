import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, noContentResponse, validationErrorResponse } from '@/lib/response';
import { flightIncidentUpdateSchema, validateData } from '@/lib/validations';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const incidentId = parseInt(params.id);

    if (isNaN(incidentId)) {
      return errorResponse('Invalid incident ID', 400);
    }

    const incident = await queryOne(
      `SELECT 
        fi.*,
        fs.departure_datetime,
        fs.arrival_datetime,
        fs.flight_status as schedule_status,
        f.flight_number,
        f.flight_type,
        al.airline_name,
        al.airline_code,
        src.airport_name as source_airport_name,
        src.airport_code as source_airport_code,
        src.city as source_city,
        dest.airport_name as destination_airport_name,
        dest.airport_code as destination_airport_code,
        dest.city as destination_city
      FROM Flight_incidents fi
      LEFT JOIN Flight_schedules fs ON fi.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE fi.incident_id = ?`,
      [incidentId]
    );

    if (!incident) {
      return notFoundResponse('Flight incident not found');
    }

    return successResponse(incident, 'Flight incident retrieved successfully');
  } catch (error: any) {
    console.error('Get flight incident error:', error);
    return errorResponse('Failed to retrieve flight incident: ' + error.message, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const incidentId = parseInt(params.id);

    if (isNaN(incidentId)) {
      return errorResponse('Invalid incident ID', 400);
    }

    const existing = await queryOne<any>(
      'SELECT * FROM Flight_incidents WHERE incident_id = ?',
      [incidentId]
    );

    if (!existing) {
      return notFoundResponse('Flight incident not found');
    }

    const body = await request.json();

    const validation = validateData(flightIncidentUpdateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const updateData = validation.data!;

    if (updateData.flight_status === 'Resolved' && !updateData.resolved_at && !existing.resolved_at) {
      updateData.resolved_at = new Date().toISOString();
    }

    if (updateData.flight_status === 'Open' && existing.flight_status === 'Resolved') {
      updateData.resolved_at = null as any;
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.incident_type !== undefined) {
      updates.push('incident_type = ?');
      values.push(updateData.incident_type);
    }
    if (updateData.description !== undefined) {
      updates.push('description = ?');
      values.push(updateData.description);
    }
    if (updateData.resolved_at !== undefined) {
      updates.push('resolved_at = ?');
      values.push(updateData.resolved_at);
    }
    if (updateData.flight_status !== undefined) {
      updates.push('flight_status = ?');
      values.push(updateData.flight_status);
    }

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    values.push(incidentId);

    await query(
      `UPDATE Flight_incidents SET ${updates.join(', ')} WHERE incident_id = ?`,
      values
    );

    const updatedIncident = await queryOne(
      `SELECT 
        fi.*,
        fs.departure_datetime,
        f.flight_number,
        al.airline_name
      FROM Flight_incidents fi
      LEFT JOIN Flight_schedules fs ON fi.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      WHERE fi.incident_id = ?`,
      [incidentId]
    );

    return successResponse(updatedIncident, 'Flight incident updated successfully');
  } catch (error: any) {
    console.error('Update flight incident error:', error);
    return errorResponse('Failed to update flight incident: ' + error.message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const incidentId = parseInt(params.id);

    if (isNaN(incidentId)) {
      return errorResponse('Invalid incident ID', 400);
    }

    const existing = await queryOne(
      'SELECT * FROM Flight_incidents WHERE incident_id = ?',
      [incidentId]
    );

    if (!existing) {
      return notFoundResponse('Flight incident not found');
    }

    await query('DELETE FROM Flight_incidents WHERE incident_id = ?', [incidentId]);

    return noContentResponse();
  } catch (error: any) {
    console.error('Delete flight incident error:', error);
    return errorResponse('Failed to delete flight incident: ' + error.message, 500);
  }
}