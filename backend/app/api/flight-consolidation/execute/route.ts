export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/response';
import { verifyToken } from '@/lib/auth';
import mysql from 'mysql2/promise';

// Get DB connection for transactions
async function getConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'airport_management',
  });
}

// ========== POST /api/flight-consolidation/execute ==========
// Execute flight consolidation with transaction
export async function POST(request: NextRequest) {
  // Admin only
  const token = request.headers.get('authorization')?.substring(7);
  const user = verifyToken(token!);
  
  if (!user || user.role !== 'Admin') {
    return errorResponse('Admin access required', 403);
  }

  let connection;

  try {
    const body = await request.json();
    const { source_flight_schedule_id, target_flight_schedule_id, reason } = body;

    if (!source_flight_schedule_id || !target_flight_schedule_id) {
      return errorResponse('source_flight_schedule_id and target_flight_schedule_id are required', 400);
    }

    if (source_flight_schedule_id === target_flight_schedule_id) {
      return errorResponse('Cannot consolidate a flight to itself', 400);
    }

    // Get database connection
    connection = await getConnection();

    // START TRANSACTION
    await connection.beginTransaction();

    // 1. Lock and verify source flight (FOR UPDATE prevents race conditions)
    const [sourceRows] = await connection.execute(
      `SELECT 
        fs.*,
        f.flight_number,
        f.destination_airport_id,
        al.airline_name
      FROM Flight_schedules fs
      JOIN Flights f ON fs.flight_id = f.flight_id
      JOIN Airline al ON f.airline_id = al.airline_id
      WHERE fs.flight_schedule_id = ?
      FOR UPDATE`,
      [source_flight_schedule_id]
    );

    const sourceFlight = (sourceRows as any[])[0];

    if (!sourceFlight) {
      await connection.rollback();
      return errorResponse('Source flight schedule not found', 404);
    }

    if (sourceFlight.flight_status === 'Cancelled') {
      await connection.rollback();
      return errorResponse('Source flight is already cancelled', 400);
    }

    if (sourceFlight.flight_status === 'Completed') {
      await connection.rollback();
      return errorResponse('Cannot consolidate completed flight', 400);
    }

    // 2. Lock and verify target flight
    const [targetRows] = await connection.execute(
      `SELECT 
        fs.*,
        f.flight_number,
        f.destination_airport_id,
        f.aircraft_id,
        a.total_seats,
        al.airline_name
      FROM Flight_schedules fs
      JOIN Flights f ON fs.flight_id = f.flight_id
      JOIN Aircraft a ON f.aircraft_id = a.aircraft_id
      JOIN Airline al ON f.airline_id = al.airline_id
      WHERE fs.flight_schedule_id = ?
      FOR UPDATE`,
      [target_flight_schedule_id]
    );

    const targetFlight = (targetRows as any[])[0];

    if (!targetFlight) {
      await connection.rollback();
      return errorResponse('Target flight schedule not found', 404);
    }

    if (targetFlight.flight_status === 'Cancelled') {
      await connection.rollback();
      return errorResponse('Cannot consolidate to cancelled flight', 400);
    }

    // 3. Verify same destination
    if (sourceFlight.destination_airport_id !== targetFlight.destination_airport_id) {
      await connection.rollback();
      return errorResponse('Flights must have the same destination', 400);
    }

    // 4. Count passengers on source flight
    const [passengerCountRows] = await connection.execute(
      `SELECT COUNT(*) as count 
       FROM Tickets 
       WHERE flight_schedule_id = ? 
       AND ticket_status NOT IN ('Cancelled', 'Refunded')`,
      [source_flight_schedule_id]
    );

    const passengersToMove = (passengerCountRows as any[])[0].count;

    if (passengersToMove === 0) {
      await connection.rollback();
      return errorResponse('Source flight has no active passengers', 400);
    }

    // 5. Count current passengers on target flight
    const [targetPassengerRows] = await connection.execute(
      `SELECT COUNT(*) as count 
       FROM Tickets 
       WHERE flight_schedule_id = ? 
       AND ticket_status NOT IN ('Cancelled', 'Refunded')`,
      [target_flight_schedule_id]
    );

    const targetCurrentPassengers = (targetPassengerRows as any[])[0].count;
    const targetAvailableSeats = targetFlight.total_seats - targetCurrentPassengers;

    if (targetAvailableSeats < passengersToMove) {
      await connection.rollback();
      return errorResponse(
        `Insufficient capacity. Target flight has ${targetAvailableSeats} available seats but needs ${passengersToMove} seats.`,
        400
      );
    }

    // 6. Update all tickets from source to target flight
    const [updateResult] = await connection.execute(
      `UPDATE Tickets 
       SET flight_schedule_id = ?
       WHERE flight_schedule_id = ?
       AND ticket_status NOT IN ('Cancelled', 'Refunded')`,
      [target_flight_schedule_id, source_flight_schedule_id]
    );

    const ticketsUpdated = (updateResult as any).affectedRows;

    // 7. Cancel source flight
    await connection.execute(
      `UPDATE Flight_schedules 
       SET flight_status = 'Cancelled'
       WHERE flight_schedule_id = ?`,
      [source_flight_schedule_id]
    );

    // 8. Record consolidation in Flight_consolidation table
    const [consolidationResult] = await connection.execute(
      `INSERT INTO Flight_consolidation (
        original_flight_schedule_id, 
        new_flight_schedule_id, 
        reason, 
        consolidation_date
      ) VALUES (?, ?, ?, NOW())`,
      [
        source_flight_schedule_id,
        target_flight_schedule_id,
        reason || `Automatic consolidation: ${passengersToMove} passengers moved due to low occupancy`
      ]
    );

    // COMMIT TRANSACTION
    await connection.commit();

    return successResponse({
      consolidation_id: (consolidationResult as any).insertId,
      source_flight: {
        flight_schedule_id: source_flight_schedule_id,
        flight_number: sourceFlight.flight_number,
        airline: sourceFlight.airline_name,
        status: 'Cancelled'
      },
      target_flight: {
        flight_schedule_id: target_flight_schedule_id,
        flight_number: targetFlight.flight_number,
        airline: targetFlight.airline_name,
        departure_datetime: targetFlight.departure_datetime
      },
      passengers_reassigned: passengersToMove,
      tickets_updated: ticketsUpdated,
      message: `Successfully consolidated ${passengersToMove} passengers from flight ${sourceFlight.flight_number} to ${targetFlight.flight_number}`
    }, 'Flight consolidation executed successfully');

  } catch (error: any) {
    // ROLLBACK on error
    if (connection) {
      await connection.rollback();
    }
    console.error('Consolidation execution error:', error);
    return errorResponse('Failed to execute consolidation: ' + error.message, 500);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}