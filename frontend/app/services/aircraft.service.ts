import { API_BASE } from "@/app/config";

export type Aircraft = {
  aircraft_id: number;
  registration_number: string;
  status: string;
  airline_id: number;
  airline_name: string;
  airline_code: string;
  airline_country?: string;
  aircraft_type_id: number;
  model_name: string;
  manufacturer: string;
  type_seat_capacity?: number;
  economy_seats: number;
  business_seats: number;
  first_class_seats: number;
  current_airport: number;
  current_airport_name?: string;
  current_airport_code?: string;
  current_airport_city?: string;
  max_speed_kmh?: number;
  fuel_capacity_litres?: number;
  manufactered_date?: string;
  latest_maintenance?: string;
  next_maintenance_due?: string;
  created_at?: string;
};

export async function getAllAircraft(token?: string): Promise<Aircraft[]> {
  const res = await fetch(`${API_BASE}/aircraft`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch aircraft");
  return Array.isArray(json.data) ? json.data : [];
}

export async function deleteAircraft(id: number, token?: string) {
  const res = await fetch(`${API_BASE}/aircraft/${id}`, {
    method: "DELETE",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  if (!res.ok) {
    let json = {};
    try { json = await res.json(); } catch { }
    throw new Error((json as any)?.message || "Failed to delete aircraft");
  }
}

export type AircraftType = {
  aircraft_type_id: number;
  model_name: string;
  manufacturer: string;
  seat_capacity: number;
};
export async function getAllAircraftTypes(token?: string): Promise<AircraftType[]> {
  const res = await fetch(`${API_BASE}/aircraft-types`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch aircraft types");
  return Array.isArray(json.data) ? json.data : [];
}

