
import { API_BASE } from "@/app/config";

export type Flight = {
  flight_id: number;
  airline_name: string;
  airline_code: string;
  airline_country?: string;
  flight_number: number;
  flight_type: string;
  estimated_duration: string;
  source_airport_name: string;
  source_airport_code: string;
  source_city: string;
  source_country: string;
  source_timezone?: string;
  destination_airport_name: string;
  destination_airport_code: string;
  destination_city: string;
  destination_country: string;
  destination_timezone?: string;
  created_at?: string;
};

export async function getAllFlights(token?: string): Promise<Flight[]> {
  const res = await fetch(`${API_BASE}/flights`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  });
  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error("Non-JSON response from /flights endpoint");
  }
  if (!res.ok || json.success === false) {
    throw new Error(json.message || "Failed to fetch flights");
  }
  return Array.isArray(json.data) ? json.data : [];
}

export async function getFlightById(id: string | number, token?: string): Promise<Flight> {
  const res = await fetch(`${API_BASE}/flights/${id}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  });
  let json: any = {};
  try {
    json = await res.json();
  } catch {
    throw new Error("Non-JSON response from /flights/[id] endpoint");
  }
  if (!res.ok || json.success === false) {
    throw new Error(json.message || "Failed to fetch flight");
  }
  return json.data as Flight;
}

export async function deleteFlight(id: string | number, token?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/flights/${id}`, {
    method: "DELETE",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  });
  if (res.status === 204) return;
  let json: any = {};
  try {
    json = await res.json();
  } catch {
    throw new Error("Unknown error");
  }
  throw new Error(json.message || "Failed to delete flight");
}
