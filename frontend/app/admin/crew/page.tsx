"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/app/config";

type Staff = {
  staff_id: number;
  airport_id: number;
  first_name: string;
  last_name: string;
  role: string;
  staff_type: string;
  hire_date: string;
  license_number?: string;
  status: string;
  airport_name?: string;
  airport_code?: string;
  total_shifts?: number;
};

type Shift = {
  shift_id: number;
  staff_id: number;
  start_time: string;
  end_time: string;
  role: string;
};

export default function CrewPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();

  // Check auth on mount
  useEffect(() => {
    const user =
      typeof window !== "undefined" ? sessionStorage.getItem("user") : null;
    console.log("Checking auth for crew page, user:", user);

    if (!user) {
      console.log("No user found, redirecting to login");
      router.push("/login");
      return;
    }

    try {
      const parsed = JSON.parse(user);
      console.log("User role:", parsed.role);

      // Allow Admin or Staff roles
      if (parsed.role !== "Admin" && parsed.role !== "Staff") {
        console.log("User role not allowed, redirecting to login");
        router.push("/login");
        return;
      }

      setIsAuthorized(true);
    } catch (err) {
      console.error("Error parsing user:", err);
      router.push("/login");
    }
  }, [router]);

  // Fetch data only if authorized
  useEffect(() => {
    if (!isAuthorized) return;

    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const token = sessionStorage.getItem("token") || "";

        if (!token) {
          throw new Error("No authentication token found");
        }

        console.log("Fetching crew data with token:", token.substring(0, 20) + "...");

        const [staffRes, shiftsRes] = await Promise.all([
          fetch(`${API_BASE}/staff`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/shifts`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!staffRes.ok) throw new Error("Failed to fetch staff");
        if (!shiftsRes.ok) throw new Error("Failed to fetch shifts");

        const staffJson = await staffRes.json();
        const shiftsJson = await shiftsRes.json();

        console.log("Staff data:", staffJson);
        console.log("Shifts data:", shiftsJson);

        setStaff(staffJson.data || []);
        setShifts(shiftsJson.data || []);
      } catch (e: any) {
        console.error("Fetch crew data error:", e);
        setError(e?.message || "Failed to load staff or shifts.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isAuthorized]);

  if (!isAuthorized) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner}>Checking authorization...</div>
      </div>
    );
  }

  const shiftsByStaff: Record<number, Shift[]> = {};
  shifts.forEach((shift) => {
    if (!shiftsByStaff[shift.staff_id])
      shiftsByStaff[shift.staff_id] = [];
    shiftsByStaff[shift.staff_id].push(shift);
  });

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <div style={styles.headerBar}>
          <h1 style={styles.title}>👨‍✈️ Crew Directory</h1>
          <button
            style={styles.createBtn}
            onClick={() => router.push("/admin/staff/create")}
          >
            + Add Staff
          </button>
        </div>
        <p style={styles.info}>
          List of all crew/staff members and their upcoming shifts.
        </p>
        {loading ? (
          <div style={styles.loading}>Loading staff...</div>
        ) : error ? (
          <div style={styles.error}>{error}</div>
        ) : (
          <div style={styles.card}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Airport</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Shifts</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{ textAlign: "center", color: "#fca5a5" }}
                    >
                      No crew/staff found.
                    </td>
                  </tr>
                ) : (
                  staff.map((s) => (
                    <tr key={s.staff_id}>
                      <td style={{ fontWeight: 700 }}>
                        {s.first_name} {s.last_name}
                      </td>
                      <td>
                        <span style={styles.roleBadge}>{s.role}</span>
                      </td>
                      <td>{s.staff_type}</td>
                      <td>
                        <div style={{ fontSize: 14 }}>{s.airport_name}</div>
                        <div style={{ fontSize: 12, color: "#60a5fa" }}>
                          {s.airport_code}
                        </div>
                      </td>
                      <td>
                        <span
                          style={
                            s.status === "Active"
                              ? styles.activeStatus
                              : s.status === "On Leave"
                              ? styles.onLeaveStatus
                              : styles.inactiveStatus
                          }
                        >
                          {s.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          style={{
                            background: "#2563eb33",
                            color: "#60a5fa",
                            padding: "4px 10px",
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          {s.total_shifts || 0}
                        </span>
                      </td>
                      <td>
                        <button
                          style={styles.actionBtn}
                          onClick={() =>
                            router.push(`/admin/staff/${s.staff_id}/edit`)
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
          </div>
        )}
      </div>
    </div>
  );
}

function formatDateTime(dt: string) {
  if (!dt) return "—";
  const d = new Date(dt);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
    maxWidth: 1200,
    margin: "0 auto",
    padding: "40px 18px 65px 18px",
    minHeight: "100vh",
  },
  headerBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  title: {
    fontSize: 30,
    fontWeight: 800,
    color: "#60a5fa",
    margin: 0,
    letterSpacing: 0.5,
    background: "none",
  },
  createBtn: {
    padding: "8px 25px",
    background: "linear-gradient(90deg,#2563eb 75%, #0ea5e9)",
    border: "none",
    color: "#fff",
    borderRadius: 9,
    fontWeight: 700,
    fontSize: 17,
    boxShadow: "0 2px 8px #2563eb33",
    cursor: "pointer",
    transition: "background 0.12s",
  },
  info: {
    color: "#93c5fd",
    fontSize: 16.5,
    marginBottom: 13,
    fontStyle: "italic",
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
    border: "1.6px solid #f87171",
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
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 15,
    color: "#dde7fa",
    background: "none",
    minWidth: 900,
  },
  th: {
    textAlign: "left",
    color: "#9dc3fa",
    fontWeight: 700,
    padding: "14px 12px",
    borderBottom: "1.5px solid #2563eb32",
    background: "none",
  },
  roleBadge: {
    background: "#2563eb28",
    color: "#60a5fa",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 13,
    fontWeight: 600,
  },
  activeStatus: {
    background: "#22c55e33",
    color: "#22c55e",
    borderRadius: 6,
    padding: "4px 10px",
    fontWeight: 700,
    fontSize: 13,
  },
  onLeaveStatus: {
    background: "#f59e0b33",
    color: "#f59e0b",
    borderRadius: 6,
    padding: "4px 10px",
    fontWeight: 700,
    fontSize: 13,
  },
  inactiveStatus: {
    background: "#f87171cc",
    color: "#fff",
    borderRadius: 6,
    padding: "4px 10px",
    fontWeight: 700,
    fontSize: 13,
  },
  actionBtn: {
    background: "#2563eb",
    color: "#fff",
    borderRadius: 6,
    padding: "6px 16px",
    fontSize: 14,
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
    boxShadow: "0 2px 4px #2563eb16",
    transition: "background 0.12s",
  },
};