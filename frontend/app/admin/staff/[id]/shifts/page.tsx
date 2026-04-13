"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { API_BASE } from "@/app/config";

type Shift = {
  shift_id: number;
  staff_id: number;
  shift_date: string;
  shift_start: string;
  shift_end: string;
  availability_status: string;
  staff_first_name?: string;
  staff_last_name?: string;
  staff_role?: string;
  staff_type?: string;
};

export default function StaffShiftsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [staffName, setStaffName] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Check auth on mount
  useEffect(() => {
    const user =
      typeof window !== "undefined" ? sessionStorage.getItem("user") : null;
    console.log("Checking admin auth for staff shifts, user:", user);

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

  // Load shifts only if authorized
  useEffect(() => {
    if (!isAuthorized || !id) return;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const token = sessionStorage.getItem("token") || "";

        if (!token) {
          throw new Error("No authentication token found");
        }

        console.log("Fetching staff shifts with token:", token.substring(0, 20) + "...");
        console.log("Staff ID:", id);

        // Try the endpoint without query params first to test if it works
        const url = `${API_BASE}/shifts?staff_id=${id}`;
        console.log("Attempting to fetch from URL:", url);

        const res = await fetch(url, {
          method: "GET",
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        console.log("Response status:", res.status);
        console.log("Response headers:", {
          "content-type": res.headers.get("content-type"),
          "content-length": res.headers.get("content-length"),
        });

        // Get response as text first
        const text = await res.text();
        console.log("Raw response text:", text);
        console.log("Response text length:", text.length);

        if (!res.ok) {
          console.error(`API Error ${res.status}:`, text);
          throw new Error(
            `API Error ${res.status}${text ? ": " + text : ""}`
          );
        }

        if (!text) {
          throw new Error("Empty response from server");
        }

        const json = JSON.parse(text);
        console.log("Parsed JSON:", json);

        if (!json.success) {
          throw new Error(json.message || "Request was not successful");
        }

        setShifts(json.data || []);
        if (json.data?.length && json.data[0].staff_first_name) {
          setStaffName(
            `${json.data[0].staff_first_name} ${json.data[0].staff_last_name}`
          );
        }
      } catch (e: any) {
        console.error("Fetch staff shifts error:", e);
        setError(e?.message || "Failed to load shifts. Check console for details.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, isAuthorized]);

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
        <h2 style={styles.title}>
          📋 Shifts for {staffName ? `${staffName}` : `Staff #${id}`}
        </h2>
        <div style={styles.card}>
          {error && (
            <div style={styles.error}>
              <div style={{ marginBottom: 8 }}>❌ {error}</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                Check browser console (F12) for details
              </div>
            </div>
          )}
          {loading ? (
            <div style={styles.loading}>Loading shifts...</div>
          ) : shifts.length === 0 ? (
            <div style={{ ...styles.loading, color: "#fca5a5" }}>
              No shifts found for this staff member.
            </div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Start Time</th>
                  <th style={styles.th}>End Time</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift) => (
                  <tr key={shift.shift_id}>
                    <td style={styles.td}>
                      <b>{shift.shift_date}</b>
                    </td>
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
                          fontSize: 12,
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
                ))}
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
    maxWidth: 850,
    margin: "0 auto",
    padding: "45px 18px 55px 18px",
    minHeight: "100vh",
  },
  title: {
    fontSize: 27,
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
    padding: "29px 25px 24px 25px",
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
    textAlign: "left",
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
    fontSize: 15,
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