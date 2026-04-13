"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  getAllAircraftTypes,
  AircraftType,
  Aircraft
} from "@/app/services/aircraft.service";
import { API_BASE } from "@/app/config";

type Airline = { airline_id: number; airline_name: string; airline_code: string };
type Airport = { airport_id: number; airport_name: string; airport_code: string; city: string };

export default function EditAircraftPage() {
  const router = useRouter();
  const params = useParams();

  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [registration_number, setRegistrationNumber] = useState("");
  const [airline_id, setAirlineId] = useState<number | "">("");
  const [aircraft_type_id, setAircraftTypeId] = useState<number | "">("");
  const [current_airport, setCurrentAirport] = useState<number | "">("");
  const [status, setStatus] = useState("Active");
  const [economy_seats, setEconomySeats] = useState<number | string>("");
  const [business_seats, setBusinessSeats] = useState<number | string>("");
  const [first_class_seats, setFirstClassSeats] = useState<number | string>("");
  const [max_speed_kmh, setMaxSpeedKmh] = useState<number | string>("");
  const [fuel_capacity_litres, setFuelCapacityLitres] = useState<number | string>("");
  const [manufactered_date, setManufacturedDate] = useState("");
  const [latest_maintenance, setLatestMaintenance] = useState("");
  const [next_maintenance_due, setNextMaintenanceDue] = useState("");
  const [aircraftTypes, setAircraftTypes] = useState<AircraftType[]>([]);
  const [airlines, setAirlines] = useState<Airline[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true); setError("");
      try {
        const token = localStorage.getItem("token") || "";
        const [types, als, aps, acft] = await Promise.all([
          getAllAircraftTypes(token),
          fetch(`${API_BASE}/airlines`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
          fetch(`${API_BASE}/airports`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
          fetch(`${API_BASE}/aircraft/${params.id}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
        ]);
        setAircraftTypes(types);
        setAirlines(Array.isArray(als.data) ? als.data : []);
        setAirports(Array.isArray(aps.data) ? aps.data : []);
        if (!acft.success) throw new Error(acft.message || "Failed to load aircraft");
        setAircraft(acft.data);
        setRegistrationNumber(acft.data.registration_number ?? "");
        setAirlineId(acft.data.airline_id ?? "");
        setAircraftTypeId(acft.data.aircraft_type_id ?? "");
        setCurrentAirport(acft.data.current_airport ?? "");
        setStatus(acft.data.status ?? "Active");
        setEconomySeats(acft.data.economy_seats ?? "");
        setBusinessSeats(acft.data.business_seats ?? "");
        setFirstClassSeats(acft.data.first_class_seats ?? "");
        setMaxSpeedKmh(acft.data.max_speed_kmh ?? "");
        setFuelCapacityLitres(acft.data.fuel_capacity_litres ?? "");
        setManufacturedDate(acft.data.manufactered_date ? acft.data.manufactered_date.slice(0,10) : "");
        setLatestMaintenance(acft.data.latest_maintenance ? acft.data.latest_maintenance.slice(0,10) : "");
        setNextMaintenanceDue(acft.data.next_maintenance_due ? acft.data.next_maintenance_due.slice(0,10) : "");
      } catch (e: any) {
        setError(e?.message || "Failed to load form data.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [params.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationErrors([]); setError("");
    if (!aircraft) return;

    const errs: string[] = [];
    if (!registration_number) errs.push("Registration number required");
    if (!airline_id) errs.push("Airline required");
    if (!aircraft_type_id) errs.push("Aircraft type required");
    if (!current_airport) errs.push("Current airport required");
    if (!economy_seats || Number(economy_seats) < 0) errs.push("Valid economy seat count required");
    if (!business_seats || Number(business_seats) < 0) errs.push("Valid business seat count required");
    if (!first_class_seats || Number(first_class_seats) < 0) errs.push("Valid first class seat count required");
    if (!max_speed_kmh || Number(max_speed_kmh) < 0) errs.push("Valid max speed required");
    if (!fuel_capacity_litres || Number(fuel_capacity_litres) < 0) errs.push("Valid fuel capacity required");
    if (!manufactered_date) errs.push("Manufactured date required");
    if (errs.length) { setValidationErrors(errs); return; }

    setSubmitting(true);

    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`${API_BASE}/aircraft/${aircraft.aircraft_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          registration_number,
          airline_id: Number(airline_id),
          aircraft_type_id: Number(aircraft_type_id),
          status,
          economy_seats: Number(economy_seats),
          business_seats: Number(business_seats),
          first_class_seats: Number(first_class_seats),
          max_speed_kmh: Number(max_speed_kmh),
          fuel_capacity_litres: Number(fuel_capacity_litres),
          manufactered_date,
          latest_maintenance: latest_maintenance || null,
          next_maintenance_due: next_maintenance_due || null,
          current_airport: Number(current_airport)
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        if (Array.isArray(json.errors)) setValidationErrors(json.errors);
        else setError(json.message || "Failed to update aircraft.");
        return;
      }
      router.push("/admin/aircraft");
    } catch (e: any) {
      setError(e?.message || "Failed to update aircraft.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <h1 style={styles.title}>✏️ Edit Aircraft</h1>
        <div style={styles.card}>
          {error && <div style={styles.error}>{error}</div>}
          {validationErrors.length > 0 && (
            <div style={styles.errorList}>{validationErrors.map((e, i) => <div key={i}>• {e}</div>)}</div>
          )}
          {loading || !aircraft ? (
            <div style={styles.loading}>Loading...</div>
          ) : (
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.fieldsGrid}>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Registration Number</label>
                  <input style={styles.input} value={registration_number} onChange={e => setRegistrationNumber(e.target.value)} required maxLength={64} />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Airline</label>
                  <select style={styles.select} value={airline_id} onChange={e => setAirlineId(Number(e.target.value))} required>
                    <option value="">Select airline...</option>
                    {airlines.map(a => (
                      <option key={a.airline_id} value={a.airline_id}>
                        {a.airline_name} ({a.airline_code})
                      </option>
                    ))}
                  </select>
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Aircraft Type</label>
                  <select style={styles.select} value={aircraft_type_id} onChange={e => setAircraftTypeId(Number(e.target.value))} required>
                    <option value="">Select type...</option>
                    {aircraftTypes.map(at => (
                      <option key={at.aircraft_type_id} value={at.aircraft_type_id}>
                        {at.model_name} / {at.manufacturer} ({at.seat_capacity} seats)
                      </option>
                    ))}
                  </select>
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Current Airport</label>
                  <select style={styles.select} value={current_airport} onChange={e => setCurrentAirport(Number(e.target.value))} required>
                    <option value="">Select...</option>
                    {airports.map(ap => (
                      <option key={ap.airport_id} value={ap.airport_id}>
                        {ap.airport_name} ({ap.airport_code}) {ap.city}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Status</label>
                  <select style={styles.select} value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Economy Seats</label>
                  <input style={styles.input} type="number" min={0} value={economy_seats} onChange={e => setEconomySeats(e.target.value)} required />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Business Seats</label>
                  <input style={styles.input} type="number" min={0} value={business_seats} onChange={e => setBusinessSeats(e.target.value)} required />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>First Class Seats</label>
                  <input style={styles.input} type="number" min={0} value={first_class_seats} onChange={e => setFirstClassSeats(e.target.value)} required />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Max Speed (km/h)</label>
                  <input style={styles.input} type="number" min={0} value={max_speed_kmh} onChange={e => setMaxSpeedKmh(e.target.value)} required />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Fuel Capacity (litres)</label>
                  <input style={styles.input} type="number" min={0} value={fuel_capacity_litres} onChange={e => setFuelCapacityLitres(e.target.value)} required />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Manufactured Date</label>
                  <input style={styles.input} type="date" value={manufactered_date} onChange={e => setManufacturedDate(e.target.value)} required />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Latest Maintenance</label>
                  <input style={styles.input} type="date" value={latest_maintenance} onChange={e => setLatestMaintenance(e.target.value)} />
                </div>
                <div style={styles.labelGroup}>
                  <label style={styles.label}>Next Maintenance Due</label>
                  <input style={styles.input} type="date" value={next_maintenance_due} onChange={e => setNextMaintenanceDue(e.target.value)} />
                </div>
              </div>
              <div style={styles.actionBar}>
                <button type="submit" style={styles.submitBtn} disabled={submitting || loading}>
                  {submitting ? "Updating..." : "Update Aircraft"}
                </button>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => router.push("/admin/aircraft")}
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
    maxWidth: 780,
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
    cursor: "pointer"
  },
};
