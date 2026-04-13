"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { API_BASE } from "@/app/config";

type Staff = {
  staff_id: number;
  first_name: string;
  last_name: string;
  role: string;
  staff_type: string;
  status: string;
  license_number?: string;
  airport_id: number;
  airport_name?: string;
  hire_date?: string;
};

type Airport = {
  airport_id: number;
  airport_name: string;
  airport_code: string;
};

export default function StaffEditPage() {
  const router = useRouter();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Staff>>({});
  const [airports, setAirports] = useState<Airport[]>([]);
  const [error, setError] = useState("");
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Check auth on mount
  useEffect(() => {
    const user =
      typeof window !== "undefined" ? sessionStorage.getItem("user") : null;
    console.log("Checking admin auth for edit staff, user:", user);

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

  // Load staff and airports only if authorized
  useEffect(() => {
    if (!isAuthorized || !id) return;

    async function load() {
      try {
        setLoading(true);
        setApiErrors([]);
        setError("");

        const token = sessionStorage.getItem("token") || "";

        if (!token) {
          throw new Error("No authentication token found");
        }

        console.log("Fetching staff with token:", token.substring(0, 20) + "...");

        const res = await fetch(`${API_BASE}/staff/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log("Staff response status:", res.status);

        const json = await res.json();
        console.log("Staff response:", json);

        if (!res.ok || !json.success)
          throw new Error(json.message || "Unable to fetch staff details");
        setForm(json.data);

        console.log("Fetching airports...");

        const aRes = await fetch(`${API_BASE}/airports`);
        const aJson = await aRes.json();

        console.log("Airports response status:", aRes.status);

        if (!aRes.ok)
          throw new Error(aJson.message || "Failed to fetch airports");
        setAirports(aJson.data as Airport[]);
      } catch (e: any) {
        console.error("Fetch staff/airports error:", e);
        setError(e?.message || "Failed to load data.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, isAuthorized]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setApiErrors([]);
    setError("");

    try {
      const token = sessionStorage.getItem("token") || "";

      if (!token) {
        throw new Error("No authentication token found");
      }

      console.log("Updating staff with token:", token.substring(0, 20) + "...");

      const res = await fetch(`${API_BASE}/staff/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      console.log("Update staff response status:", res.status);

      const json = await res.json();
      console.log("Update staff response:", json);

      if (!res.ok) {
        if (json.errors && Array.isArray(json.errors))
          setApiErrors(json.errors);
        throw new Error(json.message);
      }
      router.push("/admin/staff");
    } catch (e: any) {
      console.error("Update staff error:", e);
      setError(e?.message || "Failed to update staff.");
    } finally {
      setSaving(false);
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
        <h2 style={styles.title}>Edit Staff</h2>
        <div style={styles.card}>
          {error && <div style={styles.error}>{error}</div>}
          {apiErrors.length > 0 && (
            <div style={styles.errorList}>
              {apiErrors.map((err, n) => (
                <div key={n}>{err}</div>
              ))}
            </div>
          )}

          {loading ? (
            <div style={styles.loading}>Loading staff info...</div>
          ) : (
            <form style={styles.form} onSubmit={handleSave}>
              <div style={styles.fieldsGrid}>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Airport *</label>
                  <select
                    name="airport_id"
                    value={form.airport_id ?? ""}
                    onChange={handleChange}
                    required
                    style={styles.input}
                  >
                    <option value="">-- Select Airport --</option>
                    {airports.map((a) => (
                      <option key={a.airport_id} value={a.airport_id}>
                        {a.airport_name} ({a.airport_code})
                      </option>
                    ))}
                  </select>
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Role *</label>
                  <input
                    name="role"
                    style={styles.input}
                    value={form.role ?? ""}
                    onChange={handleChange}
                    required
                    autoComplete="off"
                  />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>First Name *</label>
                  <input
                    name="first_name"
                    style={styles.input}
                    value={form.first_name ?? ""}
                    onChange={handleChange}
                    required
                    autoComplete="off"
                  />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Last Name *</label>
                  <input
                    name="last_name"
                    style={styles.input}
                    value={form.last_name ?? ""}
                    onChange={handleChange}
                    required
                    autoComplete="off"
                  />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Staff Type *</label>
                  <input
                    name="staff_type"
                    style={styles.input}
                    value={form.staff_type ?? ""}
                    onChange={handleChange}
                    required
                    autoComplete="off"
                  />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Status *</label>
                  <select
                    name="status"
                    value={form.status ?? ""}
                    style={styles.input}
                    onChange={handleChange}
                    required
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>License Number</label>
                  <input
                    name="license_number"
                    style={styles.input}
                    value={form.license_number ?? ""}
                    onChange={handleChange}
                    autoComplete="off"
                  />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Hire Date</label>
                  <input
                    type="date"
                    name="hire_date"
                    style={styles.input}
                    value={form.hire_date ?? ""}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div style={styles.actionBar}>
                <button type="submit" style={styles.submitBtn} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => router.push("/admin/staff")}
                  disabled={saving}
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
    maxWidth: 600,
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
  loading: {
    color: "#93c5fd",
    fontSize: 18,
    padding: 23,
    textAlign: "center",
    fontWeight: 500,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  fieldsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "22px 17px",
    marginBottom: 13,
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
  actionBar: {
    display: "flex",
    gap: 17,
    marginTop: 16,
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
    cursor: "pointer",
  },
};