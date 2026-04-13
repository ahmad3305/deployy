"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/app/config";

type Shift = {
  shift_id: number;
  staff_id: number;
  staff_first_name?: string;
  staff_last_name?: string;
  staff_role?: string;
  staff_type?: string;
  shift_date: string;
  shift_start: string;
  shift_end: string;
  availability_status: string;
};

export default function ShiftsListPage() {
  const router = useRouter();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [filters, setFilters] = useState({
    staff_id: "",
    shift_date: "",
    availability_status: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Check auth on mount
  useEffect(() => {
    const user =
      typeof window !== "undefined" ? sessionStorage.getItem("user") : null;
    console.log("Checking admin auth for shifts, user:", user);

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

  // Fetch shift list only if authorized
  useEffect(() => {
    if (!isAuthorized) return;

    async function load() {
      setLoading(true);
      setError("");
      try {
        // Build URL with proper query parameters
        const params = new URLSearchParams();
        if (filters.staff_id) params.append("staff_id", filters.staff_id);
        if (filters.shift_date) params.append("shift_date", filters.shift_date);
        if (filters.availability_status)
          params.append("availability_status", filters.availability_status);

        const url = `${API_BASE}/shifts${params.toString() ? "?" + params.toString() : ""}`;

        const token = sessionStorage.getItem("token") || "";

        if (!token) {
          throw new Error("No authentication token found");
        }

        console.log("Fetching shifts from:", url);
        console.log("Token:", token.substring(0, 20) + "...");

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log("Shifts response status:", res.status);

        // Check if response is ok and has content
        if (!res.ok) {
          const text = await res.text();
          console.error("Shifts error response:", text);
          throw new Error(`HTTP ${res.status}: ${text || "Unknown error"}`);
        }

        // Check if response has content before parsing JSON
        const text = await res.text();
        console.log("Raw response text:", text);

        if (!text) {
          throw new Error("Empty response from server");
        }

        const json = JSON.parse(text);
        console.log("Shifts response:", json);

        if (!json.success) throw new Error(json.message || "Failed to load shifts");
        setShifts(json.data || []);
      } catch (e: any) {
        console.error("Fetch shifts error:", e);
        setError(e?.message || "Failed to load shifts");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [
    isAuthorized,
    filters.staff_id,
    filters.shift_date,
    filters.availability_status,
  ]);

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
          <div style={styles.title}>📅 All Shifts</div>
          <button
            style={styles.addShiftBtn}
            onClick={() => router.push("/admin/staff/shifts/create")}
          >
            + Add Shift
          </button>
        </div>
        <div style={styles.card}>
          <div style={styles.filterBar}>
            <input
              style={styles.input}
              placeholder="Staff ID"
              type="number"
              value={filters.staff_id}
              onChange={(e) =>
                setFilters((f) => ({ ...f, staff_id: e.target.value }))
              }
            />
            <input
              style={styles.input}
              type="date"
              value={filters.shift_date}
              onChange={(e) =>
                setFilters((f) => ({ ...f, shift_date: e.target.value }))
              }
            />
            <select
              style={styles.input}
              value={filters.availability_status}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  availability_status: e.target.value,
                }))
              }
            >
              <option value="">Any Status</option>
              <option value="Available">Available</option>
              <option value="Assigned">Assigned</option>
              <option value="Off">Off</option>
            </select>
          </div>
          {error && <div style={styles.error}>{error}</div>}
          {loading ? (
            <div style={styles.loading}>Loading shifts...</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Staff</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Start</th>
                  <th style={styles.th}>End</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shifts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{ textAlign: "center", color: "#fca5a5", padding: 16 }}
                    >
                      No shifts found.
                    </td>
                  </tr>
                ) : (
                  shifts.map((shift) => (
                    <tr key={shift.shift_id}>
                      <td style={styles.td}>
                        <b>
                          {shift.staff_first_name} {shift.staff_last_name}
                        </b>
                        <br />
                        <span style={{ fontSize: 13, color: "#93c5fd" }}>
                          #{shift.staff_id}
                        </span>
                      </td>
                      <td style={styles.td}>{shift.staff_role}</td>
                      <td style={styles.td}>{shift.staff_type}</td>
                      <td style={styles.td}>{shift.shift_date}</td>
                      <td style={styles.td}>{shift.shift_start}</td>
                      <td style={styles.td}>{shift.shift_end}</td>
                      <td style={styles.td}>
                        <span
                          style={{
                            background:
                              shift.availability_status === "Available"
                                ? "#86efac"
                                : shift.availability_status === "Assigned"
                                ? "#60a5fa"
                                : "#f87171",
                            color: "#1e293b",
                            padding: "4px 8px",
                            borderRadius: 4,
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          {shift.availability_status}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <button
                          style={styles.actionBtn}
                          onClick={() =>
                            router.push(
                              `/admin/staff/shifts/${shift.shift_id}/edit`
                            )
                          }
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        <div style={styles.actionBar}>
          <button
            type="button"
            style={styles.cancelBtn}
            onClick={() => router.push("/admin/staff")}
          >
            Back to Staff List
          </button>
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
    maxWidth: 1000,
    margin: "0 auto",
    padding: "45px 18px 55px 18px",
    minHeight: "100vh",
  },
  headerBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  title: {
    fontSize: 27,
    fontWeight: 800,
    color: "#60a5fa",
    marginBottom: 0,
    letterSpacing: 0.5,
    background: "none",
  },
  addShiftBtn: {
    padding: "10px 18px",
    background: "linear-gradient(90deg,#2563eb 77%, #0ea5e9)",
    color: "#fff",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 16,
    border: "none",
    cursor: "pointer",
    boxShadow: "0 2px 8px #2563eb33",
  },
  card: {
    background: "linear-gradient(110deg,#111827 70%, #1d4ed822 100%)",
    borderRadius: 15,
    boxShadow: "0 8px 36px #1e293b40, 0 2px 8px #2563eb33",
    border: "1.3px solid #2563eb26",
    marginBottom: 21,
    padding: "29px 25px 24px 25px",
  },
  filterBar: {
    display: "flex",
    gap: 11,
    marginBottom: 16,
    alignItems: "center",
    flexWrap: "wrap",
  },
  input: {
    background: "#1e293b",
    border: "1.2px solid #2563eb39",
    borderRadius: 7,
    color: "#e6eefb",
    fontSize: 16,
    padding: "7px 12px",
    outline: "none",
    minWidth: 120,
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
  loading: {
    color: "#93c5fd",
    fontSize: 18,
    padding: 23,
    textAlign: "center",
    fontWeight: 500,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: 12,
    fontSize: 14,
    background: "none",
  },
  th: {
    textAlign: "left",
    color: "#9dc3fa",
    fontWeight: 700,
    padding: "12px 7px",
    borderBottom: "1.5px solid #2563eb32",
    background: "none",
  },
  td: {
    padding: "10px 7px",
    borderBottom: "1px solid #2563eb21",
    background: "none",
  },
  actionBtn: {
    background: "#2563eb",
    color: "#fff",
    borderRadius: 8,
    padding: "7px 18px",
    fontWeight: 700,
    fontSize: 15,
    border: "none",
    cursor: "pointer",
    marginRight: 8,
  },
  actionBar: {
    display: "flex",
    gap: 17,
    marginTop: 12,
  },
  cancelBtn: {
    background: "none",
    color: "#93c5fd",
    border: "1.3px solid #2563eb56",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 16.5,
    padding: "10px 32px",
    cursor: "pointer",
  },
};