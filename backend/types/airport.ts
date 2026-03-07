export interface Airport {
  airport_id: number;
  airport_name: string;
  city: string;
  country: string;
  airport_code: string;
  timezone: string;
  created_at: Date;
}

export interface Terminal {
  terminal_id: number;
  airport_id: number;
  terminal_name: string;
  terminal_code: string;
  created_at: Date;
}

export interface Gate {
  gate_id: number;
  terminal_id: number;
  gate_number: string;
  status: 'active' | 'maintenance';
  created_at: Date;
}

export interface Runway {
  runway_id: number;
  airport_id: number;
  runway_code: string;
  length: number;
  status: 'active' | 'maintenance';
  created_at: Date;
}

export interface RunwayBooking {
  booking_id: number;
  runway_id: number;
  aircraft_id: number;
  booking_date: Date;
  start_time: string;
  end_time: string;
  booking_status: 'Reserved' | 'Approved' | 'Cancelled' | 'Completed';
  created_at: Date;
}

export interface GateAssignment {
  Assignment_id: number;
  gate_id: number;
  flight_schedule_id: number;
  assigned_date: Date;
  start_time: string;
  end_time: string;
}