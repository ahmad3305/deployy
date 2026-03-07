export interface AircraftType {
  aircraft_type_id: number;
  model_name: string;
  manufacturer: string;
  seat_capacity: number;
}

export interface Aircraft {
  aircraft_id: number;
  airline_id: number;
  aircraft_type_id: number;
  registration_number: string;
  status: 'Active' | 'Maintenance' | 'Retired';
  economy_seats: number;
  business_seats: number;
  first_class_seats: number;
  max_speed_kmh: number;
  fuel_capacity_litres: number;
  manufactered_date: Date;
  latest_maintenance: Date | null;
  next_maintenance_due: Date | null;
  current_airport: number;
  created_at: Date;
}

export interface AircraftMaintenance {
  maintenance_id: number;
  aircraft_id: number;
  maintenance_date: Date;
  maintenance_type: 'Inspection' | 'Repair' | 'Engine Check' | 'Cleaning';
  description: string | null;
  technical_issues_found: number;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
}