export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/response';
import { statusFromCrewValidation } from '@/utils/flight-status';
import {
  suggestNextScheduleWindow,
  createTasksForSchedule,
  autoAssignStaffForSchedule,
} from '@/utils/crew-validator';

import { handleOptions } from '@/lib/cors';

export function OPTIONS() {
  return handleOptions();
}

function requireCronSecret(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  const expected = process.env.CRON_SECRET;
  return expected && secret === expected;
}

export async function POST(request: NextRequest) {
  try {
    if (!requireCronSecret(request)) {
      return errorResponse('Unauthorized', 401);
    }

    const delayedFlights = await query<any[]>(
      `
      SELECT 
        flight_schedule_id,
        flight_id,
        aircraft_id,
        gate_id,
        departure_datetime,
        arrival_datetime,
        delay_minutes,
        delay_reason
      FROM Flight_schedules
      WHERE flight_status = 'Delayed'
        AND departure_datetime > DATE_ADD(NOW(), INTERVAL 30 MINUTE)
      ORDER BY departure_datetime ASC
      LIMIT 50
      `
    );

    const results: Array<{
      flight_schedule_id: number;
      action: 'skipped' | 'no_window' | 'rescheduled' | 'scheduled';
      message: string;
      new_departure_datetime?: string;
      new_arrival_datetime?: string;
      delay_minutes?: number;
    }> = [];

    for (const fs of delayedFlights) {
      const flight_schedule_id = Number(fs.flight_schedule_id);

      const suggestion = await suggestNextScheduleWindow({
        flight_schedule_id,
        stepMinutes: 30,
        horizonHours: 12,
        minLeadMinutes: 30,
      });

      if (!suggestion) {
        results.push({
          flight_schedule_id,
          action: 'no_window',
          message: 'No available crew window found within search horizon',
        });
        continue;
      }

      const aircraftConflict = await query<any[]>(
        `SELECT flight_schedule_id
         FROM Flight_schedules
         WHERE aircraft_id = ?
           AND flight_schedule_id != ?
           AND flight_status NOT IN ('Cancelled','Completed')
           AND (
             (departure_datetime <= ? AND arrival_datetime >= ?) OR
             (departure_datetime <= ? AND arrival_datetime >= ?) OR
             (departure_datetime >= ? AND arrival_datetime <= ?)
           )
         LIMIT 1`,
        [
          fs.aircraft_id,
          flight_schedule_id,
          suggestion.new_departure_datetime,
          suggestion.new_departure_datetime,
          suggestion.new_arrival_datetime,
          suggestion.new_arrival_datetime,
          suggestion.new_departure_datetime,
          suggestion.new_arrival_datetime,
        ]
      );

      if (aircraftConflict.length > 0) {
        results.push({
          flight_schedule_id,
          action: 'skipped',
          message: 'Suggested window has aircraft conflict',
        });
        continue;
      }

      const gateConflict = await query<any[]>(
        `SELECT flight_schedule_id
         FROM Flight_schedules
         WHERE gate_id = ?
           AND flight_schedule_id != ?
           AND flight_status NOT IN ('Cancelled','Completed')
           AND (
             (departure_datetime <= ? AND arrival_datetime >= ?) OR
             (departure_datetime <= ? AND arrival_datetime >= ?) OR
             (departure_datetime >= ? AND arrival_datetime <= ?)
           )
         LIMIT 1`,
        [
          fs.gate_id,
          flight_schedule_id,
          suggestion.new_departure_datetime,
          suggestion.new_departure_datetime,
          suggestion.new_arrival_datetime,
          suggestion.new_arrival_datetime,
          suggestion.new_departure_datetime,
          suggestion.new_arrival_datetime,
        ]
      );

      if (gateConflict.length > 0) {
        results.push({
          flight_schedule_id,
          action: 'skipped',
          message: 'Suggested window has gate conflict',
        });
        continue;
      }

      await query(
        `UPDATE Flight_schedules
         SET departure_datetime = ?,
             arrival_datetime = ?,
             delay_minutes = ?,
             delay_reason = ?
         WHERE flight_schedule_id = ?`,
        [
          suggestion.new_departure_datetime,
          suggestion.new_arrival_datetime,
          suggestion.delay_minutes,
          'Auto-rescheduled due to crew shortage',
          flight_schedule_id,
        ]
      );

      await createTasksForSchedule(flight_schedule_id);

      const crewRes: any = await autoAssignStaffForSchedule(flight_schedule_id);
      const newStatus = statusFromCrewValidation(crewRes);

      if (crewRes.kind === 'ok' && newStatus === 'Scheduled') {
        await query(
          `UPDATE Flight_schedules
           SET flight_status = 'Scheduled',
               delay_reason = NULL
           WHERE flight_schedule_id = ?`,
          [flight_schedule_id]
        );

        results.push({
          flight_schedule_id,
          action: 'scheduled',
          message: 'Rescheduled + crew assigned successfully; flight set to Scheduled',
          new_departure_datetime: suggestion.new_departure_datetime,
          new_arrival_datetime: suggestion.new_arrival_datetime,
          delay_minutes: suggestion.delay_minutes,
        });
      } else {
     
        await query(
          `UPDATE Flight_schedules
           SET flight_status = 'Delayed'
           WHERE flight_schedule_id = ?`,
          [flight_schedule_id]
        );

        results.push({
          flight_schedule_id,
          action: 'rescheduled',
          message: 'Rescheduled but still insufficient crew; flight remains Delayed',
          new_departure_datetime: suggestion.new_departure_datetime,
          new_arrival_datetime: suggestion.new_arrival_datetime,
          delay_minutes: suggestion.delay_minutes,
        });
      }
    }

    return successResponse(
      {
        processed: delayedFlights.length,
        results,
      },
      'Crew retry cron executed'
    );
  } catch (error: any) {
    console.error('Cron crew-retry error:', error);
    return errorResponse('Failed to run crew retry cron: ' + error.message, 500);
  }
}
