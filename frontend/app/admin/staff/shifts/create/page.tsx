"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/app/config";

type Staff = {
  staff_id: number;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
};

export default function CreateShiftPage() {
  const router = useRouter();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [form, setForm] = useState({
    staff_id: "",
    shift_date: "",
    shift_start: "",
    shift_end: "",
    availability_status: "Available",
  });
  const [error, setError] = useState("");
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check auth on mount
  useEffect(() => {
    const user = typeof window !== "undefined" ? sessionStorage.getItem("user") : null;
    console.log("Checking admin auth for create shift, user:", user);

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

  // Load staff only if authorized
  useEffect(() => {
    if (!isAuthorized) return;

    async function loadStaff() {
      try {
        setLoading(true);
        const token = sessionStorage.getItem("token") || "";

        if (!token) {
          throw new Error("No authentication token found");
        }

        console.log("Fetching active staff with token:", token.substring(0, 20) + "...");

        const res = await fetch(`${API_BASE}/staff?status=Active`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log("Staff response status:", res.status);

        const json = await res.json();
        console.log("Staff response:", json);

        if (!res.ok) throw new Error(json.message);
        setStaffList(Array.isArray(json.data) ? json.data : []);
      } catch (e: any) {
        console.error("Fetch staff error:", e);
        setError(e?.message || "Failed to load staff.");
      } finally {
        setLoading(false);
      }
    }

    loadStaff();
  }, [isAuthorized]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setApiErrors([]);
    setSubmitting(true);

    try {
      const token = sessionStorage.getItem("token") || "";

      if (!token) {
        throw new Error("No authentication token found");
      }

      console.log("Creating shift with token:", token.substring(0, 20) + "...");

      const res = await fetch(`${API_BASE}/shifts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          staff_id: form.staff_id ? Number(form.staff_id) : undefined,
        }),
      });

      console.log("Create shift response status:", res.status);

      const json = await res.json();
      console.log("Create shift response:", json);

      if (!res.ok) {
        if (json.errors && Array.isArray(json.errors)) setApiErrors(json.errors);
        throw new Error(json.message);
      }
      router.push("/admin/staff/shifts");
    } catch (e: any) {
      console.error("Create shift error:", e);
      setError(e?.message || "Failed to create shift");
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
        <h2 style={styles.title}>Add Shift</h2>
        <div style={styles.card}>
          {error && <div style={styles.error}>{error}</div>}
          {apiErrors.length > 0 && (
            <div style={styles.errorList}>
              {apiErrors.map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </div>
          )}
          {loading ? (
            <div style={styles.loading}>Loading staff...</div>
          ) : (
            <form style={styles.form} onSubmit={handleSubmit}>
              <div style={styles.fieldsGrid}>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Staff *</label>
                  <select
                    name="staff_id"
                    value={form.staff_id}
                    onChange={handleChange}
                    required
                    style={styles.input}
                  >
                    <option value="">-- Select Staff --</option>
                    {staffList.map((s) => (
                      <option key={s.staff_id} value={s.staff_id}>
                        {s.first_name} {s.last_name} ({s.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Date *</label>
                  <input
                    type="date"
                    name="shift_date"
                    style={styles.input}
                    value={form.shift_date}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Start *</label>
                  <input
                    type="time"
                    name="shift_start"
                    style={styles.input}
                    value={form.shift_start}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>End *</label>
                  <input
                    type="time"
                    name="shift_end"
                    style={styles.input}
                    value={form.shift_end}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Status *</label>
                  <select
                    name="availability_status"
                    value={form.availability_status}
                    style={styles.input}
                    onChange={handleChange}
                    required
                  >
                    <option value="Available">Available</option>
                    <option value="Assigned">Assigned</option>
                    <option value="Off">Off</option>
                  </select>
                </div>
              </div>
              <div style={styles.actionBar}>
                <button
                  type="submit"
                  style={styles.submitBtn}
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Add Shift"}
                </button>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  disabled={submitting}
                  onClick={() => router.push("/admin/staff/shifts")}
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
    maxWidth: 900,
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
    marginBottom: 9,
    alignItems: "center",
  },
  input: {
    background: "#1e293b",
    border: "1.2px solid #2563eb39",
    borderRadius: 7,
    color: "#e6eefb",
    fontSize: 16,
    padding: "7px 12px",
    outline: "none",
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
    padding: "14px 24px",
    borderRadius: 8,
    border: "1.5px solid #f87171",
    margin: "16px 0 8px",
    fontSize: 15,
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
    fontSize: 15.5,
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
  submitBtn: {
    padding: "10px 24px",
    background: "linear-gradient(90deg,#2563eb 77%, #0ea5e9)",
    color: "#fff",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 16,
    border: "none",
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
    cursor: "pointer",
  },
  fieldsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
    marginBottom: 20,
  },
  labelGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 15,
    fontWeight: 700,
    color: "#bfdbfe",
  },
  form: {
    background: "none",
  },
};