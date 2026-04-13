import { API_BASE } from "@/app/config";

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "Content-Type": "application/json",
  };
}

export async function getFlightScheduleById(flightScheduleId: number) {
  const res = await fetch(`${API_BASE}/flight_schedule`, { headers: authHeaders() });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch schedules");

  const row = (json.data || []).find((x: any) => Number(x.flight_schedule_id) === Number(flightScheduleId));
  if (!row) throw new Error("Flight schedule not found");
  return row;
}

export async function getAllPrices() {
  const res = await fetch(`${API_BASE}/price`, {
    headers: authHeaders(),
  });

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Non-JSON response from /price");
  }

  if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch prices");
  return Array.isArray(json.data) ? json.data : [];
}

export async function getRoutePrice(sourceAirportId: number, destinationAirportId: number) {
  const prices = await getAllPrices();
  return (
    prices.find(
      (p: any) =>
        Number(p.source_airport_id) === Number(sourceAirportId) &&
        Number(p.destination_airport_id) === Number(destinationAirportId)
    ) || null
  );
}