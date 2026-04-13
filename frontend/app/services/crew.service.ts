import { API_BASE } from "@/app/config";

export type Staff = {
  staff_id: number;
  airport_id: number;
  first_name: string;
  last_name: string;
  role: string;
  staff_type: string;
  hire_date: string; 
  license_number?: string | null;
  status: string;
};

export type Shift = {
  shift_id: number;
  staff_id: number;
  start_time: string;
  end_time: string;
  role: string;
  status?: string;
};

export async function getAllStaff(token?: string): Promise<Staff[]> {
  const res = await fetch(`${API_BASE}/staff`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch staff");
  return Array.isArray(json.data) ? json.data : [];
}

export async function getAllShifts(token?: string): Promise<Shift[]> {
  const res = await fetch(`${API_BASE}/shifts`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch shifts");
  return Array.isArray(json.data) ? json.data : [];
}
