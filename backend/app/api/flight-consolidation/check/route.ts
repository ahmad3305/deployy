export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/response';
import { verifyToken } from '@/lib/auth';

// ========== POST /api/flight-consolidation/check ==========
// Check if a flight can be consolidated
export async function POST(request: NextRequest) {
  // Admin only
  const token = request.headers.get('authorization')?.substring(7);
  const user = verifyToken(token!);
  
  if (!user || user.role !== 'Admin') {
    return errorResponse('Admin access required', 403);
  }

  try {
    const body = await request.json();
    const { flight_schedule_id } = body;

    if (!flight_schedule_id) {
      return errorResponse('flight_schedule_id is required', 400);
    }

    // 1. Get flight details
    const flightSchedule = await queryOne<any>(
      `SELECT 
        fs.*,
        f.flight_number,
        f.source_airport_id,
        f.destination_airport_id,
        f.aircraft_id,
        a.total_seats,
        al.airline_name,
        src.airport_name as source_airport,
        src.airport_code as source_code,
        dest.airport_name as destination_airport,
        dest.airport_code as destination_code
      FROM Flight_schedules fs
      JOIN Flights f ON fs.flight_id = f.flight_id
      JOIN Aircraft a ON f.aircraft_id = a.aircraft_id
      JOIN Airline al ON f.airline_id = al.airline_id
      JOIN Airport src ON f.source_airport_id = src.airport_id
      JOIN Airport dest ON f.destination_airport_id = dest.airport_id
      WHERE fs.flight_schedule_id = ?`,
      [flight_schedule_id]
    );

    if (!flightSchedule) {
      return errorResponse('Flight schedule not found', 404);
    }

    // 2. Check if flight is already cancelled or completed
    if (flightSchedule.flight_status === 'Cancelled') {
      return successResponse({
        canConsolidate: false,
        reason: 'Flight is already cancelled'
      }, 'Consolidation check completed');
    }

    if (flightSchedule.flight_status === 'Completed') {
      return successResponse({
        canConsolidate: false,
        reason: 'Flight is already completed'
      }, 'Consolidation check completed');
    }

    // 3. Count current passengers
    const passengerCount = await queryOne<any>(
      `SELECT COUNT(*) as count 
       FROM Tickets 
       WHERE flight_schedule_id = ? 
       AND ticket_status NOT IN ('Cancelled', 'Refunded')`,
      [flight_schedule_id]
    );

    const currentPassengers = passengerCount?.count || 0;

    // 4. Check if passengers < 50
    if (currentPassengers >= 50) {
      return successResponse({
        canConsolidate: false,
        currentPassengers,
        reason: 'Flight has 50 or more passengers. Consolidation only recommended for flights with less than 50 passengers.'
      }, 'Consolidation check completed');
    }

    // 5. Find candidate flights within 24-36 hours to same destination
    const candidateFlights = await query<any>(
      `SELECT 
        fs.flight_schedule_id,
        fs.departure_datetime,
        fs.arrival_datetime,
        fs.flight_status,
        f.flight_number,
        f.aircraft_id,
        a.total_seats,
        al.airline_name,
        COUNT(t.ticket_id) as booked_seats,
        (a.total_seats - COUNT(t.ticket_id)) as available_seats
      FROM Flight_schedules fs
      JOIN Flights f ON fs.flight_id = f.flight_id
      JOIN Aircraft a ON f.aircraft_id = a.aircraft_id
      JOIN Airline al ON f.airline_id = al.airline_id
      LEFT JOIN Tickets t ON fs.flight_schedule_id = t.flight_schedule_id 
                          AND t.ticket_status NOT IN ('Cancelled', 'Refunded')
      WHERE f.destination_airport_id = ?
      AND f.source_airport_id = ?
      AND fs.departure_datetime BETWEEN 
          DATE_ADD(?, INTERVAL 24 HOUR) 
          AND DATE_ADD(?, INTERVAL 36 HOUR)
      AND fs.flight_status = 'Scheduled'
      AND fs.flight_schedule_id != ?
      GROUP BY fs.flight_schedule_id
      HAVING available_seats >= ?
      ORDER BY fs.departure_datetime ASC`,
      [
        flightSchedule.destination_airport_id,
        flightSchedule.source_airport_id,
        flightSchedule.departure_datetime,
        flightSchedule.departure_datetime,
        flight_schedule_id,
        currentPassengers
      ]
    );

    // 6. Determine if consolidation is possible
    const canConsolidate = candidateFlights.length > 0;

    if (canConsolidate) {
      return successResponse({
        canConsolidate: true,
        currentPassengers,
        flightDetails: {
          flight_schedule_id: flightSchedule.flight_schedule_id,
          flight_number: flightSchedule.flight_number,
          airline: flightSchedule.airline_name,
          departure_datetime: flightSchedule.departure_datetime,
          route: `${flightSchedule.source_code} → ${flightSchedule.destination_code}`
        },
        availableFlights: candidateFlights.map((f: any) => ({
          flight_schedule_id: f.flight_schedule_id,
          flight_number: f.flight_number,
          airline: f.airline_name,
          departure_datetime: f.departure_datetime,
          arrival_datetime: f.arrival_datetime,
          total_seats: f.total_seats,
          booked_seats: f.booked_seats,
          available_seats: f.available_seats,
          required_seats: currentPassengers
        })),
        reason: `Found ${candidateFlights.length} flight(s) with sufficient capacity within 24-36 hours`
      }, 'Consolidation check completed');
    } else {
      return successResponse({
        canConsolidate: false,
        currentPassengers,
        flightDetails: {
          flight_schedule_id: flightSchedule.flight_schedule_id,
          flight_number: flightSchedule.flight_number,
          departure_datetime: flightSchedule.departure_datetime,
          route: `${flightSchedule.source_code} → ${flightSchedule.destination_code}`
        },
        reason: 'No suitable flights found within 24-36 hours with sufficient capacity'
      }, 'Consolidation check completed');
    }

  } catch (error: any) {
    console.error('Consolidation check error:', error);
    return errorResponse('Failed to check consolidation: ' + error.message, 500);
  }
}