"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAircrafts,
  getGates,
  getScheduleById,
  Aircraft,
  Gate,
  CrewRequirement,
} from "@/app/services/schedule.service";
import { API_BASE } from "@/app/config";

type Flight = {
  flight_id: number;
  flight_number: number;
  airline_name: string;
  airline_code: string;
  source_airport_name: string;
  destination_airport_name: string;
};

const CREW_ROLES = [
  "Pilot",
  "Co-Pilot",
  "Cabin Crew",
  "Check-in Staff",
  "Boarding Staff",
  "Baggage Handler",
  "Ramp Operator",
  "Maintenance Crew",
  "Supervisor",
];

export default function CreateSchedulePage() {
  const router = useRouter();

  const [flights, setFlights] = useState<Flight[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [flight_id, setFlightId] = useState<number | "">("");
  const [aircraft_id, setAircraftId] = useState<number | "">("");
  const [gate_id, setGateId] = useState<number | "">("");
  const [departure_datetime, setDepartureDateTime] = useState("");
  const [arrival_datetime, setArrivalDateTime] = useState("");
  const [crew_requirements, setCrewRequirements] = useState<CrewRequirement[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Check auth on mount
  useEffect(() => {
    const user =
      typeof window !== "undefined" ? sessionStorage.getItem("user") : null;
    console.log("Checking admin auth for create schedule, user:", user);

    if (!user) {
      console.log("No user found, redirecting to login");
      router.push("/login");
      return;
    }

    try {
      const parsed = JSON.parse(user);
      console.log("User role:", parsed.role);

      if (parsed.role !== "Admin") {
        console.log("User is not Admin, redirecting to login");
        router.push("/login");
        return;
      }

      setIsAuthorized(true);
    } catch (err) {
      console.error("Error parsing user:", err);
      router.push("/login");
    }
  }, [router]);

  // Load initial data only if authorized
  useEffect(() => {
    if (!isAuthorized) return;

    async function fetchInitialData() {
      setLoading(true);
      setError("");
      try {
        const token = sessionStorage.getItem("token") || "";

        if (!token) {
          throw new Error("No authentication token found");
        }

        console.log("=== Fetching initial data ===");
        console.log("Token:", token.substring(0, 20) + "...");

        // Fetch flights
        console.log("Fetching flights from:", `${API_BASE}/flights`);
        const flightsRes = await fetch(`${API_BASE}/flights`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!flightsRes.ok) {
          const text = await flightsRes.text();
          console.error("Flights error:", flightsRes.status, text.substring(0, 200));
          throw new Error(`Flights API error ${flightsRes.status}`);
        }

        const flightsJson = await flightsRes.json();
        console.log("Flights data loaded:", flightsJson.data?.length || 0, "flights");
        setFlights(Array.isArray(flightsJson.data) ? flightsJson.data : []);

        // Fetch aircraft using service
        console.log("Fetching aircraft...");
        const aircraftData = await getAircrafts(token);
        console.log("Aircraft data loaded:", aircraftData.length, "aircraft");
        setAircraft(aircraftData);

        // Fetch gates using service
        console.log("Fetching gates...");
        const gatesData = await getGates(token);
        console.log("Gates data loaded:", gatesData.length, "gates");
        setGates(gatesData);

        console.log("=== All data loaded successfully ===");
      } catch (e: any) {
        console.error("Fetch initial data error:", e);
        setError("Failed to load data. " + (e?.message || ""));
      } finally {
        setLoading(false);
      }
    }

    fetchInitialData();
  }, [isAuthorized]);

  // Crew requirements UI handlers
  function addCrewRow() {
    setCrewRequirements([
      ...crew_requirements,
      { role_required: CREW_ROLES[0], number_required: 1 },
    ]);
  }

  function updateCrewRow(
    idx: number,
    key: keyof CrewRequirement,
    value: string | number
  ) {
    setCrewRequirements(
      crew_requirements.map((c, i) =>
        i === idx ? { ...c, [key]: value } : c
      )
    );
  }

  function removeCrewRow(idx: number) {
    setCrewRequirements(crew_requirements.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setValidationErrors([]);

    // Validation
    const errs: string[] = [];
    if (!flight_id) errs.push("Flight is required.");
    if (!aircraft_id) errs.push("Aircraft is required.");
    if (!gate_id) errs.push("Gate is required.");
    if (!departure_datetime) errs.push("Departure time is required.");
    if (!arrival_datetime) errs.push("Arrival time is required.");

    if (departure_datetime && arrival_datetime) {
      if (new Date(arrival_datetime) <= new Date(departure_datetime)) {
        errs.push("Arrival must be after departure.");
      }
    }

    if (!crew_requirements.length) {
      errs.push("At least one crew requirement is required.");
    }

    for (const [i, cr] of crew_requirements.entries()) {
      if (!cr.role_required) {
        errs.push(`Crew row ${i + 1}: Role is required.`);
      }
      if (!cr.number_required || cr.number_required < 1) {
        errs.push(`Crew row ${i + 1}: Number must be > 0.`);
      }
    }

    if (errs.length > 0) {
      setValidationErrors(errs);
      return;
    }

    setSubmitting(true);

    try {
      const token = sessionStorage.getItem("token") || "";

      if (!token) {
        throw new Error("No authentication token found");
      }

      console.log("=== Creating flight schedule ===");

      // Step 1: Create the flight schedule WITHOUT crew requirements
      console.log("Step 1: Creating flight schedule...");
      const scheduleRes = await fetch(`${API_BASE}/flight-schedules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          flight_id: Number(flight_id),
          aircraft_id: Number(aircraft_id),
          gate_id: Number(gate_id),
          departure_datetime,
          arrival_datetime,
        }),
      });

      console.log("Schedule creation response status:", scheduleRes.status);

      if (!scheduleRes.ok) {
        const text = await scheduleRes.text();
        console.error("Schedule creation error:", scheduleRes.status, text);
        throw new Error(`Failed to create schedule: ${text || "Unknown error"}`);
      }

      const scheduleJson = await scheduleRes.json();
      console.log("Schedule created:", scheduleJson);

      if (!scheduleJson.success) {
        throw new Error(scheduleJson.message || "Failed to create schedule.");
      }

      const scheduleId = scheduleJson.data.flight_schedule_id;
      console.log("Schedule ID:", scheduleId);

      // Step 2: Create crew requirements separately
      console.log("Step 2: Creating crew requirements...");
      let crewErrors: string[] = [];

      for (let i = 0; i < crew_requirements.length; i++) {
        const crew = crew_requirements[i];
        console.log(`Creating crew requirement ${i + 1}/${crew_requirements.length}:`, crew);

        try {
          const crewRes = await fetch(`${API_BASE}/crew-requirements`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              flight_schedule_id: scheduleId,
              role_required: crew.role_required,
              number_required: crew.number_required,
            }),
          });

          console.log(`Crew requirement ${i + 1} response status:`, crewRes.status);

          if (!crewRes.ok) {
            const text = await crewRes.text();
            console.error(`Crew requirement ${i + 1} error:`, crewRes.status, text);
            crewErrors.push(
              `Failed to create crew requirement for ${crew.role_required}: ${text || "Unknown error"}`
            );
          } else {
            const crewJson = await crewRes.json();
            console.log(`Crew requirement ${i + 1} created successfully:`, crewJson);
          }
        } catch (e: any) {
          console.error(`Crew requirement ${i + 1} exception:`, e);
          crewErrors.push(`Error creating crew requirement for ${crew.role_required}: ${e.message}`);
        }
      }

      console.log("=== Schedule and crew requirements created ===");

      // Show warnings if any crew requirements failed, but still redirect
      if (crewErrors.length > 0) {
        console.warn("Some crew requirements failed to create:", crewErrors);
        setError(
          `Schedule created successfully, but some crew requirements failed: ${crewErrors.join("; ")}`
        );
        // Still redirect after a short delay to show the error
        setTimeout(() => {
          router.push(`/admin/schedules/${scheduleId}/edit`);
        }, 2000);
      } else {
        // All successful, redirect immediately
        router.push(`/admin/schedules/${scheduleId}/edit`);
      }
    } catch (e: any) {
      console.error("Create schedule error:", e);
      setError(e?.message || "Failed to create schedule.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAuthorized) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner}>Checking authorization...</div>
      </div>
    );
  }

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <h1 style={styles.title}>📅 Create Flight Schedule</h1>
        <div style={styles.card}>
          {loading ? (
            <div style={styles.loading}>Loading data...</div>
          ) : (
            <form onSubmit={handleSubmit} style={styles.form}>
              {error && <div style={styles.error}>{error}</div>}
              {validationErrors.length > 0 && (
                <div style={styles.errorList}>
                  {validationErrors.map((e, i) => (
                    <div key={i}>• {e}</div>
                  ))}
                </div>
              )}

              <div style={styles.fieldsGrid}>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Flight *</label>
                  <select
                    value={flight_id}
                    style={styles.select}
                    onChange={(e) => setFlightId(Number(e.target.value))}
                    required
                  >
                    <option value="">
                      {flights.length === 0 ? "No flights available" : "Select..."}
                    </option>
                    {flights.map((f) => (
                      <option key={f.flight_id} value={f.flight_id}>
                        {f.airline_code}-{f.flight_number}: {f.source_airport_name} →{" "}
                        {f.destination_airport_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.labelGroup}>
                  <label style={styles.label}>Aircraft *</label>
                  <select
                    value={aircraft_id}
                    style={styles.select}
                    onChange={(e) => setAircraftId(Number(e.target.value))}
                    required
                  >
                    <option value="">
                      {aircraft.length === 0 ? "No aircraft available" : "Select..."}
                    </option>
                    {aircraft.map((a) => (
                      <option key={a.aircraft_id} value={a.aircraft_id}>
                        {a.registration_number}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.labelGroup}>
                  <label style={styles.label}>Gate *</label>
                  <select
                    value={gate_id}
                    style={styles.select}
                    onChange={(e) => setGateId(Number(e.target.value))}
                    required
                  >
                    <option value="">
                      {gates.length === 0 ? "No gates available" : "Select..."}
                    </option>
                    {gates.map((g) => (
                      <option key={g.gate_id} value={g.gate_id}>
                        {g.terminal_name} - {g.gate_number}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.labelGroup}>
                  <label style={styles.label}>Departure DateTime *</label>
                  <input
                    style={styles.input}
                    type="datetime-local"
                    value={departure_datetime}
                    onChange={(e) => setDepartureDateTime(e.target.value)}
                    required
                  />
                </div>

                <div style={styles.labelGroup}>
                  <label style={styles.label}>Arrival DateTime *</label>
                  <input
                    style={styles.input}
                    type="datetime-local"
                    value={arrival_datetime}
                    onChange={(e) => setArrivalDateTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ marginTop: 26, marginBottom: 18 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <label style={{ ...styles.label, fontSize: 16.5 }}>
                    Crew Requirements *
                  </label>
                  <button
                    type="button"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#60a5fa",
                      fontWeight: 700,
                      fontSize: 15,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                    onClick={addCrewRow}
                  >
                    + Add Row
                  </button>
                </div>

                <table style={styles.crewTable}>
                  <thead>
                    <tr>
                      <th style={styles.crewTh}>Role</th>
                      <th style={styles.crewTh}>Number Required</th>
                      <th style={{ ...styles.crewTh, width: 50 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crew_requirements.map((cr, i) => (
                      <tr key={i}>
                        <td style={styles.crewTd}>
                          <select
                            style={styles.crewSelect}
                            value={cr.role_required}
                            onChange={(e) =>
                              updateCrewRow(i, "role_required", e.target.value)
                            }
                          >
                            {CREW_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={styles.crewTd}>
                          <input
                            style={styles.input}
                            type="number"
                            min={1}
                            value={cr.number_required}
                            onChange={(e) =>
                              updateCrewRow(i, "number_required", Number(e.target.value))
                            }
                            required
                          />
                        </td>
                        <td style={styles.crewTd}>
                          <button
                            style={styles.xBtn}
                            type="button"
                            onClick={() => removeCrewRow(i)}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                    {crew_requirements.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          style={{
                            color: "#a4aabb",
                            padding: 12,
                            textAlign: "center",
                            fontSize: 14,
                          }}
                        >
                          Click <b>+ Add Row</b> to add crew roles
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={styles.actionBar}>
                <button
                  type="submit"
                  style={styles.submitBtn}
                  disabled={submitting || loading}
                >
                  {submitting ? "Creating..." : "Create Schedule"}
                </button>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => router.push("/admin/schedules/edit")}
                  disabled={submitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  center: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(140deg, #1e293b 70%, #2563eb 160%)",
    color: "#e6eefb",
  },
  spinner: {
    fontSize: 18,
    color: "#93c5fd",
  },
  bg: {
    minHeight: "100vh",
    width: "100vw",
    background: "linear-gradient(140deg, #1e293b 70%, #2563eb 110%)",
    color: "#e6eefb",
    fontFamily:
      "system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
    padding: 0,
  },
  shell: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "45px 18px 55px 18px",
    minHeight: "100vh",
  },
  title: {
    fontSize: 29,
    fontWeight: 800,
    color: "#60a5fa",
    marginBottom: 26,
    letterSpacing: 0.5,
    background: "none",
  },
  card: {
    background: "linear-gradient(110deg,#111827 70%, #1d4ed822 100%)",
    borderRadius: 15,
    boxShadow: "0 8px 36px #1e293b40, 0 2px 8px #2563eb33",
    border: "1.3px solid #2563eb26",
    marginBottom: 21,
    padding: "33px 25px 24px 25px",
  },
  loading: {
    color: "#93c5fd",
    fontSize: 18,
    padding: 28,
    textAlign: "center",
    fontWeight: 500,
  },
  error: {
    background: "#3f1d1d",
    color: "#fecaca",
    fontWeight: 600,
    padding: "14px 24px",
    borderRadius: 8,
    border: "1.5px solid #f87171",
    margin: "16px 0 8px",
    fontSize: 15,
    textAlign: "center",
  },
  errorList: {
    background: "#3f1d1d",
    color: "#fecaca",
    fontWeight: 600,
    fontSize: 15,
    padding: "12px 18px",
    borderRadius: 10,
    border: "1.2px solid #f87171",
    margin: "12px 0 16px",
    lineHeight: 1.8,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  fieldsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px 18px",
    marginBottom: 8,
  },
  labelGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
  label: {
    color: "#93c5fd",
    fontWeight: 600,
    fontSize: 15,
  },
  input: {
    background: "#1e293b",
    border: "1.2px solid #2563eb39",
    borderRadius: 7,
    color: "#e6eefb",
    fontSize: 15,
    padding: "9px 12px",
    outline: "none",
  },
  select: {
    background: "#1e293b",
    border: "1.2px solid #2563eb39",
    borderRadius: 7,
    color: "#e6eefb",
    fontSize: 15,
    padding: "9px 12px",
    outline: "none",
    cursor: "pointer",
  },
  crewTable: {
    width: "100%",
    borderCollapse: "collapse",
    background: "none",
    border: "1.2px solid #2563eb26",
    borderRadius: 8,
    overflow: "hidden",
  },
  crewTh: {
    textAlign: "left",
    color: "#9dc3fa",
    fontWeight: 700,
    padding: "10px 12px",
    borderBottom: "1.5px solid #2563eb32",
    background: "#1e293b44",
    fontSize: 14,
  },
  crewTd: {
    padding: "10px 12px",
    borderBottom: "1px solid #2563eb21",
    background: "none",
  },
  crewSelect: {
    background: "#1e293b",
    border: "1.1px solid #2563eb39",
    borderRadius: 6,
    color: "#e6eefb",
    fontSize: 14,
    padding: "7px 10px",
    outline: "none",
    width: "100%",
  },
  xBtn: {
    background: "#f87171",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 20,
    padding: "4px 10px",
    cursor: "pointer",
    boxShadow: "0 2px 5px #f8717110",
  },
  actionBar: {
    display: "flex",
    gap: 14,
    marginTop: 28,
  },
  submitBtn: {
    background: "linear-gradient(90deg,#2563eb 77%, #0ea5e9)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 16,
    padding: "11px 32px",
    cursor: "pointer",
    boxShadow: "0 2px 8px #2563eb33",
  },
  cancelBtn: {
    background: "none",
    color: "#93c5fd",
    border: "1.3px solid #2563eb56",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 16,
    padding: "11px 32px",
    cursor: "pointer",
  },
};