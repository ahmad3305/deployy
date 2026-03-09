import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse, createdResponse, validationErrorResponse } from '@/lib/response';
import { crewRequirementCreateSchema, validateData } from '@/lib/validations';

// ========== GET /api/crew-requirements - Get all crew requirements ==========
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const flight_schedule_id = searchParams.get('flight_schedule_id');
    const role_required = searchParams.get('role_required');

    let sql = `
      SELECT 
        cr.*,
        fs.departure_datetime,
        fs.arrival_datetime,
        fs.flight_status,
        f.flight_number,
        al.airline_name,
        al.airline_code,
        src.airport_name as source_airport_name,
        src.airport_code as source_airport_code,
        dest.airport_name as destination_airport_name,
        dest.airport_code as destination_airport_code,
        (SELECT COUNT(DISTINCT ta.staff_id) 
         FROM Task_Assignments ta
         JOIN Tasks t ON ta.task_id = t.task_id
         JOIN Staff s ON ta.staff_id = s.staff_id
         WHERE t.flight_schedule_id = cr.flight_schedule_id 
         AND s.role = cr.role_required
         AND ta.assignment_status != 'Cancelled') as assigned_count
      FROM Crew_requirements cr
      LEFT JOIN Flight_schedules fs ON cr.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filter by flight schedule
    if (flight_schedule_id) {
      sql += ' AND cr.flight_schedule_id = ?';
      params.push(parseInt(flight_schedule_id));
    }

    // Filter by role
    if (role_required) {
      sql += ' AND cr.role_required = ?';
      params.push(role_required);
    }

    sql += ' ORDER BY fs.departure_datetime DESC, cr.role_required ASC';

    const requirements = await query(sql, params);

    return successResponse(requirements, 'Crew requirements retrieved successfully');
  } catch (error: any) {
    console.error('Get crew requirements error:', error);
    return errorResponse('Failed to retrieve crew requirements: ' + error.message, 500);
  }
}

// ========== POST /api/crew-requirements - Create new crew requirement ==========
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateData(crewRequirementCreateSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const data = validation.data!;

    // Verify flight schedule exists
    const schedule = await queryOne<any>(
      'SELECT * FROM Flight_schedules WHERE flight_schedule_id = ?',
      [data.flight_schedule_id]
    );

    if (!schedule) {
      return errorResponse('Flight schedule not found', 404);
    }

    // Check if flight is cancelled or completed
    if (schedule.flight_status === 'Cancelled') {
      return errorResponse('Cannot add crew requirements to cancelled flight', 400);
    }

    if (schedule.flight_status === 'Completed') {
      return errorResponse('Cannot add crew requirements to completed flight', 400);
    }

    // Check if requirement for this role already exists for this flight
    const existingRequirement = await queryOne(
      'SELECT requirement_id FROM Crew_requirements WHERE flight_schedule_id = ? AND role_required = ?',
      [data.flight_schedule_id, data.role_required]
    );

    if (existingRequirement) {
      return errorResponse('Crew requirement for this role already exists for this flight', 409);
    }

    // Validate number required
    if (data.number_required <= 0) {
      return errorResponse('Number required must be greater than 0', 400);
    }

    // Insert crew requirement
    const result = await query<any>(
      `INSERT INTO Crew_requirements (
        flight_schedule_id, role_required, number_required
      ) VALUES (?, ?, ?)`,
      [
        data.flight_schedule_id,
        data.role_required,
        data.number_required
      ]
    );

    // Fetch created requirement with joined data
    const newRequirement = await queryOne(
      `SELECT 
        cr.*,
        fs.departure_datetime,
        fs.arrival_datetime,
        f.flight_number,
        al.airline_name,
        src.airport_name as source_airport_name,
        dest.airport_name as destination_airport_name
      FROM Crew_requirements cr
      LEFT JOIN Flight_schedules fs ON cr.flight_schedule_id = fs.flight_schedule_id
      LEFT JOIN Flights f ON fs.flight_id = f.flight_id
      LEFT JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Airport src ON f.source_airport_id = src.airport_id
      LEFT JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE cr.requirement_id = ?`,
      [result.insertId]
    );

    return createdResponse(newRequirement, 'Crew requirement created successfully');
  } catch (error: any) {
    console.error('Create crew requirement error:', error);
    return errorResponse('Failed to create crew requirement: ' + error.message, 500);
  }
}