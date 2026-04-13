"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/app/config";

type Airline = {
  airline_id: number;
  airline_name: string;
  airline_code: string;
};

type Airport = {
  airport_id: number;
  airport_name: string;
  airport_code: string;
  city: string;
  country: string;
};

const FLIGHT_TYPES = ["Passenger", "Cargo", "Private"];

export default function CreateFlightPage() {
  const router = useRouter();

  const [airlines, setAirlines] = useState<Airline[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]);

  const [airline_id, setAirline] = useState<number | "">("");
  const [flight_number, setFlightNumber] = useState<number | "">("");
  const [flight_type, setFlightType] = useState<string>("Passenger");
  const [source_airport_id, setSourceAirport] = useState<number | "">("");
  const [destination_airport_id, setDestinationAirport] = useState<number | "">("");
  const [estimated_duration, setEstimatedDuration] = useState<string>(""); // Format: "HH:MM"

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    async function fetchFormOptions() {
      setLoading(true);
      try {
        const token = localStorage.getItem("token") || "";
        const [alRes, apRes] = await Promise.all([
          fetch(`${API_BASE}/airlines`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/airports`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const [airlineJson, airportJson] = await Promise.all([alRes.json(), apRes.json()]);
        setAirlines(Array.isArray(airlineJson.data) ? airlineJson.data : []);
        setAirports(Array.isArray(airportJson.data) ? airportJson.data : []);
      } catch (e: any) {
        setError("Failed to load airlines or airports. " + (e?.message || ""));
      } finally {
        setLoading(false);
      }
    }
    fetchFormOptions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setValidationErrors([]);

    const errs: string[] = [];

    if (!airline_id) errs.push("Airline is required.");
    if (!flight_number || isNaN(Number(flight_number))) errs.push("Flight number is required.");
    if (!flight_type) errs.push("Flight type is required.");
    if (!source_airport_id) errs.push("Source airport is required.");
    if (!destination_airport_id) errs.push("Destination airport is required.");
    if (!estimated_duration || !/^\d{2}:\d{2}$/.test(estimated_duration)) errs.push("Estimated duration must be in HH:MM format.");
    if (source_airport_id && destination_airport_id && source_airport_id === destination_airport_id) errs.push("Source and destination airports must be different.");

    if (errs.length > 0) {
      setValidationErrors(errs);
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`${API_BASE}/flights`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          airline_id,
          flight_number,
          flight_type,
          source_airport_id,
          destination_airport_id,
          estimated_duration: estimated_duration + ":00",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        if (Array.isArray(json.errors)) setValidationErrors(json.errors);
        else setError(json.message || "Failed to create flight.");
        return;
      }
      router.push(`/admin/flights/${json.data.flight_id}`);
    } catch (e: any) {
      setError(e?.message || "Failed to create flight.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <h1 style={styles.title}>✈️ Create New Flight</h1>

        <div style={styles.card}>
          {loading ? (
            <div style={styles.loading}>Loading airlines/airports...</div>
          ) : (
            <form onSubmit={handleSubmit} style={styles.form}>
              {error && <div style={styles.error}>{error}</div>}
              {validationErrors.length > 0 && (
                <div style={styles.errorList}>
                  {validationErrors.map((e, i) => (
                    <div key={i}>• {e}</div>
                  ))}
                </div>
              )}
              <div style={styles.fieldsGrid}>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Airline</label>
                  <select
                    value={airline_id}
                    onChange={e => setAirline(Number(e.target.value))}
                    style={styles.select}
                    required
                  >
                    <option value="">Select...</option>
                    {airlines.map(al => (
                      <option key={al.airline_id} value={al.airline_id}>
                        {al.airline_name} ({al.airline_code})
                      </option>
                    ))}
                  </select>
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Flight Number</label>
                  <input
                    style={styles.input}
                    type="number"
                    min="1"
                    value={flight_number}
                    onChange={e => setFlightNumber(e.target.value === "" ? "" : Number(e.target.value))}
                    required
                  />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Flight Type</label>
                  <select
                    value={flight_type}
                    onChange={e => setFlightType(e.target.value)}
                    style={styles.select}
                    required
                  >
                    {FLIGHT_TYPES.map(ft => (
                      <option key={ft} value={ft}>{ft}</option>
                    ))}
                  </select>
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Estimated Duration (HH:MM)</label>
                  <input
                    style={styles.input}
                    type="text"
                    pattern="\d{2}:\d{2}"
                    placeholder="e.g. 02:05"
                    value={estimated_duration}
                    onChange={e => setEstimatedDuration(e.target.value)}
                    required
                  />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Source Airport</label>
                  <select
                    value={source_airport_id}
                    onChange={e => setSourceAirport(Number(e.target.value))}
                    style={styles.select}
                    required
                  >
                    <option value="">Select...</option>
                    {airports.map(a => (
                      <option key={a.airport_id} value={a.airport_id}>
                        {a.airport_name} ({a.airport_code}) - {a.city}, {a.country}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Destination Airport</label>
                  <select
                    value={destination_airport_id}
                    onChange={e => setDestinationAirport(Number(e.target.value))}
                    style={styles.select}
                    required
                  >
                    <option value="">Select...</option>
                    {airports.map(a => (
                      <option key={a.airport_id} value={a.airport_id}>
                        {a.airport_name} ({a.airport_code}) - {a.city}, {a.country}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={styles.actionBar}>
                <button
                  type="submit"
                  style={styles.submitBtn}
                  disabled={submitting || loading}
                >
                  {submitting ? "Creating..." : "Create Flight"}
                </button>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => router.push("/admin/flights")}
                  disabled={submitting}
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
  bg: {
    minHeight: "100vh",
    width: "100vw",
    background: "linear-gradient(140deg, #1e293b 70%, #2563eb 110%)",
    color: "#e6eefb",
    fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
    padding: 0,
  },
  shell: {
    maxWidth: 630,
    margin: "0 auto",
    padding: "45px 18px 55px 18px",
    minHeight: "100vh",
  },
  title: {
    fontSize: 29,
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
    padding: "33px 25px 19px 25px",
  },
  loading: {
    color: "#93c5fd",
    fontSize: 18,
    padding: 23,
    textAlign: "center",
    fontWeight: 500,
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
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  fieldsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "24px 20px",
    marginBottom: 7,
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
  select: {
    background: "#1e293b",
    border: "1.2px solid #2563eb39",
    borderRadius: 7,
    color: "#e6eefb",
    fontSize: 16.5,
    padding: "9px 12px",
    outline: "none",
    appearance: "none" as "none",
  },
  actionBar: {
    display: "flex",
    gap: 17,
    marginTop: 24,
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
    cursor: "pointer"
  },
};
