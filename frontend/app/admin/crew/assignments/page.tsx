"use client";

import React, { useEffect, useState } from "react";
import { API_BASE } from "@/app/config";

type Assignment = {
  assignment_id: number;
  task_id: number;
  staff_id: number;
  staff_first_name: string;
  staff_last_name: string;
  staff_role: string;
  staff_type: string;
  assignment_time: string;
  assignment_status: string;
  flight_number: string | null;
  airline_name: string | null;
  task_type: string | null;
  required_role: string | null;
  task_start_time: string | null;
  task_end_time: string | null;
  task_status: string | null;
  departure_datetime?: string | null;
};

async function fetchAssignments(token?: string): Promise<Assignment[]> {
  const res = await fetch(`${API_BASE}/task-assignments`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch assignments");
  return Array.isArray(json.data) ? json.data : [];
}

const STATUS_OPTIONS = ["Assigned", "Completed", "Pending", "Cancelled"];
const ROLE_OPTIONS = [
  "Pilot", "Co-Pilot", "Cabin Crew", "Check-in Staff", "Boarding Staff",
  "Baggage Handler", "Ramp Operator", "Maintenance Crew", "Supervisor"
];

export default function CrewAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filtered, setFiltered] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [airlineFilter, setAirlineFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true); setError("");
      try {
        const token = localStorage.getItem("token") || "";
        const data = await fetchAssignments(token);
        setAssignments(data);
      } catch (e: any) {
        setError(e?.message || "Failed to load assignments.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    let result = assignments.filter(a => {
      let matches = true;
      const q = search.toLowerCase();
      if (q) {
        matches = (
          a.staff_first_name?.toLowerCase().includes(q) ||
          a.staff_last_name?.toLowerCase().includes(q) ||
          (a.staff_role ?? "").toLowerCase().includes(q) ||
          (a.required_role ?? "").toLowerCase().includes(q) ||
          (a.flight_number ?? "").toLowerCase().includes(q) ||
          (a.airline_name ?? "").toLowerCase().includes(q) ||
          (a.assignment_status ?? "").toLowerCase().includes(q)
        );
      }
      if (matches && showAdvanced) {
        if (roleFilter && (a.required_role !== roleFilter)) matches = false;
        if (statusFilter && (a.assignment_status !== statusFilter)) matches = false;
        if (airlineFilter && (a.airline_name ?? "") !== airlineFilter) matches = false;
        if (dateFrom && (!a.assignment_time || new Date(a.assignment_time) < new Date(dateFrom))) matches = false;
        if (dateTo && (!a.assignment_time || new Date(a.assignment_time) > new Date(dateTo))) matches = false;
      }
      return matches;
    });
    setFiltered(result);
  }, [assignments, search, showAdvanced, statusFilter, roleFilter, airlineFilter, dateFrom, dateTo]);

  const airlineOptions = Array.from(new Set(assignments.map(a => a.airline_name).filter(Boolean)));

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <div style={styles.headerBar}>
          <h1 style={styles.title}>🗂️ Crew Assignments</h1>
          <button style={styles.advBtn} onClick={() => setShowAdvanced(s => !s)}>
            {showAdvanced ? "Basic Search" : "Advanced Search"}
          </button>
        </div>
        <div style={styles.searchWrap}>
          <input
            type="text"
            style={styles.input}
            placeholder="Search crew, flight, airline, role, status..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {showAdvanced && (
            <div style={styles.filterRow}>
              <select
                style={styles.select}
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
              >
                <option value="">All Roles</option>
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                style={styles.select}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                style={styles.select}
                value={airlineFilter}
                onChange={e => setAirlineFilter(e.target.value)}
              >
                <option value="">All Airlines</option>
                {airlineOptions.map(air => <option key={air} value={air}>{air}</option>)}
              </select>
              <span style={styles.label}>Date</span>
              <input
                style={styles.inputSmall}
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
              <span style={{color:"#60a5fa"}}>to</span>
              <input
                style={styles.inputSmall}
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
              {(roleFilter || statusFilter || airlineFilter || dateFrom || dateTo) && (
                <button style={styles.clearBtn}
                  onClick={() => {
                    setRoleFilter(""); setStatusFilter(""); setAirlineFilter(""); setDateFrom(""); setDateTo("");
                  }}>
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
        {loading ? (
          <div style={styles.loading}>Loading assignments...</div>
        ) : error ? (
          <div style={styles.error}>{error}</div>
        ) : (
          <div style={styles.card}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Role</th>
                  <th>Assignment</th>
                  <th>Flight</th>
                  <th>Airline</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                  <th>Assigned At</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", color: "#fca5a5" }}>No assignments found.</td>
                  </tr>
                ) : (
                  filtered.map(a => (
                    <tr key={a.assignment_id}>
                      <td style={{ fontWeight: 700 }}>
                        {a.staff_first_name} {a.staff_last_name}
                      </td>
                      <td>
                        <span style={styles.roleBadge}>{a.staff_role ?? "—"}</span>
                      </td>
                      <td>
                        <span style={styles.roleBadge}>{a.required_role ?? "—"}</span>
                        <br/>
                        <span style={{color:"#38bdf8", fontSize:12, fontWeight:500}}>
                          {a.task_type ?? "—"}
                        </span>
                      </td>
                      <td>
                        <span style={styles.flightBadge}>
                          {a.flight_number ? `#${a.flight_number}` : "—"}
                        </span>
                      </td>
                      <td>{a.airline_name || "—"}</td>
                      <td>{a.task_start_time ? new Date(a.task_start_time).toLocaleString() : "—"}</td>
                      <td>{a.task_end_time ? new Date(a.task_end_time).toLocaleString() : "—"}</td>
                      <td>
                        <span style={statusBadge(a.assignment_status)}>
                          {a.assignment_status ?? "—"}
                        </span>
                      </td>
                      <td>{a.assignment_time ? new Date(a.assignment_time).toLocaleString() : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function statusBadge(status?: string) {
  status = status?.toLowerCase?.() || "";
  let bg = "#60a5facc"; let color = "#17315a";
  if (status === "completed") { bg = "#22c55ecc"; color = "#073c19"; }
  if (status === "cancelled") { bg = "#f87171cc"; color = "#fff"; }
  if (status === "assigned") { bg = "#818cf833"; color = "#6366f1"; }
  if (status === "pending") { bg = "#fbbf24cc"; color = "#543c11"; }
  return {
    background: bg,
    color,
    borderRadius: 9,
    padding: "2.5px 12px",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 0.3,
    textTransform: "capitalize" as const,
    border: "none",
    outline: "none",
  };
}

const styles: Record<string, React.CSSProperties> = {
  bg: { minHeight: "100vh", width: "100vw", background: "linear-gradient(140deg, #1e293b 70%, #2563eb 110%)", color: "#e6eefb", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif", padding: 0 },
  shell: { maxWidth: 1320, margin: "0 auto", padding: "40px 18px 65px 18px", minHeight: "100vh" },
  headerBar: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", marginBottom: 14 },
  title: { fontSize: 30, fontWeight: 800, color: "#60a5fa", margin: 0, letterSpacing: 0.5, background: "none" },
  advBtn: { padding: "8px 19px", background: "linear-gradient(90deg,#111827 10%, #60a5fa 100%)", color: "#fff", borderRadius: 9, fontWeight: 700, fontSize: 15.5, border: "none", cursor: "pointer", boxShadow: "0 1px 8px #60a5fa12" },
  searchWrap: { marginBottom: 18, display: "flex", flexDirection: "column" as const, gap: "11px" },
  input: { background: "#1e293b", border: "1.2px solid #2563eb39", borderRadius: 7, color: "#e6eefb", fontSize: 15.5, padding: "11px 13px", outline: "none", marginBottom: 1, fontWeight: 600, width: "100%", maxWidth: 520 },
  inputSmall: { background: "#1e293b", border: "1.2px solid #2563eb39", borderRadius: 7, color: "#e6eefb", fontSize: 15, padding: "5.5px 7px", outline: "none", fontWeight: 600, width: 140, marginRight: 5, marginLeft: 5 },
  clearBtn: { background: "none", color: "#60a5fa", border: "1px solid #2563eb66", borderRadius: 7, fontWeight: 600, padding: "6px 12px", fontSize: 13.5, cursor: "pointer", marginLeft: 18 },
  filterRow: { display: "flex", alignItems: "center", gap: "8px", marginBottom: 0, marginTop: 1 },
  label: { color: "#93c5fd", fontWeight: 500, fontSize: 14.5, marginLeft: 8, marginRight: 2 },
  select: { background: "#1e293b", border: "1.2px solid #2563eb39", borderRadius: 7, color: "#e6eefb", fontSize: 15, padding: "8px 11px", outline: "none", fontWeight: 600, marginLeft: 7, marginRight: 5 },
  loading: { color: "#93c5fd", fontSize: 18, padding: 28, textAlign: "center", fontWeight: 500 },
  error: { background: "#3f1d1d", color: "#fecaca", fontWeight: 600, padding: "14px 24px", borderRadius: 8, border: "1.6px solid #f87171", margin: "18px 0 13px", fontSize: 16, textAlign: "center" },
  card: { background: "linear-gradient(110deg, #111827 70%, #1d4ed822 100%)", borderRadius: 15, boxShadow: "0 8px 36px #1e293b40, 0 2px 8px #2563eb33", border: "1.3px solid #2563eb26", marginBottom: 18, overflowX: "auto", marginTop: 6 },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: "0 0.2rem", fontSize: 16.2, color: "#dde7fa", background: "none", minWidth: 1200 },
  roleBadge: { background: "#2563eb28", color: "#2563eb", borderRadius: 8, padding: "2px 9px", fontSize: 13.3, fontWeight: 600, marginRight: 0 },
  flightBadge: { background: "#818cf833", color: "#6366f1", borderRadius: 8, padding: "2px 11px", fontWeight: 700, fontSize: 13.3 },
};
