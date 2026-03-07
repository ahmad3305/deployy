export interface Task {
  task_id: number;
  flight_schedule_id: number;
  task_type: 'Pilot Operation' | 'Cabin Preparation' | 'Boarding' | 'Baggage Loading' | 'Baggage Unloading' | 'Aircraft Cleaning' | 'Technical Check';
  required_role: string;
  start_time: Date;
  end_time: Date;
  task_status: 'Pending' | 'Assigned' | 'In Progress' | 'Completed';
}

export interface TaskAssignment {
  assignment_id: number;
  task_id: number;
  staff_id: number;
  assignment_time: Date;
  assignment_status: 'Assigned' | 'Completed' | 'Cancelled';
  end_time: Date | null;
}