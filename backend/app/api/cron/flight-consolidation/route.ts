export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/response';

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

    const sources = await query<any[]>(
      `
      SELECT
        fs.flight_schedule_id,
        fs.departure_datetime,
        COUNT(t.ticket_id) AS active_passengers
      FROM Flight_schedules fs
      LEFT JOIN Tickets t
        ON t.flight_schedule_id = fs.flight_schedule_id
       AND t.status NOT IN ('Cancelled','Moved')
      WHERE fs.flight_status NOT IN ('Cancelled','Completed','Departed')
        AND fs.departure_datetime IS NOT NULL
        AND fs.departure_datetime > NOW()
        AND fs.departure_datetime <= DATE_ADD(NOW(), INTERVAL 2 HOUR)
      GROUP BY fs.flight_schedule_id, fs.departure_datetime
      HAVING active_passengers > 0 AND active_passengers < 50
      ORDER BY fs.departure_datetime ASC
      LIMIT 25
      `
    );

    const results: Array<{
      source_flight_schedule_id: number;
      active_passengers: number;
      executed: boolean;
      message?: string;
    }> = [];

    for (const row of sources) {
      const sourceId = Number(row.flight_schedule_id);
      const pax = Number(row.active_passengers);

      try {
        const res = await fetch(new URL('/api/flight-consolidation/execute', request.url), {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-cron-secret': process.env.CRON_SECRET || '',
          },
          body: JSON.stringify({
            source_flight_schedule_id: sourceId,
            reason: `Auto consolidation (cron): < 50 pax (=${pax}) and departure within 2h`,
            window_start_hours: 24,
            window_end_hours: 36,
          }),
        });

        const payload = await res.json().catch(() => ({}));

        if (!res.ok) {
          results.push({
            source_flight_schedule_id: sourceId,
            active_passengers: pax,
            executed: false,
            message: payload?.message || payload?.error || `execute failed (${res.status})`,
          });
          continue;
        }

        results.push({
          source_flight_schedule_id: sourceId,
          active_passengers: pax,
          executed: true,
          message: payload?.message || 'ok',
        });
      } catch (e: any) {
        results.push({
          source_flight_schedule_id: sourceId,
          active_passengers: pax,
          executed: false,
          message: e?.message || 'unknown error',
        });
      }
    }

    return successResponse(
      {
        checked: sources.length,
        executed: results.filter((r) => r.executed).length,
        results,
      },
      'Auto flight consolidation cron executed'
    );
  } catch (error: any) {
    console.error('Cron flight-consolidation error:', error);
    return errorResponse('Failed to run flight consolidation cron: ' + error.message, 500);
  }
}
