export interface Staff {
  staff_id: number;
  airport_id: number;
  first_name: string;
  last_name: string;
  role: 'Pilot' | 'Co-Pilot' | 'Cabin Crew' | 'Check-in Staff' | 'Boarding Staff' | 'Baggage Handler' | 'Ramp Operator' | 'Maintenance Crew' | 'Supervisor';
  staff_type: 'Flight Crew' | 'Ground Staff';
  hire_date: Date | null;
  license_number: string | null;
  status: 'Active' | 'On Leave' | 'Inactive';
  created_at: Date;
}

export interface Shift {
  shift_id: number;
  staff_id: number;
  shift_date: Date;
  shift_start: string;
  shift_end: string;
  availability_status: 'Available' | 'Assigned' | 'Off';
}