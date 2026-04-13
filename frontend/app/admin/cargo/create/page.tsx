"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/app/config";

type Airport = { airport_id: number; airport_name: string; airport_code: string };
type Flight = { flight_id: number; flight_number: string };

const CARGO_TYPES = [
  "General", "Perishable", "Hazardous", "Fragile", "Live Animals", "Mail"
];
const STATUS_ENUM = ["Booked", "Loaded", "In Transit", "Unloaded", "Customs Hold", "Delivered", "Cancelled"];

export default function CreateCargoPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    flight_id: "",
    tracking_number: "",
    cargo_type: "",
    description: "",
    weight_kg: "",
    origin_airport_id: "",
    destination_airport_id: "",
    sender_name: "",
    sender_contact: "",
    reciever_name: "",
    reciever_contact: "",
    is_insured: false,
  });
  const [airports, setAirports] = useState<Airport[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [error, setError] = useState("");
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const token = localStorage.getItem("token") || "";
        let [airRes, flightRes] = await Promise.all([
          fetch(`${API_BASE}/airports`),
          fetch(`${API_BASE}/flights`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const airJson = await airRes.json();
        const flightJson = await flightRes.json();
        if (!airRes.ok) throw new Error(airJson.message);
        if (!flightRes.ok) throw new Error(flightJson.message);
        setAirports(Array.isArray(airJson.data) ? airJson.data : []);
        setFlights(Array.isArray(flightJson.data) ? flightJson.data : []);
      } catch (e: any) {
        setError(e?.message || "Failed to load airports or flights.");
      }
    }
    loadData();
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type, checked } = e.target;
    setForm(f => ({
      ...f,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setApiErrors([]);
    setSubmitting(true);

    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`${API_BASE}/cargo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          flight_id: form.flight_id ? Number(form.flight_id) : undefined,
          weight_kg: form.weight_kg ? Number(form.weight_kg) : undefined,
          origin_airport_id: form.origin_airport_id ? Number(form.origin_airport_id) : undefined,
          destination_airport_id: form.destination_airport_id ? Number(form.destination_airport_id) : undefined,
        })
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.errors && Array.isArray(json.errors)) setApiErrors(json.errors);
        throw new Error(json.message);
      }
      router.push("/admin/cargo");
    } catch (e: any) {
      setError(e?.message || "Failed to create cargo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <h2 style={styles.title}>Add Cargo</h2>
        <div style={styles.card}>
          {error && <div style={styles.error}>{error}</div>}
          {apiErrors.length > 0 &&
            <div style={styles.errorList}>{apiErrors.map((err, i) => <div key={i}>{err}</div>)}</div>
          }
          <form style={styles.form} onSubmit={handleSubmit}>
            <div style={styles.fieldsGrid}>
              <div style={styles.labelGroup}>
                <label style={styles.label}>Flight *</label>
                <select
                  name="flight_id"
                  value={form.flight_id}
                  style={styles.input}
                  onChange={handleChange}
                  required
                >
                  <option value="">-- Select Flight --</option>
                  {flights.map(f => (
                    <option key={f.flight_id} value={f.flight_id}>
                      {f.flight_number}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.labelGroup}>
                <label style={styles.label}>Tracking # *</label>
                <input
                  name="tracking_number"
                  style={styles.input}
                  value={form.tracking_number}
                  onChange={handleChange}
                  required
                  maxLength={10}
                />
              </div>
              <div style={styles.labelGroup}>
                <label style={styles.label}>Cargo Type *</label>
                <select
                  name="cargo_type"
                  style={styles.input}
                  value={form.cargo_type}
                  onChange={handleChange}
                  required
                >
                  <option value="">-- Select Type --</option>
                  {CARGO_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div style={styles.labelGroup}>
                <label style={styles.label}>Weight (kg) *</label>
                <input
                  name="weight_kg"
                  style={styles.input}
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={form.weight_kg}
                  onChange={handleChange}
                  required
                />
              </div>
              <div style={styles.labelGroup}>
                <label style={styles.label}>Origin Airport *</label>
                <select
                  name="origin_airport_id"
                  style={styles.input}
                  value={form.origin_airport_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">-- Select Airport --</option>
                  {airports.map(a => (
                    <option key={a.airport_id} value={a.airport_id}>
                      {a.airport_name} ({a.airport_code})
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.labelGroup}>
                <label style={styles.label}>Destination Airport *</label>
                <select
                  name="destination_airport_id"
                  style={styles.input}
                  value={form.destination_airport_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">-- Select Airport --</option>
                  {airports.map(a => (
                    <option key={a.airport_id} value={a.airport_id}>
                      {a.airport_name} ({a.airport_code})
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.labelGroup}>
                <label style={styles.label}>Sender Name *</label>
                <input
                  name="sender_name"
                  style={styles.input}
                  value={form.sender_name}
                  onChange={handleChange}
                  required
                  maxLength={50}
                />
              </div>
              <div style={styles.labelGroup}>
                <label style={styles.label}>Sender Contact *</label>
                <input
                  name="sender_contact"
                  style={styles.input}
                  value={form.sender_contact}
                  onChange={handleChange}
                  required
                  maxLength={50}
                />
              </div>
              <div style={styles.labelGroup}>
                <label style={styles.label}>Receiver Name *</label>
                <input
                  name="reciever_name"
                  style={styles.input}
                  value={form.reciever_name}
                  onChange={handleChange}
                  required
                  maxLength={50}
                />
              </div>
              <div style={styles.labelGroup}>
                <label style={styles.label}>Receiver Contact *</label>
                <input
                  name="reciever_contact"
                  style={styles.input}
                  value={form.reciever_contact}
                  onChange={handleChange}
                  required
                  maxLength={50}
                />
              </div>
              <div style={{ ...styles.labelGroup, gridColumn: "1/3" }}>
                <label style={{ ...styles.label, marginRight: 12 }}>
                  <input
                    name="is_insured"
                    type="checkbox"
                    checked={!!form.is_insured}
                    onChange={handleChange}
                    style={{ marginRight: 12 }}
                  />
                  Insured?
                </label>
              </div>
              <div style={{ ...styles.labelGroup, gridColumn: "1/3" }}>
                <label style={styles.label}>Description</label>
                <input
                  name="description"
                  style={styles.input}
                  value={form.description}
                  onChange={handleChange}
                  maxLength={255}
                  placeholder="(optional)"
                />
              </div>
            </div>
            <div style={styles.actionBar}>
              <button type="submit" style={styles.submitBtn} disabled={submitting}>
                {submitting ? "Saving..." : "Add Cargo"}
              </button>
              <button type="button" style={styles.cancelBtn} disabled={submitting} onClick={() => router.push("/admin/cargo")}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bg: { minHeight: "100vh", width: "100vw", background: "linear-gradient(140deg, #1e293b 70%, #2563eb 110%)", color: "#e6eefb", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif", padding: 0 },
  shell: { maxWidth: 900, margin: "0 auto", padding: "45px 18px 55px 18px", minHeight: "100vh" },
  title: { fontSize: 27, fontWeight: 800, color: "#60a5fa", marginBottom: 26, letterSpacing: 0.5, background: "none" },
  card: { background: "linear-gradient(110deg,#111827 70%, #1d4ed822 100%)", borderRadius: 15, boxShadow: "0 8px 36px #1e293b40, 0 2px 8px #2563eb33", border: "1.3px solid #2563eb26", marginBottom: 21, padding: "29px 25px 24px 25px" },
  error: { background: "#3f1d1d", color: "#fecaca", fontWeight: 600, padding: "14px 24px", borderRadius: 8, border: "1.5px solid #f87171", margin: "16px 0 8px", fontSize: 16, textAlign: "center" },
  errorList: { background: "#3f1d1d", color: "#fecaca", fontWeight: 600, fontSize: 15.5, padding: "10px 18px", borderRadius: 10, border: "1.2px solid #f87171", margin: "13px 0 11px", lineHeight: 1.8 },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  fieldsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px 17px", marginBottom: 13 },
  labelGroup: { display: "flex", flexDirection: "column", gap: 7 },
  label: { color: "#93c5fd", fontWeight: 500, fontSize: 15.8, marginBottom: -2 },
  input: { background: "#1e293b", border: "1.2px solid #2563eb39", borderRadius: 7, color: "#e6eefb", fontSize: 16.5, padding: "9px 12px", outline: "none" },
  actionBar: { display: "flex", gap: 17, marginTop: 16 },
  submitBtn: { background: "linear-gradient(90deg,#2563eb 77%, #0ea5e9)", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, fontSize: 16.5, padding: "10px 33px", cursor: "pointer", boxShadow: "0 2px 8px #2563eb33" },
  cancelBtn: { background: "none", color: "#93c5fd", border: "1.3px solid #2563eb56", borderRadius: 8, fontWeight: 600, fontSize: 16.5, padding: "10px 32px", cursor: "pointer" },
};

