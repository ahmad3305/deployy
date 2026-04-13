"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSchedulesByStatus,
  delaySchedule,
  FlightSchedule,
} from "@/app/services/schedule.service";

const TAB_STATUSES = [
  { key: "Scheduled", label: "Scheduled" },
  { key: "Delayed", label: "Delayed" },
  { key: "Consolidated", label: "Consolidated" },
];

const DELAY_REASONS = [
  "Technical Issue",
  "Weather Delay",
  "Security Issue",
  "Emergency",
];

export default function SchedulesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"Scheduled" | "Delayed" | "Consolidated">(
    "Scheduled"
  );
  const [schedules, setSchedules] = useState<FlightSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [delayModalId, setDelayModalId] = useState<number | null>(null);
  const [delayReason, setDelayReason] = useState("");
  const [delaySubmitting, setDelaySubmitting] = useState(false);
  const [delayError, setDelayError] = useState("");

  // Check auth on mount
  useEffect(() => {
    const user =
      typeof window !== "undefined" ? sessionStorage.getItem("user") : null;
    console.log("Checking admin auth for schedules, user:", user);

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

  // Fetch schedules only if authorized
  useEffect(() => {
    if (!isAuthorized) return;

    async function fetchSchedules() {
      setLoading(true);
      setError("");
      try {
        const token = sessionStorage.getItem("token") || "";

        if (!token) {
          throw new Error("No authentication token found");
        }

        console.log("Fetching schedules with token:", token.substring(0, 20) + "...");

        const data = await getSchedulesByStatus(activeTab, token);
        console.log("Schedules data:", data);
        setSchedules(data);
      } catch (e: any) {
        console.error("Fetch schedules error:", e);
        setError(e?.message || "Failed to load schedules.");
      } finally {
        setLoading(false);
      }
    }

    fetchSchedules();
  }, [activeTab, isAuthorized]);

  function openDelayModal(id: number) {
    setDelayModalId(id);
    setDelayError("");
    setDelayReason("");
  }

  function closeDelayModal() {
    setDelayModalId(null);
    setDelayError("");
    setDelayReason("");
  }

  async function handleDelayFlight() {
    if (!delayModalId || !delayReason) {
      setDelayError("Please select a reason.");
      return;
    }
    setDelayError("");
    setDelaySubmitting(true);
    try {
      const token = sessionStorage.getItem("token") || "";

      if (!token) {
        throw new Error("No authentication token found");
      }

      console.log("Delaying flight with token:", token.substring(0, 20) + "...");

      await delaySchedule(delayModalId, delayReason, token);
      setSchedules(schedules.filter((s) => s.flight_schedule_id !== delayModalId));
      closeDelayModal();
    } catch (e: any) {
      console.error("Delay flight error:", e);
      setDelayError(e?.message || "Failed to delay flight.");
    } finally {
      setDelaySubmitting(false);
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
        <div style={styles.headerBar}>
          <h1 style={styles.title}>✈️ Flight Schedules</h1>
          <button
            style={styles.createBtn}
            onClick={() => router.push("/admin/schedules/create")}
          >
            + Create Schedule
          </button>
        </div>

        <div style={styles.tabsBar}>
          {TAB_STATUSES.map((tab) => (
            <button
              key={tab.key}
              style={{
                ...styles.tab,
                ...(activeTab === tab.key ? styles.tabActive : undefined),
              }}
              onClick={() => setActiveTab(tab.key as any)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={styles.loading}>Loading schedules...</div>
        ) : error ? (
          <div style={styles.error}>{error}</div>
        ) : (
          <div style={styles.card}>
            {schedules.length === 0 ? (
              <div style={{ ...styles.loading, color: "#fca5a5" }}>
                No {activeTab.toLowerCase()} flights.
              </div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Flight</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Departure</th>
                    <th style={styles.th}>Arrival</th>
                    <th style={styles.th}>From</th>
                    <th style={styles.th}>To</th>
                    <th style={styles.th}>Gate</th>
                    <th style={styles.th}>Status</th>
                    {activeTab === "Delayed" && <th style={styles.th}>Delay Reason</th>}
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
                        <span
                          style={{
                            background: "#2563eb28",
                            color: "#60a5fa",
                            borderRadius: 8,
                            padding: "4px 10px",
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          {s.flight_type}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 600 }}>
                          {formatDateTime(s.departure_datetime)}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 600 }}>
                          {formatDateTime(s.arrival_datetime)}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.cityLabel}>
                          <span style={styles.airportCode}>
                            {s.source_airport_code || "—"}
                          </span>{" "}
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
                          </span>{" "}
                          <br />
                          <span style={styles.secondary}>
                            {s.destination_airport_name || "—"}
                          </span>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div>
                          <span style={{ fontWeight: 600 }}>T: {s.terminal_name || "—"}</span>
                          <br />
                          <span style={{ fontWeight: 600 }}>G: {s.gate_number || "—"}</span>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            background:
                              s.flight_status === "Scheduled"
                                ? "#22c55e33"
                                : s.flight_status === "Delayed"
                                ? "#fbbf2433"
                                : s.flight_status === "Consolidated"
                                ? "#818cf833"
                                : "#1e293b44",
                            color:
                              s.flight_status === "Scheduled"
                                ? "#22c55e"
                                : s.flight_status === "Delayed"
                                ? "#fbbf24"
                                : s.flight_status === "Consolidated"
                                ? "#6366f1"
                                : "#e6eefb",
                            borderRadius: 8,
                            padding: "4px 10px",
                            fontWeight: 700,
                            fontSize: 13,
                            display: "inline-block",
                          }}
                        >
                          {s.flight_status}
                        </span>
                      </td>
                      {activeTab === "Delayed" && (
                        <td style={styles.td}>
                          <span
                            style={{
                              background: "#fbbf241e",
                              color: "#fbbf24",
                              fontWeight: 700,
                              borderRadius: 6,
                              padding: "4px 10px",
                              fontSize: 13,
                              display: "inline-block",
                            }}
                          >
                            {s.delay_reason || "—"}
                          </span>
                        </td>
                      )}
                      <td style={styles.td}>
                        <button
                          style={styles.actionBtn}
                          onClick={() =>
                            router.push(
                              `/admin/schedules/${s.flight_schedule_id}/edit`
                            )
                          }
                        >
                          View/Edit
                        </button>
                        {activeTab === "Scheduled" && (
                          <button
                            style={styles.delayBtn}
                            onClick={() => openDelayModal(s.flight_schedule_id)}
                          >
                            Delay
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {delayModalId && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <h2
                style={{
                  color: "#60a5fa",
                  fontWeight: 800,
                  fontSize: 22,
                  margin: 0,
                  marginBottom: 16,
                }}
              >
                Delay Flight
              </h2>
              <div style={{ marginBottom: 18 }}>
                <label
                  style={{
                    fontWeight: 600,
                    color: "#93c5fd",
                    fontSize: 16,
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  Delay Reason *
                </label>
                <select
                  style={styles.input}
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                >
                  <option value="">Select reason…</option>
                  {DELAY_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              {delayError && <div style={styles.error}>{delayError}</div>}
              <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                <button
                  style={styles.primaryBtn}
                  onClick={handleDelayFlight}
                  disabled={delaySubmitting}
                >
                  {delaySubmitting ? "Delaying..." : "Delay Flight"}
                </button>
                <button
                  style={styles.cancelBtn}
                  onClick={closeDelayModal}
                  disabled={delaySubmitting}
                >
                  Cancel
                </button>
              </div>
            </div>
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
    maxWidth: 1400,
    margin: "0 auto",
    padding: "40px 18px 55px 18px",
    minHeight: "100vh",
  },
  headerBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  title: {
    fontSize: 32,
    fontWeight: 800,
    color: "#60a5fa",
    margin: 0,
    letterSpacing: 0.5,
    background: "none",
  },
  createBtn: {
    padding: "10px 26px",
    background: "linear-gradient(90deg,#2563eb 75%, #0ea5e9)",
    border: "none",
    color: "#fff",
    borderRadius: 9,
    fontWeight: 700,
    fontSize: 16,
    boxShadow: "0 2px 8px #2563eb33",
    cursor: "pointer",
    transition: "all 0.12s",
  },
  tabsBar: {
    display: "flex",
    gap: 8,
    marginBottom: 20,
    borderBottom: "2px solid #2563eb33",
  },
  tab: {
    background: "none",
    color: "#93c5fd",
    border: "none",
    borderBottom: "3px solid transparent",
    fontSize: 16,
    fontWeight: 700,
    padding: "12px 24px",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  tabActive: {
    color: "#2563eb",
    borderBottom: "3px solid #2563eb",
  },
  loading: {
    color: "#93c5fd",
    fontSize: 18,
    padding: 40,
    textAlign: "center",
    fontWeight: 500,
  },
  error: {
    background: "#3f1d1d",
    color: "#fecaca",
    fontWeight: 600,
    padding: "16px 20px",
    borderRadius: 8,
    border: "1.5px solid #f87171",
    margin: "16px 0",
    fontSize: 15,
    textAlign: "center",
  },
  card: {
    background: "linear-gradient(110deg, #111827 70%, #1d4ed822 100%)",
    borderRadius: 15,
    boxShadow: "0 8px 36px #1e293b40, 0 2px 8px #2563eb33",
    border: "1.3px solid #2563eb26",
    marginBottom: 20,
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
  actionBtn: {
    background: "#2563eb",
    color: "#fff",
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 14,
    fontWeight: 600,
    border: "none",
    marginRight: 6,
    marginBottom: 4,
    cursor: "pointer",
    boxShadow: "0 2px 4px #2563eb16",
    transition: "all 0.12s",
  },
  delayBtn: {
    background: "#fbbf24",
    color: "#1e293b",
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 14,
    fontWeight: 600,
    border: "none",
    marginBottom: 4,
    cursor: "pointer",
    boxShadow: "0 2px 4px #fbbf2416",
    transition: "all 0.12s",
  },
  primaryBtn: {
    background: "linear-gradient(90deg,#2563eb 77%, #0ea5e9)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 15,
    padding: "10px 28px",
    cursor: "pointer",
    boxShadow: "0 2px 8px #2563eb33",
    transition: "all 0.12s",
  },
  cancelBtn: {
    background: "none",
    color: "#93c5fd",
    border: "1.3px solid #2563eb56",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 15,
    padding: "10px 28px",
    cursor: "pointer",
    transition: "all 0.12s",
  },
  modalOverlay: {
    position: "fixed",
    left: 0,
    top: 0,
    width: "100vw",
    height: "100vh",
    background: "rgba(23, 39, 65, 0.7)",
    zIndex: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modal: {
    background: "linear-gradient(110deg, #182033 70%, #1d4ed822 100%)",
    borderRadius: 13,
    border: "1.3px solid #2563eb26",
    padding: 32,
    minWidth: 360,
    maxWidth: 440,
    boxShadow: "0 8px 36px #1e293b60, 0 2px 8px #2563eb33",
  },
  input: {
    background: "#1e293b",
    border: "1.2px solid #2563eb39",
    borderRadius: 7,
    color: "#e6eefb",
    fontSize: 15,
    padding: "10px 12px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    fontWeight: 500,
  },
};