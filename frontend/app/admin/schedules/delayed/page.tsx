"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSchedulesByStatus,
  FlightSchedule,
} from "@/app/services/schedule.service";


export default function DelayedSchedulesPage() {
  const [schedules, setSchedules] = useState<FlightSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();

  // Check auth on mount
  useEffect(() => {
    const user =
      typeof window !== "undefined" ? sessionStorage.getItem("user") : null;
    console.log("Checking admin auth for delayed schedules, user:", user);

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

  // Fetch delayed schedules only if authorized
  useEffect(() => {
    if (!isAuthorized) return;

    async function fetchDelayedSchedules() {
      setLoading(true);
      setError("");
      try {
        const token = sessionStorage.getItem("token") || "";

        if (!token) {
          throw new Error("No authentication token found");
        }

        console.log("Fetching delayed schedules with token:", token.substring(0, 20) + "...");

        const data = await getSchedulesByStatus("Delayed", token);
        console.log("Delayed schedules data:", data);

        setSchedules(Array.isArray(data) ? data : []);
      } catch (e: any) {
        console.error("Fetch delayed schedules error:", e);
        setError(e?.message || "Failed to load delayed schedules.");
      } finally {
        setLoading(false);
      }
    }

    fetchDelayedSchedules();
  }, [isAuthorized]);

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
        <h1 style={styles.title}>⏰ Delayed Flight Schedules</h1>
        {loading ? (
          <div style={styles.loading}>Loading...</div>
        ) : error ? (
          <div style={styles.error}>{error}</div>
        ) : (
          <div style={styles.card}>
            {schedules.length === 0 ? (
              <div style={{ ...styles.loading, color: "#fca5a5" }}>
                No delayed flights found.
              </div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Flight</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Departure</th>
                    <th style={styles.th}>From</th>
                    <th style={styles.th}>To</th>
                    <th style={styles.th}>Gate</th>
                    <th style={styles.th}>Delay Reason</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s) => (
                    <tr key={s.flight_schedule_id}>
                      <td style={styles.td}>
                        <span style={{ fontWeight: 700 }}>
                          {s.airline_code}-{s.flight_number}
                        </span>
                        <span
                          style={{
                            color: "#60a5fa",
                            marginLeft: 7,
                            fontWeight: 500,
                            fontSize: 13,
                          }}
                        >
                          ({s.airline_name})
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.typeBadge}>{s.flight_type}</span>
                      </td>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 600 }}>
                          {formatDateTime(s.departure_datetime)}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.cityLabel}>
                          <span style={styles.airportCode}>
                            {s.source_airport_code || "—"}
                          </span>
                          <br />
                          <span style={styles.secondary}>
                            {s.source_airport_name || "—"}
                          </span>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.cityLabel}>
                          <span style={styles.airportCode}>
                            {s.destination_airport_code || "—"}
                          </span>
                          <br />
                          <span style={styles.secondary}>
                            {s.destination_airport_name || "—"}
                          </span>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div>
                          <span style={{ fontWeight: 600 }}>
                            T: {s.terminal_name || "—"}
                          </span>
                          <br />
                          <span style={{ fontWeight: 600 }}>
                            G: {s.gate_number || "—"}
                          </span>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.delayBadge}>
                          {s.delay_reason || "—"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.delayedStatusBadge}>
                          {s.flight_status}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {s.delay_reason !== "Crew Issue" ? (
                          <button
                            style={styles.rescheduleBtn}
                            onClick={() =>
                              router.push(
                                `/admin/schedules/${s.flight_schedule_id}/edit`
                              )
                            }
                          >
                            Reschedule
                          </button>
                        ) : (
                          <span style={styles.autoLabel}>Auto-Rescheduled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDateTime(dt: string) {
  if (!dt) return "—";
  try {
    const d = new Date(dt);
    return d.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
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
    background: "linear-gradient(140deg, #1e293b 70%, #2563eb 120%)",
    color: "#e6eefb",
    fontFamily:
      "system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
    padding: 0,
  },
  shell: {
    maxWidth: 1250,
    margin: "0 auto",
    padding: "40px 18px 65px 18px",
    minHeight: "100vh",
  },
  title: {
    fontSize: 30,
    fontWeight: 800,
    color: "#60a5fa",
    margin: "0 0 22px 0",
    letterSpacing: 0.5,
    background: "none",
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
    margin: "18px 0 13px",
    fontSize: 16,
    textAlign: "center",
  },
  card: {
    background: "linear-gradient(110deg, #111827 70%, #1d4ed822 100%)",
    borderRadius: 15,
    boxShadow: "0 8px 36px #1e293b40, 0 2px 8px #2563eb33",
    border: "1.3px solid #2563eb26",
    marginBottom: 18,
    overflowX: "auto",
    padding: "4px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 15,
    color: "#dde7fa",
    background: "none",
  },
  th: {
    textAlign: "left",
    color: "#9dc3fa",
    fontWeight: 700,
    padding: "14px 12px",
    borderBottom: "1.5px solid #2563eb32",
    background: "none",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px 12px",
    borderBottom: "1px solid #2563eb21",
    background: "none",
  },
  airportCode: {
    fontWeight: 800,
    fontSize: 14,
    color: "#60a5fa",
    marginRight: 6,
    letterSpacing: "0.05em",
  },
  secondary: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: 500,
  },
  cityLabel: {
    lineHeight: 1.4,
  },
  typeBadge: {
    background: "#2563eb28",
    color: "#60a5fa",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 13,
    fontWeight: 600,
    display: "inline-block",
  },
  delayBadge: {
    background: "#fbbf241e",
    color: "#fbbf24",
    fontWeight: 700,
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 13,
    display: "inline-block",
  },
  delayedStatusBadge: {
    background: "#fbbf2433",
    color: "#fbbf24",
    borderRadius: 6,
    padding: "4px 10px",
    fontWeight: 700,
    fontSize: 13,
    display: "inline-block",
  },
  rescheduleBtn: {
    background: "linear-gradient(90deg,#2563eb 77%, #0ea5e9)",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 14,
    padding: "8px 20px",
    cursor: "pointer",
    boxShadow: "0 2px 7px #2563eb19",
    transition: "all 0.12s",
  },
  autoLabel: {
    color: "#93c5fd",
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: 0.2,
    opacity: 0.8,
  },
};