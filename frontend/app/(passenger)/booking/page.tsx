"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { API_BASE } from "@/app/config";

type SeatClass = "Economy" | "Business" | "First";

type FlightSchedule = {
  flight_schedule_id: number;
  flight_id: number;
  aircraft_id: number;
  gate_id: number;
  departure_datetime: string;
  arrival_datetime: string;
  flight_status: string;
  created_at: string;
  flight_number: number;
  flight_type: string;
  estimated_duration: string;
  airline_name: string;
  airline_code: string;
  source_airport_name: string;
  source_airport_code: string;
  source_city: string;
  destination_airport_name: string;
  destination_airport_code: string;
  destination_city: string;
  gate_number: string;
  terminal_name: string;
  source_airport_id?: number;
  destination_airport_id?: number;
};

type PriceRow = {
  price_id: number;
  source_airport_id: number;
  destination_airport_id: number;
  economy_price: string | number;
  business_price: string | number;
  first_class_price: string | number;
  source_airport_code?: string;
  dest_airport_code?: string;
};

async function fetchJson(url: string, options?: RequestInit) {
  try {
    const res = await fetch(url, options);
    
    console.log(`[FETCH] URL: ${url}`);
    console.log(`[FETCH] Status: ${res.status}`);
    console.log(`[FETCH] Content-Type: ${res.headers.get("content-type")}`);

    const text = await res.text();
    console.log(`[FETCH] Raw Response: ${text.substring(0, 500)}`);

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(
        `Non-JSON response from ${url}. Status: ${res.status}. Response: ${text.substring(0, 200)}`
      );
    }

    if (!res.ok || json?.success === false) {
      throw new Error(json?.message || `Request failed (${res.status})`);
    }

    return json;
  } catch (err) {
    console.error(`[FETCH ERROR] ${url}:`, err);
    throw err;
  }
}

export default function PassengerBookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const flightScheduleId = searchParams.get("flight_schedule_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [schedule, setSchedule] = useState<FlightSchedule | null>(null);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [selectedClass, setSelectedClass] = useState<SeatClass>("Economy");

  useEffect(() => {
    async function init() {
      if (!flightScheduleId) {
        setError("Missing flight_schedule_id in URL.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch ALL flight schedules
        console.log(`Fetching all flight schedules to find ID: ${flightScheduleId}`);
        const schedulesResp = await fetchJson(
          `${API_BASE}/flight-schedules`, // Updated endpoint path
          {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          }
        );

        const allSchedules: FlightSchedule[] = Array.isArray(schedulesResp?.data)
          ? schedulesResp.data
          : [];

        const scheduleData = allSchedules.find(
          (s) => Number(s.flight_schedule_id) === Number(flightScheduleId)
        );

        if (!scheduleData) {
          throw new Error(`Flight schedule with ID ${flightScheduleId} not found.`);
        }

        setSchedule(scheduleData);

        // Fetch prices
        console.log("Fetching prices");
        const pricesResp = await fetchJson(`${API_BASE}/price`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });

        const allPrices: PriceRow[] = Array.isArray(pricesResp?.data)
          ? pricesResp.data
          : [];
        setPrices(allPrices);
      } catch (e: any) {
        console.error("Init error:", e);
        setError(e?.message || "Failed to load booking details.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [flightScheduleId]);

  const matchedPrice = useMemo(() => {
    if (!schedule || prices.length === 0) return null;

    if (schedule.source_airport_id && schedule.destination_airport_id) {
      return (
        prices.find(
          (p) =>
            Number(p.source_airport_id) === Number(schedule.source_airport_id) &&
            Number(p.destination_airport_id) === Number(schedule.destination_airport_id)
        ) || null
      );
    }

    return (
      prices.find(
        (p) =>
          p.source_airport_code === schedule.source_airport_code &&
          p.dest_airport_code === schedule.destination_airport_code
      ) || null
    );
  }, [schedule, prices]);

  const selectedFare = useMemo(() => {
    if (!matchedPrice) return null;
    if (selectedClass === "Economy") return matchedPrice.economy_price;
    if (selectedClass === "Business") return matchedPrice.business_price;
    return matchedPrice.first_class_price;
  }, [matchedPrice, selectedClass]);

  if (loading) return <div style={styles.center}>Loading booking details...</div>;
  if (error) return <div style={styles.centerError}>{error}</div>;
  if (!schedule) return <div style={styles.center}>No schedule found.</div>;

  const isCancelled = schedule.flight_status?.toLowerCase() === "cancelled";

  return (
    <div style={styles.bg}>
      <div style={styles.container}>
        <h1 style={styles.title}>✈️ Flight Booking</h1>
        <p style={styles.subtitle}>Review details and select your fare class.</p>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Flight Details</h2>
          <div style={styles.grid}>
            <Info label="Airline" value={`${schedule.airline_name} (${schedule.airline_code})`} />
            <Info label="Flight Number" value={String(schedule.flight_number)} />
            <Info label="Status" value={schedule.flight_status} />
            <Info label="Flight Type" value={schedule.flight_type} />

            <Info label="From" value={`${schedule.source_airport_name} (${schedule.source_airport_code})`} />
            <Info label="To" value={`${schedule.destination_airport_name} (${schedule.destination_airport_code})`} />

            <Info label="Departure" value={new Date(schedule.departure_datetime).toLocaleString()} />
            <Info label="Arrival" value={new Date(schedule.arrival_datetime).toLocaleString()} />

            <Info label="Terminal" value={schedule.terminal_name || "—"} />
            <Info label="Gate" value={schedule.gate_number || "—"} />
            <Info label="Duration" value={schedule.estimated_duration || "—"} />
            <Info label="Aircraft ID" value={String(schedule.aircraft_id)} />
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Route Price</h2>
          {!matchedPrice ? (
            <div style={styles.warn}>No fare found for this route in Price table.</div>
          ) : (
            <>
              <div style={styles.priceRow}>
                <Price label="Economy" value={matchedPrice.economy_price} active={selectedClass === "Economy"} />
                <Price label="Business" value={matchedPrice.business_price} active={selectedClass === "Business"} />
                <Price label="First" value={matchedPrice.first_class_price} active={selectedClass === "First"} />
              </div>

              <div style={{ marginTop: 14 }}>
                <label style={styles.label}>Select class</label>
                <select
                  style={styles.select}
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value as SeatClass)}
                >
                  <option value="Economy">Economy</option>
                  <option value="Business">Business</option>
                  <option value="First">First</option>
                </select>
              </div>

              <div style={styles.total}>
                Selected Fare: <span style={{ color: "#60a5fa" }}>PKR {selectedFare}</span>
              </div>
            </>
          )}
        </section>

        <div style={styles.actions}>
          <button style={styles.secondaryBtn} onClick={() => router.back()}>
            Back
          </button>
          <button
            disabled={isCancelled || !matchedPrice}
            style={isCancelled || !matchedPrice ? styles.disabledBtn : styles.primaryBtn}
            onClick={() =>
              router.push(
                `/booking/baggage?flight_schedule_id=${schedule.flight_schedule_id}&seat_class=${selectedClass}`
              )
            }
          >
            Continue to Baggage
        </button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoItem}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value || "—"}</div>
    </div>
  );
}

function Price({
  label,
  value,
  active,
}: {
  label: string;
  value: string | number;
  active?: boolean;
}) {
  return (
    <div style={{ ...styles.pricePill, borderColor: active ? "#3b82f6" : "#334155" }}>
      <div style={{ color: "#93c5fd", fontSize: 13 }}>{label}</div>
      <div style={{ fontWeight: 700 }}>PKR {value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bg: { minHeight: "100vh", background: "linear-gradient(135deg,#0f172a,#1e293b)", color: "#e2e8f0", padding: "28px 12px 48px" },
  container: { maxWidth: 980, margin: "0 auto" },
  title: { fontSize: 32, margin: 0, color: "#93c5fd", fontWeight: 800 },
  subtitle: { marginTop: 8, marginBottom: 20, color: "#94a3b8" },
  card: { background: "linear-gradient(110deg,#111827 70%,#1d4ed822 100%)", border: "1px solid #33415566", borderRadius: 14, padding: 18, marginBottom: 16 },
  sectionTitle: { marginTop: 0, marginBottom: 14, color: "#bfdbfe", fontSize: 20 },
  grid: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 },
  infoItem: { background: "#0b1220", border: "1px solid #1f2937", borderRadius: 10, padding: "10px 12px" },
  infoLabel: { fontSize: 12, color: "#94a3b8", marginBottom: 4 },
  infoValue: { fontSize: 15, fontWeight: 600, color: "#e2e8f0" },
  priceRow: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 },
  pricePill: { background: "#0b1220", border: "1px solid #334155", borderRadius: 10, padding: "10px 12px" },
  label: { display: "block", marginBottom: 6, color: "#cbd5e1", fontSize: 13 },
  select: { width: 220, background: "#0b1220", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 8, padding: "10px 12px" },
  total: { marginTop: 14, fontSize: 17, fontWeight: 700 },
  warn: { background: "#3f1d1d", color: "#fecaca", border: "1px solid #7f1d1d", borderRadius: 10, padding: "10px 12px" },
  actions: { marginTop: 16, display: "flex", justifyContent: "space-between", gap: 10 },
  primaryBtn: { border: "none", background: "linear-gradient(90deg,#2563eb 80%,#0ea5e9)", color: "#fff", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer" },
  secondaryBtn: { border: "1px solid #334155", background: "#0b1220", color: "#e2e8f0", borderRadius: 10, padding: "10px 18px", fontWeight: 600, cursor: "pointer" },
  disabledBtn: { border: "none", background: "#475569", color: "#cbd5e1", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "not-allowed", opacity: 0.7 },
  center: { minHeight: "100vh", display: "grid", placeItems: "center", background: "#0f172a", color: "#e2e8f0" },
  centerError: { minHeight: "100vh", display: "grid", placeItems: "center", background: "#0f172a", color: "#fca5a5", padding: 20, textAlign: "center" },
};