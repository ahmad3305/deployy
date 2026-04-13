import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { flightScheduleCreateSchema, validateData } from '@/lib/validations';
import { validateAndPlanCrewForSchedule, createTasksForSchedule, autoAssignStaffForSchedule } from '@/utils/crew-validator'; // <-- Update import path if needed
import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const flight_id = searchParams.get('flight_id');
    const aircraft_id = searchParams.get('aircraft_id');
    const flight_status = searchParams.get('flight_status');
    const departure_date = searchParams.get('departure_date');
    const source_airport_id = searchParams.get('source_airport_id');
    const destination_airport_id = searchParams.get('destination_airport_id');

    let sql = `
      SELECT 
        fs.*,
        f.flight_number,
        f.flight_type,
        f.estimated_duration,
        al.airline_name,
        al.airline_code,
        ac.registration_number,
        at.model_name,
        at.manufacturer,
        src.airport_name as source_airport_name,
        src.airport_code as source_airport_code,
        src.city as source_city,
        dest.airport_name as destination_airport_name,
        dest.airport_code as destination_airport_code,
        dest.city as destination_city,
        g.gate_number,
        t.terminal_name
      FROM Flight_schedules fs
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Aircraft ac ON fs.aircraft_id = ac.aircraft_id
      LEFT JOIN Aircraft_types at ON ac.aircraft_type_id = at.aircraft_type_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      LEFT JOIN Gates g ON fs.gate_id = g.gate_id
      LEFT JOIN Terminals t ON g.terminal_id = t.terminal_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (flight_id) {
      sql += ' AND fs.flight_id = ?';
      params.push(parseInt(flight_id));
    }
    if (aircraft_id) {
      sql += ' AND fs.aircraft_id = ?';
      params.push(parseInt(aircraft_id));
    }
    if (flight_status) {
      sql += ' AND fs.flight_status = ?';
      params.push(flight_status);
    }
    if (departure_date) {
      sql += ' AND DATE(fs.departure_datetime) = ?';
      params.push(departure_date);
    }
    if (source_airport_id) {
      sql += ' AND f.source_airport_id = ?';
      params.push(parseInt(source_airport_id));
    }
    if (destination_airport_id) {
      sql += ' AND f.destination_airport_id = ?';
      params.push(parseInt(destination_airport_id));
    }

    sql += ' ORDER BY fs.departure_datetime DESC';

    const schedules = await query(sql, params);
    return successResponse(schedules, 'Flight schedules retrieved successfully');
  } catch (error: any) {
    console.error('Get flight schedules error:', error);
    return errorResponse('Failed to retrieve flight schedules: ' + error.message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = validateData(flightScheduleCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data!;

    const flight = await queryOne('SELECT * FROM Flights WHERE flight_id = ?', [data.flight_id]);
    if (!flight) return errorResponse('Flight not found', 404);

    const aircraft = await queryOne<any>('SELECT * FROM Aircraft WHERE aircraft_id = ?', [data.aircraft_id]);
    if (!aircraft) return errorResponse('Aircraft not found', 404);
    if (aircraft.status !== 'Active') return errorResponse('Aircraft is not active', 400);

    const gate = await queryOne('SELECT * FROM Gates WHERE gate_id = ?', [data.gate_id]);
    if (!gate) return errorResponse('Gate not found', 404);

    const departureTime = new Date(data.departure_datetime);
    const arrivalTime = new Date(data.arrival_datetime);
    if (arrivalTime <= departureTime) return errorResponse('Arrival time must be after departure time', 400);

    const result = await query<any>(
      `INSERT INTO Flight_schedules (
        flight_id, aircraft_id, departure_datetime, 
        arrival_datetime, gate_id, flight_status
      ) VALUES (?, ?, ?, ?, ?, 'Scheduled')`,
      [
        data.flight_id,
        data.aircraft_id,
        data.departure_datetime,
        data.arrival_datetime,
        data.gate_id
      ]
    );

    let newSchedule = await queryOne(
      `SELECT 
        fs.*,
        f.flight_number,
        al.airline_name,
        ac.registration_number,
        src.airport_name as source_airport_name,
        dest.airport_name as destination_airport_name,
        g.gate_number
      FROM Flight_schedules fs
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Aircraft ac ON fs.aircraft_id = ac.aircraft_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      LEFT JOIN Gates g ON fs.gate_id = g.gate_id
      WHERE fs.flight_schedule_id = ?`,
      [result.insertId]
    );

    const crewResult = await validateAndPlanCrewForSchedule(result.insertId);
    if (crewResult.kind === 'ok') {
      await createTasksForSchedule(result.insertId);
      await autoAssignStaffForSchedule(result.insertId);
    } else {
      const delayReason = crewResult.kind === 'insufficient_crew'
        ? 'Insufficient Crew'
        : 'Crew assignment pending';
      await query(
        `UPDATE Flight_schedules SET flight_status = 'Delayed', delay_reason = ? WHERE flight_schedule_id = ?`,
        [delayReason, result.insertId]
      );
      newSchedule.flight_status = 'Delayed';
      newSchedule.delay_reason = delayReason;
    }

    return createdResponse(
      newSchedule,
      crewResult.kind === 'ok'
        ? 'Flight schedule created and crew assigned'
        : `Flight schedule delayed: ${newSchedule.delay_reason}`
    );
    
  } catch (error: any) {
    console.error('Create flight schedule error:', error);
    return errorResponse('Failed to create flight schedule: ' + error.message, 500);
  }
}