export interface Ticket {
  ticket_id: number;
  passenger_id: number;
  flight_schedule_id: number;
  seat_number: string;
  seat_class: 'Economy' | 'Business' | 'First';
  ticket_price: number;
  booking_date: Date;
  status: 'Confirmed' | 'Checked-In' | 'Boarded' | 'Cancelled' | 'Moved';
}

export interface Baggage {
  Baggage_id: number;
  ticket_id: number;
  flight_schedule_id: number;
  weight: number;
  baggage_type: 'Checked' | 'Carry-on' | 'Cargo';
  status: 'Checked-In' | 'Loaded' | 'In Transit' | 'Unloaded' | 'Lost';
  created_at: Date;
}

export interface BoardingRecord {
  boarding_id: number;
  ticket_id: number;
  flight_schedule_id: number;
  boarding_time: Date | null;
  boarding_status: 'Pending' | 'Boarded' | 'Denied';
  gate_id: number;
  created_at: Date;
}