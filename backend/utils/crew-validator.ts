import { query, queryOne } from '@/lib/db';
import type { CrewRole, CrewShortage, CrewValidationResult } from './flight-status';

type FlightScheduleRow = {
  flight_schedule_id: number;
  aircraft_id: number;
  departure_datetime: string | null; 
  arrival_datetime: string | null;
  flight_status: string;
};

type CrewRequirementRow = {
  role_required: CrewRole;
  number_required: number;
};

type StaffRow = {
  staff_id: number;
  role: CrewRole;
  staff_type: 'Flight Crew' | 'Ground Staff';
  status: 'Active' | 'On Leave' | 'Inactive';
};

export type CrewAssignmentPlan = {
  byRole: Record<CrewRole, number[]>; 
};

export type CrewValidationWithPlan =
  | ({ kind: 'ok' } & { requirements: CrewRequirementRow[]; plan: CrewAssignmentPlan })
  | ({ kind: 'pending_schedule' } & { reason: string })
  | ({ kind: 'insufficient_crew' } & { shortages: CrewShortage[]; requirements: CrewRequirementRow[] });

const CREW_ROLES: CrewRole[] = ['Pilot', 'Co-Pilot', 'Cabin Crew'];


function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

function toDate(v: string) {
  
  return new Date(v.replace(' ', 'T') + 'Z');
}


function extractDatePart(dt: Date) {
  return dt.toISOString().slice(0, 10); 
}
function extractTimePart(dt: Date) {
  return dt.toISOString().slice(11, 19); 
}

async function getRequirementsForSchedule(flight_schedule_id: number): Promise<CrewRequirementRow[]> {
  const rows = await query<any[]>(
    `SELECT role_required, number_required
     FROM Crew_requirements
     WHERE flight_schedule_id = ?`,
    [flight_schedule_id]
  );

  const normalized: CrewRequirementRow[] = (rows || [])
    .map((r) => ({
      role_required: r.role_required as CrewRole,
      number_required: Number(r.number_required),
    }))
    .filter((r) => CREW_ROLES.includes(r.role_required))
    .filter((r) => r.number_required > 0);

  return normalized;
}


async function findAvailableStaffIdsForRole(params: {
  role: CrewRole;
  scheduleStart: Date;
  scheduleEnd: Date;
}): Promise<number[]> {
  const { role, scheduleStart, scheduleEnd } = params;

  if (extractDatePart(scheduleStart) !== extractDatePart(scheduleEnd)) {
    return [];
  }

  const shiftDate = extractDatePart(scheduleStart);
  const startTime = extractTimePart(scheduleStart);
  const endTime = extractTimePart(scheduleEnd);

  
  const CREW_TASK_TYPES = ['Pilot Operation', 'Cabin Preparation'];

  const candidates = await query<any[]>(
    `
    SELECT DISTINCT s.staff_id
    FROM Staff s
    INNER JOIN Shifts sh
      ON sh.staff_id = s.staff_id
    WHERE s.status = 'Active'
      AND s.staff_type = 'Flight Crew'
      AND s.role = ?
      AND sh.shift_date = ?
      AND sh.availability_status <> 'Off'
      AND sh.shift_start <= ?
      AND sh.shift_end >= ?
      -- Not already assigned to an overlapping crew task
      AND NOT EXISTS (
        SELECT 1
        FROM Task_Assignments ta
        INNER JOIN Tasks t ON t.task_id = ta.task_id
        WHERE ta.staff_id = s.staff_id
          AND ta.assignment_status = 'Assigned'
          AND t.task_type IN (${CREW_TASK_TYPES.map(() => '?').join(', ')})
          -- overlap check: existing task overlaps schedule window
          AND (t.start_time < ? AND t.end_time > ?)
      )
    ORDER BY s.staff_id ASC
    `,
    [
      role,
      shiftDate,
      startTime,
      endTime,
      ...CREW_TASK_TYPES,
      scheduleEnd.toISOString().slice(0, 19).replace('T', ' '),
      scheduleStart.toISOString().slice(0, 19).replace('T', ' '),
    ]
  );

  return (candidates || []).map((r) => Number(r.staff_id));
}


export async function validateAndPlanCrewForSchedule(
  flight_schedule_id: number
): Promise<CrewValidationWithPlan> {
  const schedule = await queryOne<FlightScheduleRow>(
    `SELECT flight_schedule_id, aircraft_id, departure_datetime, arrival_datetime, flight_status
     FROM Flight_schedules
     WHERE flight_schedule_id = ?`,
    [flight_schedule_id]
  );

  if (!schedule) {
    return { kind: 'pending_schedule', reason: 'Flight schedule not found' };
  }

  if (!schedule.departure_datetime || !schedule.arrival_datetime) {
    return { kind: 'pending_schedule', reason: 'Schedule has no departure/arrival times yet' };
  }

  const scheduleStart = toDate(schedule.departure_datetime);
  const scheduleEnd = toDate(schedule.arrival_datetime);

  if (!(scheduleStart instanceof Date) || isNaN(scheduleStart.getTime())) {
    return { kind: 'pending_schedule', reason: 'Invalid departure_datetime' };
  }
  if (!(scheduleEnd instanceof Date) || isNaN(scheduleEnd.getTime())) {
    return { kind: 'pending_schedule', reason: 'Invalid arrival_datetime' };
  }
  if (scheduleEnd <= scheduleStart) {
    return { kind: 'pending_schedule', reason: 'arrival_datetime must be after departure_datetime' };
  }

  const requirements = await getRequirementsForSchedule(flight_schedule_id);

  
  if (requirements.length === 0) {
    return {
      kind: 'insufficient_crew',
      requirements: [],
      shortages: [
        { role: 'Pilot', required: 1, found: 0 }, // a "nudge" shortage to force hold/delay until requirements are set
      ],
    };
  }

  const plan: CrewAssignmentPlan = {
    byRole: {
      'Pilot': [],
      'Co-Pilot': [],
      'Cabin Crew': [],
    },
  };

  const shortages: CrewShortage[] = [];

  
  for (const req of requirements) {
    const role = req.role_required;
    const needed = req.number_required;

    const available = await findAvailableStaffIdsForRole({
      role,
      scheduleStart,
      scheduleEnd,
    });

    const picked = available.slice(0, needed);
    plan.byRole[role] = picked;

    if (picked.length < needed) {
      shortages.push({ role, required: needed, found: picked.length });
    }
  }

  if (shortages.length > 0) {
    return {
      kind: 'insufficient_crew',
      requirements,
      shortages,
    };
  }

  return {
    kind: 'ok',
    requirements,
    plan,
  };
}