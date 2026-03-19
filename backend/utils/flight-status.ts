export type FlightStatus =
  | 'Scheduled'
  | 'Boarding'
  | 'Departed'
  | 'Delayed'
  | 'Cancelled'
  | 'Completed'
  | 'Consolidated';

export type CrewRole =
  | 'Pilot'
  | 'Co-Pilot'
  | 'Cabin Crew'
  | 'Check-in Staff'
  | 'Boarding Staff'
  | 'Baggage Handler'
  | 'Ramp Operator'
  | 'Maintenance Crew'
  | 'Supervisor';

export type CrewShortage = {
  role: CrewRole;
  required: number;
  found: number;
};

export type CrewValidationResult =
  | {
      kind: 'pending_schedule';
      reason: string;
    }
  | {
      kind: 'insufficient_crew';
      shortages: CrewShortage[];
    }
  | {
      kind: 'ok';
    };

export function statusFromCrewValidation(res: CrewValidationResult): FlightStatus {
  if (res.kind === 'pending_schedule') return 'Scheduled';
  if (res.kind === 'insufficient_crew') return 'Delayed';
  return 'Scheduled';
}