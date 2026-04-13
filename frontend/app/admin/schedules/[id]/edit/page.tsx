"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  getScheduleById,
  getAircrafts,
  getGates,
  updateSchedule,
  FlightSchedule,
  Aircraft,
  Gate,
  CrewRequirement,
} from "@/app/services/schedule.service";

const CREW_ROLES = [
  "Pilot", "Co-Pilot", "Cabin Crew", "Check-in Staff",
  "Boarding Staff", "Baggage Handler", "Ramp Operator",
  "Maintenance Crew", "Supervisor"
];

/**
 * Convert datetime-local format (2024-04-13T14:30) to MySQL datetime format (2024-04-13 14:30:00)
 */
function formatDatetimeForMySQL(datetimeLocal: string): string {
  if (!datetimeLocal) return '';
  return datetimeLocal.replace('T', ' ') + ':00';
}

export default function ScheduleEditPage() {
  const router = useRouter();
  const params = useParams();

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [schedule, setSchedule] = useState<FlightSchedule | null>(null);
  const [aircraftList, setAircraftList] = useState<Aircraft[]>([]);
  const [gatesList, setGatesList] = useState<Gate[]>([]);

  const [aircraft_id, setAircraftId] = useState<number | "">("");
  const [gate_id, setGateId] = useState<number | "">("");
  const [departure_datetime, setDepartureDateTime] = useState("");
  const [arrival_datetime, setArrivalDateTime] = useState("");
  const [crew_requirements, setCrewRequirements] = useState<CrewRequirement[]>([]);

  const [originalDeparture, setOriginalDeparture] = useState("");
  const [originalArrival, setOriginalArrival] = useState("");

  // Check auth on mount
  useEffect(() => {
    const user =
      typeof window !== "undefined" ? sessionStorage.getItem("user") : null;
    console.log("Checking admin auth for edit schedule, user:", user);

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

  // Load schedule data only if authorized
  useEffect(() => {
    if (!isAuthorized) return;

    async function fetchData() {
      setLoading(true);
      setFetchError("");
      try {
        const token = sessionStorage.getItem("token") || "";
        const scheduleId = params?.id as string;

        if (!scheduleId) {
          throw new Error("No schedule ID provided");
        }

        console.log("Fetching schedule ID:", scheduleId);

        const [sched, aircrafts, gates] = await Promise.all([
          getScheduleById(scheduleId, token),
          getAircrafts(token),
          getGates(token)
        ]);

        console.log("Schedule data loaded:", sched);

        setSchedule(sched);
        setAircraftList(aircrafts);
        setGatesList(gates);
        setAircraftId(sched.aircraft_id);
        setGateId(sched.gate_id);

        // Convert MySQL datetime to datetime-local format
        // MySQL: 2024-04-13 14:30:00 -> datetime-local: 2024-04-13T14:30
        const depLocal = sched.departure_datetime?.slice(0, 16).replace(' ', 'T') || "";
        const arrLocal = sched.arrival_datetime?.slice(0, 16).replace(' ', 'T') || "";

        setDepartureDateTime(depLocal);
        setArrivalDateTime(arrLocal);
        setOriginalDeparture(depLocal);
        setOriginalArrival(arrLocal);
        setCrewRequirements(Array.isArray(sched.crew_requirements) ? sched.crew_requirements : []);
      } catch (e: any) {
        console.error("Fetch schedule error:", e);
        setFetchError(e?.message || "Failed to load schedule data.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [params?.id, isAuthorized]);

  function addCrewRow() {
    setCrewRequirements([...crew_requirements, { role_required: CREW_ROLES[0], number_required: 1 }]);
  }

  function updateCrewRow(idx: number, key: keyof CrewRequirement, value: string | number) {
    setCrewRequirements(crew_requirements.map((c, i) => i === idx ? { ...c, [key]: value } : c));
  }

  function removeCrewRow(idx: number) {
    setCrewRequirements(crew_requirements.filter((_, i) => i !== idx));
  }

  function isReschedule() {
    return (originalDeparture !== departure_datetime) || (originalArrival !== arrival_datetime);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    setValidationErrors([]);
    if (!schedule) return;

    const errs: string[] = [];
    if (!aircraft_id) errs.push("Aircraft is required.");
    if (!gate_id) errs.push("Gate is required.");
    if (!departure_datetime) errs.push("Departure time is required.");
    if (!arrival_datetime) errs.push("Arrival time is required.");

    if (departure_datetime && arrival_datetime) {
      if (new Date(arrival_datetime) <= new Date(departure_datetime)) {
        errs.push("Arrival must be after departure.");
      }
    }

    for (const [i, cr] of crew_requirements.entries()) {
      if (!cr.role_required) errs.push(`Crew row ${i + 1}: Role required.`);
      if (!cr.number_required || cr.number_required < 1) errs.push(`Crew row ${i + 1}: Number must be > 0.`);
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

      console.log("Updating schedule:", schedule.flight_schedule_id);

      // Convert datetime-local to MySQL format
      const mysqlDeparture = formatDatetimeForMySQL(departure_datetime);
      const mysqlArrival = formatDatetimeForMySQL(arrival_datetime);

      console.log("Formatted departure:", mysqlDeparture);
      console.log("Formatted arrival:", mysqlArrival);

      await updateSchedule(
      schedule.flight_schedule_id,
      {
        aircraft_id: Number(aircraft_id),
        gate_id: Number(gate_id),
        departure_datetime: mysqlDeparture,
        arrival_datetime: mysqlArrival,
        crew_requirements,
      },
      token
    );

      console.log("Schedule updated successfully");
      router.push("/admin/schedules");
    } catch (e: any) {
      console.error("Update schedule error:", e);
      setSubmitError(e?.message || "Failed to update schedule.");
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
        <h1 style={styles.title}>📝 Edit Flight Schedule</h1>
        {loading ? (
          <div style={styles.loading}>Loading...</div>
        ) : fetchError ? (
          <div style={styles.error}>{fetchError}</div>
        ) : schedule ? (
          <>
            <div style={{ marginBottom: 18 }}>
              <span style={{ color: "#93c5fd", fontWeight: 700, fontSize: 17 }}>
                {schedule.airline_code}-{schedule.flight_number}:
              </span>{" "}
              <span style={{ color: "#93c5fd" }}>
                {schedule.source_airport_name} → {schedule.destination_airport_name}
              </span>
            </div>
            {schedule.flight_status === "Delayed" && (
              <div style={styles.warning}>
                This flight is currently delayed
                {schedule.delay_reason ? <>: <b>{schedule.delay_reason}</b></> : null}
              </div>
            )}
            <div style={{ marginBottom: 13 }}>
              {isReschedule() ? (
                <span style={{ color: "#fbbf24", fontWeight: 700 }}>
                  You are <b>rescheduling</b> this flight (time changed).
                </span>
              ) : (
                <span style={{ color: "#60a5fa" }}>
                  Editing details.
                </span>
              )}
            </div>
            <form onSubmit={handleSubmit} style={styles.form}>
              {submitError && <div style={styles.error}>{submitError}</div>}
              {validationErrors.length > 0 && (
                <div style={styles.errorList}>
                  {validationErrors.map((e, i) => (
                    <div key={i}>• {e}</div>
                  ))}
                </div>
              )}
              <div style={styles.fieldsGrid}>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Aircraft</label>
                  <select value={aircraft_id} style={styles.select}
                    onChange={e => setAircraftId(Number(e.target.value))}>
                    <option value="">Select...</option>
                    {aircraftList.map(a =>
                      <option key={a.aircraft_id} value={a.aircraft_id}>{a.registration_number}</option>
                    )}
                  </select>
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Gate</label>
                  <select value={gate_id} style={styles.select}
                    onChange={e => setGateId(Number(e.target.value))}>
                    <option value="">Select...</option>
                    {gatesList.map(g =>
                      <option key={g.gate_id} value={g.gate_id}>
                        {g.terminal_name} - {g.gate_number}
                      </option>
                    )}
                  </select>
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Departure DateTime</label>
                  <input
                    style={styles.input}
                    type="datetime-local"
                    value={departure_datetime}
                    onChange={e => setDepartureDateTime(e.target.value)}
                  />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Arrival DateTime</label>
                  <input
                    style={styles.input}
                    type="datetime-local"
                    value={arrival_datetime}
                    onChange={e => setArrivalDateTime(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <label style={{ ...styles.label, fontSize: 16.5, marginBottom: 9 }}>Crew Requirements
                  <span style={{ color: "#60a5fa", fontWeight: 400, fontSize: 15, marginLeft: 7, cursor: "pointer" }} onClick={addCrewRow}>
                    [+ Add]
                  </span>
                </label>
                <table style={styles.crewTable}>
                  <thead>
                    <tr>
                      <th style={styles.crewTh}>Role</th>
                      <th style={styles.crewTh}>Number Required</th>
                      <th style={{ ...styles.crewTh, width: 50 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {crew_requirements.map((cr, i) => (
                      <tr key={i}>
                        <td style={styles.crewTd}>
                          <select
                            style={styles.crewSelect}
                            value={cr.role_required}
                            onChange={e => updateCrewRow(i, "role_required", e.target.value)}
                          >
                            {CREW_ROLES.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </td>
                        <td style={styles.crewTd}>
                          <input
                            style={styles.input}
                            type="number"
                            min={1}
                            value={cr.number_required}
                            onChange={e => updateCrewRow(i, "number_required", Number(e.target.value))}
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
                        <td colSpan={3} style={{ color: "#a4aabb", padding: 9, textAlign: "center" }}>
                          Click <b>+ Add</b> to add a crew role
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div style={styles.actionBar}>
                <button type="submit" style={styles.submitBtn} disabled={submitting || loading}>
                  {submitting ? "Updating..." : isReschedule() ? "Update & Reschedule" : "Update"}
                </button>
                <button type="button" style={styles.cancelBtn} onClick={() => router.push("/admin/schedules")} disabled={submitting}>
                  Cancel
                </button>
              </div>
            </form>
          </>
        ) : null}
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
    fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
    padding: 0,
  },
  shell: {
    maxWidth: 730,
    margin: "0 auto",
    padding: "45px 18px 55px 18px",
    minHeight: "100vh",
  },
  title: {
    fontSize: 29,
    fontWeight: 800,
    color: "#60a5fa",
    marginBottom: 12,
    letterSpacing: 0.5,
    background: "none",
  },
  loading: {
    color: "#93c5fd",
    fontSize: 18,
    padding: 23,
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
    fontSize: 16,
    textAlign: "center",
  },
  errorList: {
    background: "#3f1d1d",
    color: "#fecaca",
    fontWeight: 600,
    fontSize: 15.5,
    padding: "10px 18px",
    borderRadius: 10,
    border: "1.2px solid #f87171",
    margin: "13px 0 11px",
    lineHeight: 1.8,
  },
  warning: {
    background: "#fbbf2455",
    color: "#6b4812",
    fontWeight: 700,
    padding: "11px 19px",
    borderRadius: 8,
    border: "1.5px solid #fbbf2485",
    marginBottom: 15,
    fontSize: 16,
    textAlign: "center",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  fieldsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "24px 20px",
    marginBottom: 7,
  },
  labelGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
  label: {
    color: "#93c5fd",
    fontWeight: 500,
    fontSize: 15.8,
    marginBottom: -2,
  },
  input: {
    background: "#1e293b",
    border: "1.2px solid #2563eb39",
    borderRadius: 7,
    color: "#e6eefb",
    fontSize: 16.5,
    padding: "9px 12px",
    outline: "none",
  },
  select: {
    background: "#1e293b",
    border: "1.2px solid #2563eb39",
    borderRadius: 7,
    color: "#e6eefb",
    fontSize: 16.5,
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
    marginTop: 8,
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
    gap: 17,
    marginTop: 24,
  },
  submitBtn: {
    background: "linear-gradient(90deg,#2563eb 77%, #0ea5e9)",
    color: "#fff",
    border: "none",
    borderRadius: 9,
    fontWeight: 700,
    fontSize: 16.5,
    padding: "10px 33px",
    cursor: "pointer",
    boxShadow: "0 2px 8px #2563eb33",
  },
  cancelBtn: {
    background: "none",
    color: "#93c5fd",
    border: "1.3px solid #2563eb56",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 16.5,
    padding: "10px 32px",
    cursor: "pointer"
  },
};