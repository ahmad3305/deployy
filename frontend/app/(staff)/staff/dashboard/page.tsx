"use client";

import React, { useEffect, useState } from "react";
import { API_BASE } from "@/app/config";

const styles: Record<string, React.CSSProperties> = {
  bg: { minHeight: "100vh", width: "100vw", background: "linear-gradient(140deg, #1e293b 60%, #2563eb 110%)", color: "#e6eefb", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif", padding: 0 },
  shell: { maxWidth: 1000, margin: "0 auto", padding: "45px 18px 55px 18px", minHeight: "100vh" },
  title: { fontSize: 27, fontWeight: 800, color: "#60a5fa", marginBottom: 18, letterSpacing: 0.5, background: "none" },
  card: { background: "linear-gradient(110deg,#111827 60%, #1d4ed822 100%)", borderRadius: 15, boxShadow: "0 8px 36px #1e293b40, 0 2px 8px #2563eb33", border: "1.3px solid #2563eb26", marginBottom: 24, padding: "29px 25px 24px 25px" },
  error: { background: "#3f1d1d", color: "#fecaca", fontWeight: 600, padding: "12px 20px", borderRadius: 8, border: "1.5px solid #f87171", margin: "13px 0 8px", fontSize: 15.5, textAlign: "center" },
  loading: { color: "#93c5fd", fontSize: 18, padding: 18, textAlign: "center", fontWeight: 500 },
  sectionTitle: { fontSize: 19, fontWeight: 700, marginBottom: 8, color: "#93c5fd" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 15, marginTop: 8, background: "none" },
  th: { textAlign: "left", color: "#9dc3fa", fontWeight: 600, padding: "10px 7px", borderBottom: "1.5px solid #2563eb32", background: "none" },
  td: { padding: "9px 7px", borderBottom: "1px solid #2563eb21", background: "none" },
  filterBar: { display: "flex", gap: 11, marginBottom: 11 },
  input: { background: "#1e293b", border: "1.2px solid #2563eb39", borderRadius: 7, color: "#e6eefb", fontSize: 15.5, padding: "7px 12px", outline: "none" },
  profileBox: { display: "flex", gap: 28, alignItems: "center", marginBottom: 30, padding: "0 0 3px 5px" },
  profileText: { fontSize: 17, fontWeight: 500, lineHeight: 1.45 },
  statusActive: { color: "#34e36b", fontWeight: 800 },
  statusLeave: { color: "#eab308", fontWeight: 800 },
  statusInactive: { color: "#f87171", fontWeight: 800 },
  pills: { display: "inline-block", padding: "2px 12px", borderRadius: 12, background: "#182952", marginLeft: 5, color: "#38bdf8", fontWeight: 600, fontSize: 15.2 },
};

function staffStatusColor(status: string): React.CSSProperties | undefined {
  if (status === "Active") return styles.statusActive;
  if (status === "On Leave") return styles.statusLeave;
  if (status === "Inactive") return styles.statusInactive;
  return undefined;
}

type Shift = {
  shift_id: number;
  shift_date: string;
  shift_start: string;
  shift_end: string;
  availability_status: string;
};

type Assignment = {
  assignment_id: number;
  assignment_time: string;
  assignment_status: string;
  end_time?: string;
  task_id: number;
  task_type: string;
  required_role: string;
  task_status: string;
  task_start_time: string;
  task_end_time: string;
  flight_number?: string;
  departure_datetime?: string;
  airline_name?: string;
};

type StaffProfile = {
  first_name: string;
  last_name: string;
  role: string;
  staff_type: string;
  status: string;
  staff_id: number;
  airport_name?: string;
  license_number?: string;
};

const SHIFT_STATUS = ["Available", "Assigned", "Off"];

export default function StaffDashboard() {
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const [shiftError, setShiftError] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentLoading, setAssignmentLoading] = useState(true);
  const [assignmentError, setAssignmentError] = useState("");
  const [filters, setFilters] = useState({ status: "", date: "" });

  useEffect(() => {
    async function fetchProfile() {
      try {
        const token = localStorage.getItem("token") || "";
        const res = await fetch(`${API_BASE}/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        if (!res.ok || !json.success) throw new Error(json.message);
        if (!json.data.staff_id) throw new Error('Staff profile not linked to this account.');
        const res2 = await fetch(`${API_BASE}/staff/${json.data.staff_id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json2 = await res2.json();
        if (!res2.ok || !json2.success) throw new Error(json2.message);
        setProfile({
          ...json2.data,
        });
      } catch (e: any) {
        setShiftError(e?.message || "Failed to load profile.");
      }
    }
    fetchProfile();
  }, []);

  useEffect(() => {
    async function fetchShifts() {
      setShiftsLoading(true);
      setShiftError("");
      try {
        if (!profile?.staff_id) return;
        let url = `${API_BASE}/shifts?staff_id=${profile.staff_id}`;
        const token = localStorage.getItem("token") || "";
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message);
        let list: Shift[] = json.data || [];
        if (filters.status) list = list.filter(s => s.availability_status === filters.status);
        if (filters.date)   list = list.filter(s => s.shift_date === filters.date);
        setShifts(list);
      } catch (e: any) {
        setShiftError(e?.message || "Failed to load shifts.");
      } finally {
        setShiftsLoading(false);
      }
    }
    if (profile?.staff_id) fetchShifts();
  }, [profile?.staff_id, filters.status, filters.date]);

  useEffect(() => {
    async function fetchAssignments() {
      setAssignmentLoading(true);
      setAssignmentError("");
      try {
        if (!profile?.staff_id) return;
        let url = `${API_BASE}/task-assignments?staff_id=${profile.staff_id}`;
        const token = localStorage.getItem("token") || "";
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message);
        setAssignments(json.data || []);
      } catch (e: any) {
        setAssignmentError(e?.message || "Failed to load task assignments.");
      } finally {
        setAssignmentLoading(false);
      }
    }
    if (profile?.staff_id) fetchAssignments();
  }, [profile?.staff_id]);

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <h1 style={styles.title}>👷 Staff Dashboard</h1>
        {profile && (
          <div style={styles.profileBox}>
            <div>
              <div style={styles.profileText}>
                <strong>{profile.first_name} {profile.last_name}</strong>
                <span style={{ marginLeft: 7, fontSize: 14, color: "#93c5fd", fontWeight: 700 }}>[{profile.role}]</span>
                <span style={styles.pills}>{profile.staff_type}</span>
              </div>
              <div style={styles.profileText}>
                Status: <span style={staffStatusColor(profile.status)}>{profile.status}</span>
                {profile.airport_name && (
                  <> | Airport: <b>{profile.airport_name}</b></>
                )}
                {profile.license_number && (
                  <> | License #: <span style={{ color: "#38bdf8" }}>{profile.license_number}</span></>
                )}
              </div>
            </div>
          </div>
        )}

        <div style={styles.card}>
          <div style={styles.sectionTitle}>Your Shifts</div>
          <div style={styles.filterBar}>
            <select
              style={styles.input}
              value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            >
              <option value="">All Statuses</option>
              {SHIFT_STATUS.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
            <input
              style={styles.input}
              type="date"
              value={filters.date}
              onChange={e => setFilters(f => ({ ...f, date: e.target.value }))}
            />
            <button
              style={styles.input}
              onClick={() => setFilters({ status: "", date: "" })}
              type="button"
            >Clear Filters</button>
          </div>
          {shiftError && <div style={styles.error}>{shiftError}</div>}
          {shiftsLoading ? (
            <div style={styles.loading}>Loading shifts...</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Start</th>
                  <th style={styles.th}>End</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {shifts.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ color: "#fca5a5", textAlign: "center", padding: 14 }}>No shifts found.</td>
                  </tr>
                ) : (
                  shifts.map(s => (
                    <tr key={s.shift_id}>
                      <td style={styles.td}>{s.shift_date}</td>
                      <td style={styles.td}>{s.shift_start}</td>
                      <td style={styles.td}>{s.shift_end}</td>
                      <td style={styles.td}>{s.availability_status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.sectionTitle}>Your Task Assignments</div>
          {assignmentError && <div style={styles.error}>{assignmentError}</div>}
          {assignmentLoading ? (
            <div style={styles.loading}>Loading assignments...</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Task</th>
                  <th style={styles.th}>Flight</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Scheduled</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Assignment</th>
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ color: "#fca5a5", textAlign: "center", padding: 14 }}>No assignments found.</td>
                  </tr>
                ) : (
                  assignments.map(a => (
                    <tr key={a.assignment_id}>
                      <td style={styles.td}>{a.task_type}</td>
                      <td style={styles.td}>{a.flight_number ?? "—"}</td>
                      <td style={styles.td}>{a.required_role}</td>
                      <td style={styles.td}>
                        {a.task_start_time?.slice(0, 16)} – {a.task_end_time?.slice(11, 16)}
                      </td>
                      <td style={styles.td}>{a.assignment_status}</td>
                      <td style={styles.td}>{a.assignment_time?.slice(0, 16)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
