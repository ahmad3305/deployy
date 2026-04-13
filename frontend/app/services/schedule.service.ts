import { API_BASE } from "@/app/config";

export type CrewRequirement = {
  role_required: string;
  number_required: number;
};

export type FlightSchedule = {
  flight_schedule_id: number;
  flight_id: number;
  flight_number: number;
  airline_name: string;
  airline_code: string;
  flight_type: string;
  aircraft_id: number;
  registration_number: string;
  gate_id: number;
  gate_number: string;
  terminal_name: string;
  departure_datetime: string;
  arrival_datetime: string;
  source_airport_name: string;
  source_airport_code: string;
  source_city: string;
  destination_airport_name: string;
  destination_airport_code: string;
  destination_city: string;
  flight_status: string;
  delay_reason?: string | null;
  crew_requirements?: CrewRequirement[];
};

export type Aircraft = {
  aircraft_id: number;
  registration_number: string;
  status: string;
};

export type Gate = {
  gate_id: number;
  gate_number: string;
  terminal_name: string;
};

/**
 * Get a single flight schedule by ID
 * Endpoint: GET /flight-schedules/:id
 */
export async function getScheduleById(
  scheduleId: string | number,
  token?: string
): Promise<FlightSchedule> {
  const url = `${API_BASE}/flight-schedules/${scheduleId}`;
  console.log("getScheduleById URL:", url);

  const res = await fetch(url, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("getScheduleById error:", res.status, text.substring(0, 200));
    throw new Error(`HTTP ${res.status}: Failed to load schedule`);
  }

  const json = await res.json();
  if (!json.success)
    throw new Error(json.message || "Failed to load schedule");
  return json.data as FlightSchedule;
}

/**
 * Get all flight schedules (requires backend list endpoint)
 * Endpoint: GET /flight-schedules
 */
export async function getAllSchedules(
  token?: string
): Promise<FlightSchedule[]> {
  const url = `${API_BASE}/flight-schedules`;
  console.log("getAllSchedules URL:", url);

  const res = await fetch(url, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("getAllSchedules error:", res.status, text.substring(0, 200));
    throw new Error(`HTTP ${res.status}: Failed to load schedules`);
  }

  const json = await res.json();
  console.log("getAllSchedules response:", json);

  return Array.isArray(json.data) ? json.data : [];
}

/**
 * Get flight schedules filtered by status (client-side filtering fallback)
 * If backend doesn't have filter endpoint, we fetch all and filter locally
 */
export async function getSchedulesByStatus(
  status: "Scheduled" | "Delayed" | "Consolidated",
  token?: string
): Promise<FlightSchedule[]> {
  console.log("getSchedulesByStatus - requested status:", status);

  try {
    // Try backend endpoint first
    const url = `${API_BASE}/flight-schedules?flight_status=${status}`;
    console.log("Attempting backend filter URL:", url);

    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });

    if (res.ok) {
      const json = await res.json();
      console.log("Backend filter successful:", json);
      return Array.isArray(json.data) ? json.data : [];
    }

    console.log("Backend filter endpoint not available (404), using client-side filtering");
  } catch (e) {
    console.error("Backend filter error, falling back to client-side:", e);
  }

  // Fallback: fetch all schedules and filter client-side
  console.log("Fetching all schedules for client-side filtering...");
  const allSchedules = await getAllSchedules(token);
  console.log("All schedules fetched:", allSchedules.length);

  const filtered = allSchedules.filter(
    (s) => s.flight_status === status
  );
  console.log("Filtered schedules:", filtered.length);

  return filtered;
}

/**
 * Get all active aircraft
 * Endpoint: GET /aircraft
 */
export async function getAircrafts(token?: string): Promise<Aircraft[]> {
  const url = `${API_BASE}/aircraft`;
  console.log("getAircrafts URL:", url);

  const res = await fetch(url, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("getAircrafts error:", res.status, text.substring(0, 200));
    throw new Error(`HTTP ${res.status}: Failed to load aircrafts`);
  }

  const json = await res.json();
  return (Array.isArray(json.data) ? json.data : []).filter(
    (a: Aircraft) => a.status === "Active"
  );
}

/**
 * Get all gates
 * Endpoint: GET /gates
 */
export async function getGates(token?: string): Promise<Gate[]> {
  const url = `${API_BASE}/gates`;
  console.log("getGates URL:", url);

  const res = await fetch(url, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("getGates error:", res.status, text.substring(0, 200));
    throw new Error(`HTTP ${res.status}: Failed to load gates`);
  }

  const json = await res.json();
  return Array.isArray(json.data) ? json.data : [];
}

/**
 * Create a new flight schedule
 * Endpoint: POST /flight-schedules
 */
export async function createSchedule(
  body: {
    flight_id: number;
    aircraft_id: number;
    gate_id: number;
    departure_datetime: string;
    arrival_datetime: string;
    crew_requirements: CrewRequirement[];
  },
  token?: string
): Promise<FlightSchedule> {
  const url = `${API_BASE}/flight-schedules`;
  console.log("createSchedule URL:", url);
  console.log("createSchedule payload:", body);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  console.log("createSchedule response status:", res.status);

  if (!res.ok) {
    const text = await res.text();
    console.error("createSchedule error:", res.status, text.substring(0, 200));
    throw new Error(
      `HTTP ${res.status}: ${
        text.includes("<!DOCTYPE") ? "Endpoint not found" : text
      }`
    );
  }

  const json = await res.json();
  if (!json.success)
    throw new Error(json.message || "Failed to create schedule.");
  return json.data as FlightSchedule;
}

/**
 * Update an existing flight schedule
 * Endpoint: PUT /flight-schedules/:id
 */
export async function updateSchedule(
  scheduleId: string | number,
  body: {
    aircraft_id?: number;
    gate_id?: number;
    departure_datetime?: string;
    arrival_datetime?: string;
    flight_status?: string;
    crew_requirements?: CrewRequirement[];
  },
  token?: string
): Promise<FlightSchedule> {
  const url = `${API_BASE}/flight-schedules/${scheduleId}`;
  console.log("updateSchedule URL:", url);

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  console.log("updateSchedule response status:", res.status);

  if (!res.ok) {
    const text = await res.text();
    console.error("updateSchedule error:", res.status, text.substring(0, 200));
    throw new Error(`HTTP ${res.status}: Failed to update schedule`);
  }

  const json = await res.json();
  if (!json.success)
    throw new Error(json.message || "Failed to update schedule.");
  return json.data as FlightSchedule;
}

/**
 * Delay a flight schedule
 * Endpoint: PUT /flight-schedules/:id (with flight_status update)
 */
export async function delaySchedule(
  scheduleId: number,
  delayReason: string,
  token?: string
): Promise<void> {
  const url = `${API_BASE}/flight-schedules/${scheduleId}`;
  console.log("delaySchedule URL:", url);
  console.log("delaySchedule payload:", { flight_status: "Delayed", delay_reason: delayReason });

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ 
      flight_status: "Delayed",
      delay_reason: delayReason 
    }),
  });

  console.log("delaySchedule response status:", res.status);

  if (!res.ok) {
    const text = await res.text();
    console.error("delaySchedule error:", res.status, text.substring(0, 200));
    throw new Error(`HTTP ${res.status}: Failed to delay schedule`);
  }

  const json = await res.json();
  if (!json.success)
    throw new Error(json.message || "Failed to delay schedule.");
}