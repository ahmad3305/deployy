import { z } from 'zod';

// Airport validation schemas
export const airportCreateSchema = z.object({
  airport_name: z.string().min(1).max(255),
  airport_code: z.string().length(3).or(z.string().length(4)), // IATA or ICAO
  city: z.string().min(1).max(100),
  country: z.string().min(1).max(100),
  timezone: z.string().min(1).max(100),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const airportUpdateSchema = z.object({
  airport_name: z.string().min(1).max(255).optional(),
  airport_code: z.string().length(3).or(z.string().length(4)).optional(),
  city: z.string().min(1).max(100).optional(),
  country: z.string().min(1).max(100).optional(),
  timezone: z.string().min(1).max(100).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

// ========== Aircraft Type Validations ==========
export const aircraftTypeCreateSchema = z.object({
  model_name: z.string().min(1).max(100),
  manufacturer: z.string().min(1).max(100),
  seat_capacity: z.number().int().positive(),
});

export const aircraftTypeUpdateSchema = aircraftTypeCreateSchema.partial();

// ========== Aircraft Validations ==========
export const aircraftCreateSchema = z.object({
  airline_id: z.number().int().positive(),
  aircraft_type_id: z.number().int().positive(),
  registration_number: z.string().min(1).max(50),
  status: z.enum(['Active', 'Maintenance', 'Retired']).default('Active'),
  economy_seats: z.number().int().min(0),
  business_seats: z.number().int().min(0),
  first_class_seats: z.number().int().min(0),
  max_speed_kmh: z.number().int().positive(),
  fuel_capacity_litres: z.number().int().positive(),
  manufactered_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  latest_maintenance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  next_maintenance_due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  current_airport: z.number().int().positive(),
});

export const aircraftUpdateSchema = aircraftCreateSchema.partial();

// ========== Flight Validations ==========
export const flightCreateSchema = z.object({
  airline_id: z.number().int().positive(),
  flight_number: z.number().int().positive(),
  source_airport_id: z.number().int().positive(),
  destination_airport_id: z.number().int().positive(),
  flight_type: z.enum(['Passenger', 'Cargo', 'Private']).default('Passenger'),
  estimated_duration: z.string().regex(/^\d{2}:\d{2}:\d{2}$/), // HH:MM:SS
});

export const flightUpdateSchema = flightCreateSchema.partial();

// ========== Flight Schedule Validations ==========
export const flightScheduleCreateSchema = z.object({
  flight_id: z.number().int().positive(),
  aircraft_id: z.number().int().positive(),
  departure_datetime: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/), // YYYY-MM-DD HH:MM:SS
  arrival_datetime: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
  gate_id: z.number().int().positive(),
  flight_status: z.enum(['Scheduled', 'Boarding', 'Departed', 'Delayed', 'Cancelled', 'Completed', 'Consolidated']).default('Scheduled'),
});

export const flightScheduleUpdateSchema = flightScheduleCreateSchema.partial();

// ========== Passenger Validations ==========
export const passengerCreateSchema = z.object({
  first_name: z.string().min(1).max(50),
  last_name: z.string().min(1).max(50),
  gender: z.enum(['male', 'female']),
  passport_number: z.string().min(1).max(50),
  nationality: z.string().min(1).max(50),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contact_number: z.string().min(1).max(50),
  email: z.string().email().max(50),
});

export const passengerUpdateSchema = passengerCreateSchema.partial();

// ========== Ticket Validations ==========
export const ticketCreateSchema = z.object({
  passenger_id: z.number().int().positive(),
  flight_schedule_id: z.number().int().positive(),
  seat_number: z.string().min(1).max(50),
  seat_class: z.enum(['Economy', 'Business', 'First']),
  ticket_price: z.number().int().positive(),
  status: z.enum(['Confirmed', 'Checked-In', 'Boarded', 'Cancelled', 'Moved']).default('Confirmed'),
});

export const ticketUpdateSchema = ticketCreateSchema.partial();

// ========== Cargo Validations ==========
export const cargoCreateSchema = z.object({
  flight_id: z.number().int().positive(),
  tracking_number: z.string().min(1).max(10),
  cargo_type: z.enum(['General', 'Perishable', 'Hazardous', 'Fragile', 'Live Animals', 'Mail']),
  description: z.string().optional().nullable(),
  weight_kg: z.number().positive(),
  origin_airport_id: z.number().int().positive(),
  destination_airport_id: z.number().int().positive(),
  sender_name: z.string().min(1).max(50),
  sender_contact: z.string().min(1).max(50),
  reciever_name: z.string().min(1).max(50),
  reciever_contact: z.string().min(1).max(50),
  status: z.enum(['Booked', 'Loaded', 'In Transit', 'Unloaded', 'Customs Hold', 'Delivered', 'Cancelled']).default('Booked'),
  is_insured: z.boolean().default(false),
});

export const cargoUpdateSchema = cargoCreateSchema.partial();

// ========== Payment Validations ==========
export const paymentCreateSchema = z.object({
  ticket_id: z.number().int().positive().optional().nullable(),
  cargo_id: z.number().int().positive().optional().nullable(),
  amount: z.number().positive(),
  payment_method: z.enum(['Credit Card', 'Cash', 'Online Transfer']),
  payment_status: z.enum(['Pending', 'Completed', 'Failed']).default('Pending'),
});

export const paymentUpdateSchema = paymentCreateSchema.partial();

// ========== Staff Validations ==========


// ========== Helper function to validate data ==========
export function validateData<T>(
  schema: z.ZodSchema<T>, 
  data: any
): { success: boolean; data?: T; errors?: any } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        errors: error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      };
    }
    return { success: false, errors: [{ message: 'Validation failed' }] };
  }
}

// Terminal validation schemas
export const terminalCreateSchema = z.object({
  airport_id: z.number().int().positive(),
  terminal_name: z.string().min(1).max(50),
  terminal_code: z.string().min(1).max(10),
});

export const terminalUpdateSchema = z.object({
  terminal_name: z.string().min(1).max(50).optional(),
  terminal_code: z.string().min(1).max(10).optional(),
});

// Gate validation schemas
export const gateCreateSchema = z.object({
  terminal_id: z.number().int().positive(),
  gate_number: z.string().min(1).max(10),
  status: z.enum(['Available', 'Occupied', 'Maintenance']).optional(),
});

export const gateUpdateSchema = z.object({
  gate_number: z.string().min(1).max(10).optional(),
  status: z.enum(['Available', 'Occupied', 'Maintenance']).optional(),
});

// Runway validation schemas
export const runwayCreateSchema = z.object({
  airport_id: z.number().int().positive(),
  runway_number: z.string().min(1).max(10),
  length_meters: z.number().positive(),
  width_meters: z.number().positive(),
  surface_type: z.string().min(1).max(50),
  status: z.enum(['Available', 'Closed', 'Maintenance']).optional(),
});

export const runwayUpdateSchema = z.object({
  runway_number: z.string().min(1).max(10).optional(),
  length_meters: z.number().positive().optional(),
  width_meters: z.number().positive().optional(),
  surface_type: z.string().min(1).max(50).optional(),
  status: z.enum(['Available', 'Closed', 'Maintenance']).optional(),
});

// Baggage validation schemas
export const baggageCreateSchema = z.object({
  ticket_id: z.number().int().positive(),
  flight_schedule_id: z.number().int().positive(),
  weight_kg: z.number().positive(),
  baggage_type: z.enum(['Checked', 'Carry-On', 'Special']),
  tag_number: z.string().min(1).max(20),
  status: z.enum(['Checked-In', 'Loaded', 'In Transit', 'Arrived', 'Claimed', 'Lost']).optional(),
});

export const baggageUpdateSchema = z.object({
  weight_kg: z.number().positive().optional(),
  baggage_type: z.enum(['Checked', 'Carry-On', 'Special']).optional(),
  tag_number: z.string().min(1).max(20).optional(),
  status: z.enum(['Checked-In', 'Loaded', 'In Transit', 'Arrived', 'Claimed', 'Lost']).optional(),
});

// Boarding Record validation schemas
export const boardingRecordCreateSchema = z.object({
  ticket_id: z.number().int().positive(),
  gate_id: z.number().int().positive(),
  boarding_time: z.string().datetime(),
  boarding_status: z.enum(['Pending', 'Boarded', 'Denied']).optional(),
});

export const boardingRecordUpdateSchema = z.object({
  gate_id: z.number().int().positive().optional(),
  boarding_time: z.string().datetime().optional(),
  boarding_status: z.enum(['Pending', 'Boarded', 'Denied']).optional(),
});

// Crew Requirements validation schemas
export const crewRequirementCreateSchema = z.object({
  flight_schedule_id: z.number().int().positive(),
  role_required: z.string().min(1).max(100),
  number_required: z.number().int().positive(),
});

export const crewRequirementUpdateSchema = z.object({
  role_required: z.string().min(1).max(100).optional(),
  number_required: z.number().int().positive().optional(),
});

// Flight Consolidation validation schemas
export const flightConsolidationCreateSchema = z.object({
  original_flight_schedule_id: z.number().int().positive(),
  new_flight_schedule_id: z.number().int().positive(),
  reason: z.string().min(1).max(200),
  consolidation_date: z.string().datetime(),
});

export const flightConsolidationUpdateSchema = z.object({
  reason: z.string().min(1).max(200).optional(),
  consolidation_date: z.string().datetime().optional(),
});

// Flight Incidents validation schemas
export const flightIncidentCreateSchema = z.object({
  flight_schedule_id: z.number().int().positive(),
  incident_type: z.enum(['Technical Issue', 'Weather Delay', 'Crew Issue', 'Security Issue', 'Emergency']),
  description: z.string().optional(),
  reported_at: z.string().datetime().optional(),
  resolved_at: z.string().datetime().optional(),
  flight_status: z.enum(['Open', 'Resolved']).optional(),
});

export const flightIncidentUpdateSchema = z.object({
  incident_type: z.enum(['Technical Issue', 'Weather Delay', 'Crew Issue', 'Security Issue', 'Emergency']).optional(),
  description: z.string().optional(),
  resolved_at: z.string().datetime().optional(),
  flight_status: z.enum(['Open', 'Resolved']).optional(),
});



// Staff validation schemas
export const staffCreateSchema = z.object({
  airport_id: z.number().int().positive(),
  first_name: z.string().min(1).max(50),
  last_name: z.string().min(1).max(50),
  role: z.enum(['Pilot', 'Co-Pilot', 'Cabin Crew', 'Check-in Staff', 'Boarding Staff', 'Baggage Handler', 'Ramp Operator', 'Maintenance Crew', 'Supervisor']),
  staff_type: z.enum(['Flight Crew', 'Ground Staff']),
  hire_date: z.string().optional(),
  license_number: z.string().max(100).optional(),
  status: z.enum(['Active', 'On Leave', 'Inactive']).optional(),
});

export const staffUpdateSchema = z.object({
  first_name: z.string().min(1).max(50).optional(),
  last_name: z.string().min(1).max(50).optional(),
  role: z.enum(['Pilot', 'Co-Pilot', 'Cabin Crew', 'Check-in Staff', 'Boarding Staff', 'Baggage Handler', 'Ramp Operator', 'Maintenance Crew', 'Supervisor']).optional(),
  staff_type: z.enum(['Flight Crew', 'Ground Staff']).optional(),
  license_number: z.string().max(100).optional(),
  status: z.enum(['Active', 'On Leave', 'Inactive']).optional(),
});

// Shift validation schemas
export const shiftCreateSchema = z.object({
  staff_id: z.number().int().positive(),
  shift_date: z.string(),
  shift_start: z.string(),
  shift_end: z.string(),
  availability_status: z.enum(['Available', 'Assigned', 'Off']).optional(),
});

export const shiftUpdateSchema = z.object({
  shift_date: z.string().optional(),
  shift_start: z.string().optional(),
  shift_end: z.string().optional(),
  availability_status: z.enum(['Available', 'Assigned', 'Off']).optional(),
});

// Task validation schemas
export const taskCreateSchema = z.object({
  flight_schedule_id: z.number().int().positive(),
  task_type: z.enum(['Pilot Operation', 'Cabin Preparation', 'Boarding', 'Baggage Loading', 'Baggage Unloading', 'Aircraft Cleaning', 'Technical Check']),
  required_role: z.string().min(1).max(100),
  start_time: z.string(),
  end_time: z.string(),
  task_status: z.enum(['Pending', 'Assigned', 'In Progress', 'Completed']).optional(),
});

export const taskUpdateSchema = z.object({
  task_type: z.enum(['Pilot Operation', 'Cabin Preparation', 'Boarding', 'Baggage Loading', 'Baggage Unloading', 'Aircraft Cleaning', 'Technical Check']).optional(),
  required_role: z.string().min(1).max(100).optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  task_status: z.enum(['Pending', 'Assigned', 'In Progress', 'Completed']).optional(),
});

// Task Assignment validation schemas
export const taskAssignmentCreateSchema = z.object({
  task_id: z.number().int().positive(),
  staff_id: z.number().int().positive(),
  assignment_status: z.enum(['Assigned', 'Completed', 'Cancelled']).optional(),
  end_time: z.string().optional(),
});

export const taskAssignmentUpdateSchema = z.object({
  assignment_status: z.enum(['Assigned', 'Completed', 'Cancelled']).optional(),
  end_time: z.string().optional(),
});