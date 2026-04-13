"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

type SeatClass = "Economy" | "Business" | "First";
type BaggageType = "Carry-on" | "Checked" | "Personal Item";

type BaggageItem = {
  id: string; // local unique id
  baggage_type: BaggageType;
  weight_kg: number;
};

type FlightSchedule = {
  flight_schedule_id: number;
  flight_number: number;
  airline_name: string;
  airline_code: string;
  source_airport_name: string;
  source_airport_code: string;
  destination_airport_name: string;
  destination_airport_code: string;
  departure_datetime: string;
  arrival_datetime: string;
  estimated_duration: string;
  flight_status: string;
};

// Baggage allowance configuration per seat class
const BAGGAGE_ALLOWANCE: Record<SeatClass, Record<BaggageType, { free_weight: number; price_per_kg: number }>> = {
  Economy: {
    "Carry-on": { free_weight: 7, price_per_kg: 0 },
    "Checked": { free_weight: 20, price_per_kg: 500 }, // PKR per kg above allowance
    "Personal Item": { free_weight: 5, price_per_kg: 0 },
  },
  Business: {
    "Carry-on": { free_weight: 10, price_per_kg: 0 },
    "Checked": { free_weight: 40, price_per_kg: 300 },
    "Personal Item": { free_weight: 8, price_per_kg: 0 },
  },
  First: {
    "Carry-on": { free_weight: 12, price_per_kg: 0 },
    "Checked": { free_weight: 60, price_per_kg: 200 },
    "Personal Item": { free_weight: 10, price_per_kg: 0 },
  },
};

const BAGGAGE_TYPES: BaggageType[] = ["Carry-on", "Checked", "Personal Item"];

async function fetchJson(url: string, options?: RequestInit) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Non-JSON response from ${url}`);
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

export default function PassengerBaggagePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const flightScheduleId = searchParams.get("flight_schedule_id");
  const seatClass = (searchParams.get("seat_class") as SeatClass) || "Economy";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [schedule, setSchedule] = useState<FlightSchedule | null>(null);
  const [baggage, setBaggage] = useState<BaggageItem[]>([]);

  useEffect(() => {
    async function init() {
      if (!flightScheduleId) {
        setError("Missing flight_schedule_id in URL.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const schedulesResp = await fetchJson(
          `${API_BASE}/flight-schedules`,
          {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          }
        );

        const allSchedules: any[] = Array.isArray(schedulesResp?.data)
          ? schedulesResp.data
          : [];

        const scheduleData = allSchedules.find(
          (s) => Number(s.flight_schedule_id) === Number(flightScheduleId)
        );

        if (!scheduleData) {
          throw new Error("Flight schedule not found.");
        }

        setSchedule(scheduleData);
      } catch (e: any) {
        console.error("Init error:", e);
        setError(e?.message || "Failed to load flight details.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [flightScheduleId]);

  const addBaggage = () => {
    const newBaggage: BaggageItem = {
      id: `baggage-${Date.now()}`,
      baggage_type: "Carry-on",
      weight_kg: 0,
    };
    setBaggage([...baggage, newBaggage]);
  };

  const removeBaggage = (id: string) => {
    setBaggage(baggage.filter((b) => b.id !== id));
  };

  const updateBaggage = (id: string, field: keyof BaggageItem, value: any) => {
    setBaggage(
      baggage.map((b) =>
        b.id === id ? { ...b, [field]: value } : b
      )
    );
  };

  const { totalWeight, totalCost, baggageBreakdown } = useMemo(() => {
    let totalWeight = 0;
    let totalCost = 0;
    const breakdown: { type: BaggageType; count: number; weight: number; cost: number }[] = [];

    baggage.forEach((item) => {
      totalWeight += item.weight_kg;

      const allowance = BAGGAGE_ALLOWANCE[seatClass][item.baggage_type];
      const excessWeight = Math.max(0, item.weight_kg - allowance.free_weight);
      const itemCost = excessWeight * allowance.price_per_kg;
      totalCost += itemCost;

      const existing = breakdown.find((b) => b.type === item.baggage_type);
      if (existing) {
        existing.count += 1;
        existing.weight += item.weight_kg;
        existing.cost += itemCost;
      } else {
        breakdown.push({
          type: item.baggage_type,
          count: 1,
          weight: item.weight_kg,
          cost: itemCost,
        });
      }
    });

    return { totalWeight, totalCost, baggageBreakdown: breakdown };
  }, [baggage, seatClass]);

  const handleContinue = () => {
    // Store baggage data in sessionStorage or pass via URL
    sessionStorage.setItem("baggageData", JSON.stringify(baggage));
    router.push(
      `/booking/checkout?flight_schedule_id=${flightScheduleId}&seat_class=${seatClass}`
    );
  };

  if (loading) return <div style={styles.center}>Loading flight details...</div>;
  if (error) return <div style={styles.centerError}>{error}</div>;
  if (!schedule) return <div style={styles.center}>No schedule found.</div>;

  return (
    <div style={styles.bg}>
      <div style={styles.container}>
        <h1 style={styles.title}>🧳 Baggage Management</h1>
        <p style={styles.subtitle}>Add and manage your baggage for this flight.</p>

        {/* Flight Summary */}
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Flight Summary</h2>
          <div style={styles.flightSummary}>
            <div>
              <div style={styles.routeLabel}>From</div>
              <div style={styles.routeValue}>{schedule.source_airport_code}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                {schedule.source_airport_name}
              </div>
            </div>
            <div style={{ textAlign: "center", color: "#60a5fa", fontSize: 24 }}>✈️</div>
            <div>
              <div style={styles.routeLabel}>To</div>
              <div style={styles.routeValue}>{schedule.destination_airport_code}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                {schedule.destination_airport_name}
              </div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={styles.routeLabel}>Class</div>
              <div style={styles.classValue}>{seatClass}</div>
            </div>
          </div>
        </section>

        {/* Baggage Allowance Info */}
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Your Baggage Allowance ({seatClass})</h2>
          <div style={styles.allowanceGrid}>
            {BAGGAGE_TYPES.map((type) => {
              const allowance = BAGGAGE_ALLOWANCE[seatClass][type];
              return (
                <div key={type} style={styles.allowanceItem}>
                  <div style={styles.allowanceType}>{type}</div>
                  <div style={styles.allowanceDetail}>
                    Free: <span style={{ color: "#22c55e" }}>{allowance.free_weight} kg</span>
                  </div>
                  <div style={styles.allowanceDetail}>
                    Excess: <span style={{ color: "#f97316" }}>PKR {allowance.price_per_kg}/kg</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={styles.infoBox}>
            ℹ️ Charges are calculated only for weight exceeding the free allowance per item.
          </div>
        </section>

        {/* Add Baggage Items */}
        <section style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={styles.sectionTitle}>Your Baggage</h2>
            <button style={styles.addBtn} onClick={addBaggage}>
              + Add Baggage
            </button>
          </div>

          {baggage.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={{ color: "#94a3b8" }}>No baggage added yet. Click "Add Baggage" to get started.</p>
            </div>
          ) : (
            <div style={styles.baggageList}>
              {baggage.map((item, idx) => (
                <div key={item.id} style={styles.baggageItem}>
                  <div style={styles.baggageItemContent}>
                    <div style={styles.baggageItemIndex}>#{idx + 1}</div>

                    <div style={styles.baggageItemField}>
                      <label style={styles.label}>Baggage Type</label>
                      <select
                        style={styles.select}
                        value={item.baggage_type}
                        onChange={(e) =>
                          updateBaggage(item.id, "baggage_type", e.target.value as BaggageType)
                        }
                      >
                        {BAGGAGE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={styles.baggageItemField}>
                      <label style={styles.label}>Weight (kg)</label>
                      <input
                        type="number"
                        style={styles.input}
                        value={item.weight_kg}
                        onChange={(e) =>
                          updateBaggage(item.id, "weight_kg", parseFloat(e.target.value) || 0)
                        }
                        min="0"
                        step="0.1"
                        placeholder="Enter weight"
                      />
                    </div>

                    <div style={styles.baggageItemField}>
                      <div style={styles.label}>Cost</div>
                      <div style={styles.costValue}>
                        PKR{" "}
                        {(() => {
                          const allowance =
                            BAGGAGE_ALLOWANCE[seatClass][item.baggage_type];
                          const excessWeight = Math.max(
                            0,
                            item.weight_kg - allowance.free_weight
                          );
                          return excessWeight * allowance.price_per_kg;
                        })()}
                      </div>
                    </div>

                    <button
                      style={styles.removeBtn}
                      onClick={() => removeBaggage(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Baggage Summary */}
        {baggage.length > 0 && (
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Baggage Summary</h2>
            <div style={styles.summaryGrid}>
              <div style={styles.summaryItem}>
                <div style={styles.summaryLabel}>Total Items</div>
                <div style={styles.summaryValue}>{baggage.length}</div>
              </div>
              <div style={styles.summaryItem}>
                <div style={styles.summaryLabel}>Total Weight</div>
                <div style={styles.summaryValue}>{totalWeight} kg</div>
              </div>
              <div style={styles.summaryItem}>
                <div style={styles.summaryLabel}>Excess Baggage Charges</div>
                <div style={styles.summaryValue}>PKR {totalCost}</div>
              </div>
            </div>

            <div style={{ marginTop: 16, borderTop: "1px solid #334155", paddingTop: 16 }}>
              <h3 style={{ marginTop: 0, color: "#bfdbfe", fontSize: 16 }}>Breakdown by Type</h3>
              {baggageBreakdown.map((item) => (
                <div key={item.type} style={styles.breakdownRow}>
                  <span>{item.type}</span>
                  <span style={{ color: "#94a3b8" }}>
                    {item.count} item{item.count > 1 ? "s" : ""} • {item.weight} kg • PKR {item.cost}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Actions */}
        <div style={styles.actions}>
          <button style={styles.secondaryBtn} onClick={() => router.back()}>
            Back
          </button>
          <button style={styles.primaryBtn} onClick={handleContinue}>
            Continue to Checkout
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bg: {
    minHeight: "100vh",
    background: "linear-gradient(135deg,#0f172a,#1e293b)",
    color: "#e2e8f0",
    padding: "28px 12px 48px",
  },
  container: { maxWidth: 980, margin: "0 auto" },
  title: { fontSize: 32, margin: 0, color: "#93c5fd", fontWeight: 800 },
  subtitle: { marginTop: 8, marginBottom: 20, color: "#94a3b8" },
  card: {
    background: "linear-gradient(110deg,#111827 70%,#1d4ed822 100%)",
    border: "1px solid #33415566",
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: 14,
    color: "#bfdbfe",
    fontSize: 20,
  },
  flightSummary: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    background: "#0b1220",
    border: "1px solid #1f2937",
    borderRadius: 10,
    padding: 16,
  },
  routeLabel: { fontSize: 12, color: "#94a3b8", marginBottom: 8 },
  routeValue: { fontSize: 18, fontWeight: 700, color: "#93c5fd" },
  classValue: { fontSize: 16, fontWeight: 600, color: "#60a5fa" },
  allowanceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  allowanceItem: {
    background: "#0b1220",
    border: "1px solid #1f2937",
    borderRadius: 10,
    padding: 12,
  },
  allowanceType: { fontSize: 15, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 },
  allowanceDetail: { fontSize: 13, color: "#cbd5e1", marginBottom: 6 },
  infoBox: {
    marginTop: 14,
    background: "#1e3a5f",
    border: "1px solid #1e40af",
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    color: "#bfdbfe",
  },
  addBtn: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    borderRadius: 8,
    padding: "8px 16px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
  },
  baggageList: { display: "flex", flexDirection: "column" as const, gap: 12 },
  baggageItem: {
    background: "#0b1220",
    border: "1px solid #1f2937",
    borderRadius: 10,
    padding: 14,
  },
  baggageItemContent: {
    display: "grid",
    gridTemplateColumns: "auto 1fr 1fr 1fr auto",
    gap: 12,
    alignItems: "flex-end",
  },
  baggageItemIndex: {
    fontSize: 14,
    fontWeight: 700,
    color: "#60a5fa",
  },
  baggageItemField: { display: "flex" as const, flexDirection: "column" as const },
  label: {
    display: "block",
    marginBottom: 6,
    color: "#cbd5e1",
    fontSize: 12,
  },
  select: {
    background: "#111827",
    color: "#e2e8f0",
    border: "1px solid #334155",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
  },
  input: {
    background: "#111827",
    color: "#e2e8f0",
    border: "1px solid #334155",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
  },
  costValue: {
    fontSize: 14,
    fontWeight: 600,
    color: "#f97316",
  },
  removeBtn: {
    border: "1px solid #dc2626",
    background: "#7f1d1d",
    color: "#fca5a5",
    borderRadius: 6,
    padding: "8px 12px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 13,
  },
  emptyState: {
    textAlign: "center" as const,
    padding: 32,
    color: "#94a3b8",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginBottom: 16,
  },
  summaryItem: {
    background: "#0b1220",
    border: "1px solid #1f2937",
    borderRadius: 10,
    padding: 12,
    textAlign: "center" as const,
  },
  summaryLabel: { fontSize: 12, color: "#94a3b8", marginBottom: 8 },
  summaryValue: { fontSize: 20, fontWeight: 700, color: "#60a5fa" },
  breakdownRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    borderBottom: "1px solid #1f2937",
    fontSize: 14,
    color: "#e2e8f0",
  },
  actions: {
    marginTop: 16,
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
  },
  primaryBtn: {
    border: "none",
    background: "linear-gradient(90deg,#2563eb 80%,#0ea5e9)",
    color: "#fff",
    borderRadius: 10,
    padding: "10px 18px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryBtn: {
    border: "1px solid #334155",
    background: "#0b1220",
    color: "#e2e8f0",
    borderRadius: 10,
    padding: "10px 18px",
    fontWeight: 600,
    cursor: "pointer",
  },
  center: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#0f172a",
    color: "#e2e8f0",
  },
  centerError: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#0f172a",
    color: "#fca5a5",
    padding: 20,
    textAlign: "center" as const,
  },
};