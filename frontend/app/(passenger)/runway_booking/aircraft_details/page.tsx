"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { API_BASE } from "@/app/config";

type PrivateAircraft = {
  private_aircraft_id: number;
  registration_number: string;
  model_name: string;
  manufacturer: string;
  seat_capacity: number;
  status: string;
};

type RunwayBookingData = {
  runway_id: number;
  airport_id: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  runway_code: string;
};

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

export default function AircraftDetailsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aircraft, setAircraft] = useState<PrivateAircraft[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<string>("");
  const [runwayData, setRunwayData] = useState<RunwayBookingData | null>(null);

  const [addingNew, setAddingNew] = useState(false);
  const [newAircraft, setNewAircraft] = useState({
    registration_number: "",
    model_name: "",
    manufacturer: "",
    seat_capacity: "",
  });

  // Load runway data and fetch aircraft
  useEffect(() => {
    const data = sessionStorage.getItem("runwayBookingData");
    if (!data) {
      router.push("/(passenger)/runway_booking/available_runway");
      return;
    }

    setRunwayData(JSON.parse(data));

    // Fetch user's aircraft
    fetchUserAircraft();
  }, [router]);

  const fetchUserAircraft = async () => {
    try {
      setLoading(true);
      const resp = await fetchJson(`${API_BASE}/private-aircraft`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      const aircraftList: PrivateAircraft[] = Array.isArray(resp?.data)
        ? resp.data
        : [];
      setAircraft(aircraftList);
    } catch (err: any) {
      console.error("Error fetching aircraft:", err);
      setError(err?.message || "Failed to fetch aircraft");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAircraft = async () => {
    if (
      !newAircraft.registration_number ||
      !newAircraft.model_name ||
      !newAircraft.manufacturer
    ) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      const resp = await fetchJson(`${API_BASE}/private-aircraft`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          registration_number: newAircraft.registration_number,
          model_name: newAircraft.model_name,
          manufacturer: newAircraft.manufacturer,
          seat_capacity: newAircraft.seat_capacity
            ? parseInt(newAircraft.seat_capacity)
            : null,
        }),
      });

      const created: PrivateAircraft = resp.data;
      setAircraft([created, ...aircraft]);
      setSelectedAircraft(String(created.private_aircraft_id));
      setAddingNew(false);
      setNewAircraft({
        registration_number: "",
        model_name: "",
        manufacturer: "",
        seat_capacity: "",
      });
      setError("");
    } catch (err: any) {
      setError(err?.message || "Failed to add aircraft");
    } finally {
      setLoading(false);
    }
  };

    const handleContinue = () => {
    if (!selectedAircraft) {
      setError("Please select or add an aircraft");
      return;
    }

    const selected = aircraft.find(
      (a) => a.private_aircraft_id === parseInt(selectedAircraft)
    );

    if (!selected) {
      setError("Selected aircraft not found");
      return;
    }

    // Format times as HH:MM:SS for the booking data
    const startTimeFormatted = `${runwayData!.start_time}:00`;
    const endTimeFormatted = `${runwayData!.end_time}:00`;

    // Store selection
    sessionStorage.setItem(
      "runwayBookingData",
      JSON.stringify({
        ...runwayData,
        start_time: startTimeFormatted,
        end_time: endTimeFormatted,
        private_aircraft_id: selected.private_aircraft_id,
      })
    );

    router.push("/runway_booking/confirm_booking");
  };

  if (!runwayData) return null;

  return (
    <div style={styles.bg}>
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={() => router.back()}>
            ← Back
          </button>
          <h1 style={styles.title}>✈️ Select Your Aircraft</h1>
          <div />
        </div>

        {/* Selected Runway Info */}
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Booking Summary</h2>
          <div style={styles.summaryGrid}>
            <div>
              <div style={styles.summaryLabel}>Runway</div>
              <div style={styles.summaryValue}>{runwayData.runway_code}</div>
            </div>
            <div>
              <div style={styles.summaryLabel}>Date</div>
              <div style={styles.summaryValue}>{runwayData.booking_date}</div>
            </div>
            <div>
              <div style={styles.summaryLabel}>Time</div>
              <div style={styles.summaryValue}>
                {runwayData.start_time} - {runwayData.end_time}
              </div>
            </div>
          </div>
        </section>

        {/* Existing Aircraft */}
        {aircraft.length > 0 && (
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Your Aircraft</h2>
            <div style={styles.aircraftGrid}>
              {aircraft.map((ac) => (
                <div
                  key={ac.private_aircraft_id}
                  style={{
                    ...styles.aircraftCard,
                    ...(selectedAircraft === String(ac.private_aircraft_id)
                      ? styles.aircraftCardSelected
                      : {}),
                  }}
                  onClick={() => setSelectedAircraft(String(ac.private_aircraft_id))}
                >
                  <div style={styles.registrationNumber}>{ac.registration_number}</div>
                  <div style={styles.aircraftDetail}>
                    <strong>{ac.model_name}</strong>
                  </div>
                  <div style={styles.aircraftDetail}>{ac.manufacturer}</div>
                  {ac.seat_capacity && (
                    <div style={styles.aircraftDetail}>Seats: {ac.seat_capacity}</div>
                  )}
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color:
                        ac.status === "Active"
                          ? "#22c55e"
                          : "#f97316",
                    }}
                  >
                    {ac.status}
                  </div>
                  <input
                    type="radio"
                    name="aircraft"
                    checked={selectedAircraft === String(ac.private_aircraft_id)}
                    onChange={() =>
                      setSelectedAircraft(String(ac.private_aircraft_id))
                    }
                    style={{ marginTop: 12 }}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Add New Aircraft */}
        <section style={styles.card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <h2 style={styles.sectionTitle}>
              {addingNew ? "Add New Aircraft" : "Don't see your aircraft?"}
            </h2>
            {!addingNew && (
              <button
                style={styles.addBtn}
                onClick={() => setAddingNew(true)}
              >
                + Add Aircraft
              </button>
            )}
          </div>

          {addingNew && (
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Registration Number *</label>
                <input
                  type="text"
                  style={styles.input}
                  placeholder="e.g., N12345"
                  value={newAircraft.registration_number}
                  onChange={(e) =>
                    setNewAircraft({
                      ...newAircraft,
                      registration_number: e.target.value,
                    })
                  }
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Model Name *</label>
                <input
                  type="text"
                  style={styles.input}
                  placeholder="e.g., Cessna 172"
                  value={newAircraft.model_name}
                  onChange={(e) =>
                    setNewAircraft({
                      ...newAircraft,
                      model_name: e.target.value,
                    })
                  }
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Manufacturer *</label>
                <input
                  type="text"
                  style={styles.input}
                  placeholder="e.g., Cessna"
                  value={newAircraft.manufacturer}
                  onChange={(e) =>
                    setNewAircraft({
                      ...newAircraft,
                      manufacturer: e.target.value,
                    })
                  }
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Seat Capacity</label>
                <input
                  type="number"
                  style={styles.input}
                  placeholder="e.g., 4"
                  value={newAircraft.seat_capacity}
                  onChange={(e) =>
                    setNewAircraft({
                      ...newAircraft,
                      seat_capacity: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          )}

          {addingNew && (
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                style={{
                  ...styles.addBtn,
                  background: "linear-gradient(90deg,#22c55e 80%,#16a34a)",
                }}
                onClick={handleAddAircraft}
                disabled={loading}
              >
                {loading ? "Adding..." : "Add Aircraft"}
              </button>
              <button
                style={{
                  ...styles.addBtn,
                  background: "#475569",
                }}
                onClick={() => setAddingNew(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </section>

        {/* Error */}
        {error && (
          <section style={{ ...styles.card, background: "#7f1d1d", border: "1px solid #991b1b" }}>
            <div style={{ color: "#fca5a5", fontSize: 14 }}>
              <strong>Error:</strong> {error}
            </div>
          </section>
        )}

        {/* Actions */}
        <div style={styles.actions}>
          <button style={styles.secondaryBtn} onClick={() => router.back()}>
            Back
          </button>
          <button style={styles.continueBtn} onClick={handleContinue}>
            Continue to Confirmation
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bg: {
    minHeight: "100vh",
    background: "linear-gradient(140deg, #1e293b 70%, #2563eb 160%)",
    color: "#e6eefb",
    padding: "32px 10px",
  },
  container: {
    maxWidth: 900,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: "1.5px solid #1e293b55",
  },
  backBtn: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    color: "#93c5fd",
  },
  card: {
    background: "linear-gradient(110deg, #1e293b 70%, #2563eb18 100%)",
    borderRadius: 14,
    padding: 22,
    marginBottom: 18,
    border: "1.5px solid #2563eb26",
    boxShadow: "0 8px 36px #1e293b40",
  },
  sectionTitle: {
    margin: 0,
    marginBottom: 16,
    fontSize: 18,
    fontWeight: 700,
    color: "#bfdbfe",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 700,
    color: "#e2e8f0",
  },
  aircraftGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 14,
    marginBottom: 16,
  },
  aircraftCard: {
    background: "#0b1220",
    border: "2px solid #334155",
    borderRadius: 10,
    padding: 16,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  aircraftCardSelected: {
    background: "#1e3a5f",
    border: "2px solid #2563eb",
  },
  registrationNumber: {
    fontSize: 18,
    fontWeight: 700,
    color: "#60a5fa",
    marginBottom: 8,
  },
  aircraftDetail: {
    fontSize: 13,
    color: "#cbd5e1",
    marginBottom: 6,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 14,
    marginBottom: 16,
  },
  formGroup: {
    display: "flex",
    flexDirection: "column" as const,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#cbd5e1",
    marginBottom: 8,
  },
  input: {
    background: "#0b1220",
    color: "#e2e8f0",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
  },
  addBtn: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    borderRadius: 10,
    padding: "10px 16px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
  },
  actions: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    marginTop: 28,
  },
  secondaryBtn: {
    border: "1px solid #334155",
    background: "#0b1220",
    color: "#e2e8f0",
    borderRadius: 10,
    padding: "12px 24px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 16,
  },
  continueBtn: {
    border: "none",
    background: "linear-gradient(90deg,#22c55e 80%,#16a34a)",
    color: "#fff",
    borderRadius: 10,
    padding: "12px 24px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 16,
  },
};