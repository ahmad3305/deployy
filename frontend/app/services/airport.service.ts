import { API_BASE } from "@/app/config";

export type Airport = {
  airport_id: number;
  airport_name: string;
  city: string;
  country: string;
  airport_code: string;
  timezone: string;
};

export async function getAllAirports(token?: string): Promise<Airport[]> {
  const res = await fetch(`${API_BASE}/airports`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch airports");
  return Array.isArray(json.data) ? json.data : [];
}
export async function getAirport(id: number, token?: string): Promise<Airport> {
  const res = await fetch(`${API_BASE}/airports/${id}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch airport");
  return json.data;
}
export async function deleteAirport(id: number, token?: string) {
  const res = await fetch(`${API_BASE}/airports/${id}`, { method: "DELETE", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!res.ok) {
    let json = {};
    try { json = await res.json(); } catch { }
    throw new Error((json as any)?.message || "Failed to delete airport");
  }
}
