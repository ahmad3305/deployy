export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/response';
import { releaseStaffForSchedule } from '@/utils/crew-validator';

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

    const groundRows = await query<any[]>(
      `
      SELECT DISTINCT fs.flight_schedule_id
      FROM Flight_schedules fs
      JOIN Tasks t ON t.flight_schedule_id = fs.flight_schedule_id
      JOIN Task_Assignments ta ON ta.task_id = t.task_id
      WHERE ta.assignment_status = 'Assigned'
        AND (
          fs.flight_status = 'Cancelled'
          OR (fs.departure_datetime IS NOT NULL AND fs.departure_datetime <= NOW())
        )
      ORDER BY fs.flight_schedule_id ASC
      LIMIT 200
      `
    );

    const flightRows = await query<any[]>(
      `
      SELECT DISTINCT fs.flight_schedule_id
      FROM Flight_schedules fs
      JOIN Tasks t ON t.flight_schedule_id = fs.flight_schedule_id
      JOIN Task_Assignments ta ON ta.task_id = t.task_id
      WHERE ta.assignment_status = 'Assigned'
        AND (
          fs.flight_status = 'Cancelled'
          OR (fs.arrival_datetime IS NOT NULL AND fs.arrival_datetime <= NOW())
        )
      ORDER BY fs.flight_schedule_id ASC
      LIMIT 200
      `
    );

    const results: Array<{ flight_schedule_id: number; released: 'ground' | 'flight' }> = [];

    for (const r of groundRows) {
      const id = Number(r.flight_schedule_id);
      await releaseStaffForSchedule(id, 'ground');
      results.push({ flight_schedule_id: id, released: 'ground' });
    }

    for (const r of flightRows) {
      const id = Number(r.flight_schedule_id);
      await releaseStaffForSchedule(id, 'flight');
      results.push({ flight_schedule_id: id, released: 'flight' });
    }

    return successResponse(
      { ground_processed: groundRows.length, flight_processed: flightRows.length, results },
      'Crew release cron executed'
    );
  } catch (error: any) {
    console.error('Cron crew-release error:', error);
    return errorResponse('Failed to run crew release cron: ' + error.message, 500);
  }
}
