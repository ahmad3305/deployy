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

export type CrewAssignmentPlan = {
  byRole: Record<CrewRole, number[]>;
};

export type CrewValidationWithPlan =
  | ({ kind: 'ok' } & { requirements: CrewRequirementRow[]; plan: CrewAssignmentPlan })
  | ({ kind: 'pending_schedule' } & { reason: string })
  | ({ kind: 'insufficient_crew' } & { shortages: CrewShortage[]; requirements: CrewRequirementRow[] });

const CREW_ROLES: CrewRole[] = [
  'Pilot',
  'Co-Pilot',
  'Cabin Crew',
  'Check-in Staff',
  'Boarding Staff',
  'Baggage Handler',
  'Ramp Operator',
  'Maintenance Crew',
  'Supervisor',
];

function toDate(v: string) {
  return new Date(v.replace(' ', 'T') + 'Z');
}

function extractDatePart(dt: Date) {
  return dt.toISOString().slice(0, 10);
}
function extractTimePart(dt: Date) {
  return dt.toISOString().slice(11, 19);
}

function taskTypeForRole(role: CrewRole) {
  switch (role) {
    case 'Pilot':
    case 'Co-Pilot':
      return 'Pilot Operation';
    case 'Cabin Crew':
      return 'Cabin Preparation';
    case 'Check-in Staff':
      return 'Cabin Preparation';
    case 'Boarding Staff':
      return 'Boarding';
    case 'Baggage Handler':
      return 'Baggage Loading';
    case 'Ramp Operator':
      return 'Baggage Unloading';
    case 'Maintenance Crew':
      return 'Technical Check';
    case 'Supervisor':
      return 'Boarding';
    default:
      return 'Cabin Preparation';
  }
}

const TASK_TYPES_WITH_OVERLAP = [
  'Pilot Operation',
  'Cabin Preparation',
  'Boarding',
  'Baggage Loading',
  'Baggage Unloading',
  'Aircraft Cleaning',
  'Technical Check',
] as const;

function formatSqlDateTimeUTC(dt: Date) {
  return dt.toISOString().slice(0, 19).replace('T', ' ');
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

  if (extractDatePart(scheduleStart) !== extractDatePart(scheduleEnd)) return [];

  const shiftDate = extractDatePart(scheduleStart);
  const startTime = extractTimePart(scheduleStart);
  const endTime = extractTimePart(scheduleEnd);

  const candidates = await query<any[]>(
    `
    SELECT DISTINCT s.staff_id
    FROM Staff s
    INNER JOIN Shifts sh ON sh.staff_id = s.staff_id
    WHERE s.status = 'Active'
      AND s.role = ?
      AND sh.shift_date = ?
      AND sh.availability_status = 'Available'
      AND sh.shift_start <= ?
      AND sh.shift_end >= ?
      AND NOT EXISTS (
        SELECT 1
        FROM Task_Assignments ta
        INNER JOIN Tasks t ON t.task_id = ta.task_id
        WHERE ta.staff_id = s.staff_id
          AND ta.assignment_status = 'Assigned'
          AND t.task_type IN (${TASK_TYPES_WITH_OVERLAP.map(() => '?').join(', ')})
          AND (t.start_time < ? AND t.end_time > ?)
      )
    ORDER BY s.staff_id ASC
    `,
    [
      role,
      shiftDate,
      startTime,
      endTime,
      ...TASK_TYPES_WITH_OVERLAP,
      formatSqlDateTimeUTC(scheduleEnd),
      formatSqlDateTimeUTC(scheduleStart),
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

  if (!schedule) return { kind: 'pending_schedule', reason: 'Flight schedule not found' };
  if (!schedule.departure_datetime || !schedule.arrival_datetime) {
    return { kind: 'pending_schedule', reason: 'Schedule has no departure/arrival times yet' };
  }

  const scheduleStart = toDate(schedule.departure_datetime);
  const scheduleEnd = toDate(schedule.arrival_datetime);

  if (isNaN(scheduleStart.getTime())) return { kind: 'pending_schedule', reason: 'Invalid departure_datetime' };
  if (isNaN(scheduleEnd.getTime())) return { kind: 'pending_schedule', reason: 'Invalid arrival_datetime' };
  if (scheduleEnd <= scheduleStart) {
    return { kind: 'pending_schedule', reason: 'arrival_datetime must be after departure_datetime' };
  }

  const requirements = await getRequirementsForSchedule(flight_schedule_id);

  if (requirements.length === 0) {
    return {
      kind: 'insufficient_crew',
      requirements: [],
      shortages: [{ role: 'Pilot', required: 1, found: 0 }],
    };
  }

  const plan: CrewAssignmentPlan = {
    byRole: CREW_ROLES.reduce((acc, r) => {
      acc[r] = [];
      return acc;
    }, {} as Record<CrewRole, number[]>),
  };

  const shortages: CrewShortage[] = [];

  for (const req of requirements) {
    const role = req.role_required;
    const needed = req.number_required;

    const available = await findAvailableStaffIdsForRole({ role, scheduleStart, scheduleEnd });
    const picked = available.slice(0, needed);

    plan.byRole[role] = picked;

    if (picked.length < needed) shortages.push({ role, required: needed, found: picked.length });
  }

  if (shortages.length > 0) {
    return { kind: 'insufficient_crew', requirements, shortages };
  }

  return { kind: 'ok', requirements, plan };
}

export async function createTasksForSchedule(flight_schedule_id: number) {
  const schedule = await queryOne<any>(
    `SELECT departure_datetime, arrival_datetime
     FROM Flight_schedules
     WHERE flight_schedule_id = ?`,
    [flight_schedule_id]
  );
  if (!schedule) throw new Error('Flight schedule not found');
  if (!schedule.departure_datetime || !schedule.arrival_datetime) {
    throw new Error('Schedule has no departure/arrival times yet');
  }

  const requirements = await getRequirementsForSchedule(flight_schedule_id);
  if (requirements.length === 0) throw new Error('No crew requirements found');
  
  const counts = await queryOne<any>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN task_status IN ('Pending','Assigned','In Progress') THEN 1 ELSE 0 END) AS open_count
     FROM Tasks
     WHERE flight_schedule_id = ?`,
    [flight_schedule_id]
  );

  const total = Number(counts?.total || 0);
  const openCount = Number(counts?.open_count || 0);

  if (total > 0 && openCount > 0) return;

  if (total > 0 && openCount === 0) {
    await query(
      `DELETE ta
       FROM Task_Assignments ta
       JOIN Tasks t ON t.task_id = ta.task_id
       WHERE t.flight_schedule_id = ?`,
      [flight_schedule_id]
    );

    await query(`DELETE FROM Tasks WHERE flight_schedule_id = ?`, [flight_schedule_id]);
  }

  for (const req of requirements) {
    const task_type = taskTypeForRole(req.role_required);
    for (let i = 0; i < req.number_required; i++) {
      await query(
        `INSERT INTO Tasks (flight_schedule_id, task_type, required_role, start_time, end_time, task_status)
         VALUES (?, ?, ?, ?, ?, 'Pending')`,
        [
          flight_schedule_id,
          task_type,
          req.role_required,
          schedule.departure_datetime,
          schedule.arrival_datetime,
        ]
      );
    }
  }
}

export async function autoAssignStaffForSchedule(flight_schedule_id: number) {
  const res = await validateAndPlanCrewForSchedule(flight_schedule_id);
  if (res.kind !== 'ok') return res;

  const schedule = await queryOne<any>(
    `SELECT DATE(departure_datetime) as dep_date
     FROM Flight_schedules
     WHERE flight_schedule_id = ?`,
    [flight_schedule_id]
  );
  const depDate = schedule?.dep_date;
  if (!depDate) return { kind: 'pending_schedule', reason: 'Invalid departure date' } as any;

  for (const req of res.requirements) {
    const role = req.role_required;
    const staffIds = res.plan.byRole[role] || [];
    if (staffIds.length === 0) continue;

    const tasks = await query<any[]>(
      `SELECT task_id
       FROM Tasks
       WHERE flight_schedule_id = ?
         AND required_role = ?
         AND task_status = 'Pending'
       ORDER BY task_id ASC`,
      [flight_schedule_id, role]
    );

    const n = Math.min(tasks.length, staffIds.length);
    for (let i = 0; i < n; i++) {
      const task_id = Number(tasks[i].task_id);
      const staff_id = Number(staffIds[i]);

      await query(
        `INSERT INTO Task_Assignments (task_id, staff_id, assignment_status)
         VALUES (?, ?, 'Assigned')`,
        [task_id, staff_id]
      );

      await query(`UPDATE Tasks SET task_status = 'Assigned' WHERE task_id = ?`, [task_id]);

      await query(
        `UPDATE Shifts
         SET availability_status = 'Assigned'
         WHERE staff_id = ?
           AND shift_date = ?
           AND availability_status = 'Available'`,
        [staff_id, depDate]
      );
    }
  }

  return res;
}

export async function releaseStaffForSchedule(
  flight_schedule_id: number,
  mode: 'ground' | 'flight' | 'all' = 'all'
) {
  const schedule = await queryOne<any>(
    `SELECT DATE(departure_datetime) as dep_date
     FROM Flight_schedules
     WHERE flight_schedule_id = ?`,
    [flight_schedule_id]
  );
  const depDate = schedule?.dep_date;

  const FLIGHT_ROLES: CrewRole[] = ['Pilot', 'Co-Pilot', 'Cabin Crew'];
  const GROUND_ROLES: CrewRole[] = [
    'Check-in Staff',
    'Boarding Staff',
    'Baggage Handler',
    'Ramp Operator',
    'Maintenance Crew',
    'Supervisor',
  ];

  const roles =
    mode === 'flight'
      ? FLIGHT_ROLES
      : mode === 'ground'
        ? GROUND_ROLES
        : [...FLIGHT_ROLES, ...GROUND_ROLES];

  const assigned = await query<any[]>(
    `SELECT DISTINCT ta.staff_id
     FROM Task_Assignments ta
     JOIN Tasks t ON t.task_id = ta.task_id
     JOIN Staff s ON s.staff_id = ta.staff_id
     WHERE t.flight_schedule_id = ?
       AND ta.assignment_status = 'Assigned'
       AND s.role IN (${roles.map(() => '?').join(',')})`,
    [flight_schedule_id, ...roles]
  );

  const staffIds = assigned.map((r) => Number(r.staff_id));
  if (staffIds.length === 0) return;

  if (depDate) {
    await query(
      `UPDATE Shifts
       SET availability_status = 'Available'
       WHERE staff_id IN (${staffIds.map(() => '?').join(',')})
         AND shift_date = ?`,
      [...staffIds, depDate]
    );
  } else {
    await query(
      `UPDATE Shifts
       SET availability_status = 'Available'
       WHERE staff_id IN (${staffIds.map(() => '?').join(',')})`,
      staffIds
    );
  }

  await query(
    `UPDATE Task_Assignments ta
     JOIN Tasks t ON t.task_id = ta.task_id
     JOIN Staff s ON s.staff_id = ta.staff_id
     SET ta.assignment_status = 'Completed', ta.end_time = NOW()
     WHERE t.flight_schedule_id = ?
       AND ta.assignment_status = 'Assigned'
       AND s.role IN (${roles.map(() => '?').join(',')})`,
    [flight_schedule_id, ...roles]
  );

  await query(
    `UPDATE Tasks
     SET task_status = 'Completed'
     WHERE flight_schedule_id = ?
       AND required_role IN (${roles.map(() => '?').join(',')})
       AND task_status IN ('Pending','Assigned','In Progress')`,
    [flight_schedule_id, ...roles]
  );
}

export async function suggestNextScheduleWindow(params: {
  flight_schedule_id: number;
  stepMinutes?: number;
  horizonHours?: number;
  minLeadMinutes?: number;
}): Promise<null | { new_departure_datetime: string; new_arrival_datetime: string; delay_minutes: number }> {
  const { flight_schedule_id } = params;
  const stepMinutes = params.stepMinutes ?? 30;
  const horizonHours = params.horizonHours ?? 12;
  const minLeadMinutes = params.minLeadMinutes ?? 60;

  const schedule = await queryOne<any>(
    `SELECT flight_schedule_id, departure_datetime, arrival_datetime
     FROM Flight_schedules
     WHERE flight_schedule_id = ?`,
    [flight_schedule_id]
  );

  if (!schedule?.departure_datetime || !schedule?.arrival_datetime) return null;

  const originalDeparture = toDate(schedule.departure_datetime);
  const originalArrival = toDate(schedule.arrival_datetime);
  const durationMs = originalArrival.getTime() - originalDeparture.getTime();
  if (durationMs <= 0) return null;

  const requirements = await getRequirementsForSchedule(flight_schedule_id);
  if (requirements.length === 0) return null;

  const now = new Date();
  const startSearch = new Date(now.getTime() + minLeadMinutes * 60 * 1000);
  const endSearch = new Date(now.getTime() + horizonHours * 60 * 60 * 1000);

  let cursor = new Date(startSearch);
  cursor.setUTCSeconds(0, 0);
  const m = cursor.getUTCMinutes();
  const rem = m % stepMinutes;
  if (rem !== 0) cursor.setUTCMinutes(m + (stepMinutes - rem));

  while (cursor <= endSearch) {
    const candidateStart = new Date(cursor);
    const candidateEnd = new Date(candidateStart.getTime() + durationMs);

    if (extractDatePart(candidateStart) !== extractDatePart(candidateEnd)) {
      cursor = new Date(cursor.getTime() + stepMinutes * 60 * 1000);
      continue;
    }

    let ok = true;
    for (const req of requirements) {
      const available = await findAvailableStaffIdsForRole({
        role: req.role_required,
        scheduleStart: candidateStart,
        scheduleEnd: candidateEnd,
      });

      if (available.length < req.number_required) {
        ok = false;
        break;
      }
    }

    if (ok) {
      const delayMinutes = Math.max(
        0,
        Math.round((candidateStart.getTime() - originalDeparture.getTime()) / (60 * 1000))
      );

      return {
        new_departure_datetime: formatSqlDateTimeUTC(candidateStart),
        new_arrival_datetime: formatSqlDateTimeUTC(candidateEnd),
        delay_minutes: delayMinutes,
      };
    }

    cursor = new Date(cursor.getTime() + stepMinutes * 60 * 1000);
  }

  return null;
}