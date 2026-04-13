"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { API_BASE } from "@/app/config";

export default function AirportEditPage() {
  const params = useParams();
  const router = useRouter();

  const [airport_name, setAirportName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [airport_code, setAirportCode] = useState("");
  const [timezone, setTimezone] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    async function loadAirport() {
      setLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("token") || "";
        const res = await fetch(`${API_BASE}/airports/${params.id}`, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message);
        setAirportName(json.data.airport_name || "");
        setCity(json.data.city || "");
        setCountry(json.data.country || "");
        setAirportCode(json.data.airport_code || "");
        setTimezone(json.data.timezone || "");
      } catch (e: any) {
        setError(e?.message || "Failed to load airport.");
      } finally {
        setLoading(false);
      }
    }
    loadAirport();
    
  }, [params.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationErrors([]);
    setError("");
    const errs: string[] = [];
    if (!airport_name) errs.push("Airport name is required.");
    if (!city) errs.push("City is required.");
    if (!country) errs.push("Country is required.");
    if (!airport_code) errs.push("Airport code is required.");
    if (!timezone) errs.push("Timezone is required.");
    if (errs.length > 0) { setValidationErrors(errs); return; }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`${API_BASE}/airports/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ airport_name, city, country, airport_code, timezone }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        if (Array.isArray(json.errors)) setValidationErrors(json.errors.map(String));
        else setError(json.message || "Failed to update airport.");
        return;
      }
      router.push("/admin/airports");
    } catch (e: any) {
      setError(e?.message || "Failed to update airport.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <h1 style={styles.title}>🖋️ Edit Airport</h1>
        <div style={styles.card}>
          {error && <div style={styles.error}>{error}</div>}
          {validationErrors.length > 0 && (
            <div style={styles.errorList}>{validationErrors.map((e, i) => <div key={i}>• {e}</div>)}</div>
          )}
          {loading ? (
            <div style={styles.loading}>Loading airport...</div>
          ) : (
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.fieldsGrid}>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Airport Name</label>
                  <input style={styles.input} value={airport_name} onChange={e => setAirportName(e.target.value)} maxLength={128} required />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>City</label>
                  <input style={styles.input} value={city} onChange={e => setCity(e.target.value)} maxLength={64} required />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Country</label>
                  <input style={styles.input} value={country} onChange={e => setCountry(e.target.value)} maxLength={64} required />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Airport Code</label>
                  <input style={styles.input} value={airport_code} onChange={e => setAirportCode(e.target.value.toUpperCase())} maxLength={12} required />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Timezone</label>
                  <input style={styles.input} value={timezone} onChange={e => setTimezone(e.target.value)} maxLength={64} required placeholder="e.g. Asia/Karachi" />
                </div>
              </div>
              <div style={styles.actionBar}>
                <button type="submit" style={styles.submitBtn} disabled={submitting}>
                  {submitting ? "Updating..." : "Update Airport"}
                </button>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => router.push("/admin/airports")}
                  disabled={submitting}
                >Cancel</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bg: { minHeight: "100vh", width: "100vw", background: "linear-gradient(140deg, #1e293b 70%, #2563eb 110%)", color: "#e6eefb", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif", padding: 0 },
  shell: { maxWidth: 600, margin: "0 auto", padding: "45px 18px 55px 18px", minHeight: "100vh" },
  title: { fontSize: 27, fontWeight: 800, color: "#60a5fa", marginBottom: 26, letterSpacing: 0.5, background: "none" },
  card: { background: "linear-gradient(110deg,#111827 70%, #1d4ed822 100%)", borderRadius: 15, boxShadow: "0 8px 36px #1e293b40, 0 2px 8px #2563eb33", border: "1.3px solid #2563eb26", marginBottom: 21, padding: "29px 25px 24px 25px" },
  error: { background: "#3f1d1d", color: "#fecaca", fontWeight: 600, padding: "14px 24px", borderRadius: 8, border: "1.5px solid #f87171", margin: "16px 0 8px", fontSize: 16, textAlign: "center" },
  errorList: { background: "#3f1d1d", color: "#fecaca", fontWeight: 600, fontSize: 15.5, padding: "10px 18px", borderRadius: 10, border: "1.2px solid #f87171", margin: "13px 0 11px", lineHeight: 1.8 },
  loading: { color: "#93c5fd", fontSize: 18, padding: 23, textAlign: "center", fontWeight: 500 },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  fieldsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px 17px", marginBottom: 13 },
  labelGroup: { display: "flex", flexDirection: "column", gap: 7 },
  label: { color: "#93c5fd", fontWeight: 500, fontSize: 15.8, marginBottom: -2 },
  input: { background: "#1e293b", border: "1.2px solid #2563eb39", borderRadius: 7, color: "#e6eefb", fontSize: 16.5, padding: "9px 12px", outline: "none" },
  actionBar: { display: "flex", gap: 17, marginTop: 16 },
  submitBtn: { background: "linear-gradient(90deg,#2563eb 77%, #0ea5e9)", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, fontSize: 16.5, padding: "10px 33px", cursor: "pointer", boxShadow: "0 2px 8px #2563eb33" },
  cancelBtn: { background: "none", color: "#93c5fd", border: "1.3px solid #2563eb56", borderRadius: 8, fontWeight: 600, fontSize: 16.5, padding: "10px 32px", cursor: "pointer" },
};

