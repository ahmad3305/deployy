"use client";

import React, { useEffect, useState } from "react";
import { getAllAircraft, deleteAircraft, Aircraft } from "@/app/services/aircraft.service";
import { useRouter } from "next/navigation";

export default function AircraftPage() {
  const [aircraftList, setAircraftList] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const router = useRouter();

  async function loadData() {
    setLoading(true); setError(""); setDeleteError("");
    try {
      const token = localStorage.getItem("token") || "";
      const list = await getAllAircraft(token);
      setAircraftList(list);
    } catch (e: any) {
      setError(e?.message || "Failed to load aircraft");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this aircraft? This cannot be undone.")) return;
    setDeletingId(id); setDeleteError("");
    try {
      const token = localStorage.getItem("token") || "";
      await deleteAircraft(id, token);
      setAircraftList(a => a.filter(x => x.aircraft_id !== id));
    } catch (e: any) {
      setDeleteError(e?.message || "Failed to delete aircraft");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <div style={styles.headerBar}>
          <h1 style={styles.title}>🛩️ Aircraft Inventory</h1>
          <button style={styles.createBtn} onClick={() => router.push("/admin/aircraft/create")}>+ Add Aircraft</button>
        </div>
        {error && <div style={styles.error}>{error}</div>}
        {deleteError && <div style={styles.error}>{deleteError}</div>}
        {loading ? (
          <div style={styles.loading}>Loading aircraft...</div>
        ) : (
          <div style={styles.card}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Reg #</th>
                  <th>Status</th>
                  <th>Aircraft Type</th>
                  <th>Manufacturer</th>
                  <th>Airline</th>
                  <th>Current Airport</th>
                  <th>Seat Capacity</th>
                  <th>Seats: Eco/Bus/First</th>
                  <th>Speed</th>
                  <th>Fuel</th>
                  <th>Maintenance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {aircraftList.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: "center", color: "#fca5a5" }}>
                      No aircraft in inventory.
                    </td>
                  </tr>
                ) : (
                  aircraftList.map(a => (
                    <tr key={a.aircraft_id}>
                      <td style={{ fontWeight: 700 }}>{a.registration_number}</td>
                      <td>
                        <span
                          style={a.status === "Active"
                            ? styles.activeStatus
                            : styles.inactiveStatus}>
                          {a.status}
                        </span>
                      </td>
                      <td>
                        <span style={styles.modelBadge}>{a.model_name}</span>
                      </td>
                      <td>{a.manufacturer}</td>
                      <td>
                        <span style={styles.airlineBadge}>
                          {a.airline_name} <span style={{ color: "#60a5fa" }}>({a.airline_code})</span>
                        </span>
                      </td>
                      <td>
                        {a.current_airport_name ? (
                          <>
                            <span>{a.current_airport_name}</span>
                            <div style={{ fontSize: 12, color: "#60a5fa" }}>
                              {a.current_airport_code} {a.current_airport_city ? "• " + a.current_airport_city : ""}
                            </div>
                          </>
                        ) : "—"}
                      </td>
                      <td>
                        {a.type_seat_capacity ?? "--"}
                      </td>
                      <td>
                        {a.economy_seats}/{a.business_seats}/{a.first_class_seats}
                      </td>
                      <td>
                        {a.max_speed_kmh ? `${a.max_speed_kmh} km/h` : "—"}
                      </td>
                      <td>
                        {a.fuel_capacity_litres ? `${a.fuel_capacity_litres} L` : "—"}
                      </td>
                      <td>
                        {a.latest_maintenance ? (
                          <div style={{ fontSize: 12 }}>
                            Last: {new Date(a.latest_maintenance).toLocaleDateString()}
                            {a.next_maintenance_due && (
                              <><br />Next: {new Date(a.next_maintenance_due).toLocaleDateString()}</>
                            )}
                          </div>
                        ) : "—"}
                      </td>
                      <td>
                        <button
                          style={styles.editBtn}
                          onClick={() => router.push(`/admin/aircraft/${a.aircraft_id}/edit`)}
                        >Edit</button>
                        <button
                          style={styles.deleteBtn}
                          disabled={deletingId === a.aircraft_id}
                          onClick={() => handleDelete(a.aircraft_id)}
                        >{deletingId === a.aircraft_id ? "Deleting..." : "Delete"}</button>
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

const styles: Record<string, React.CSSProperties> = {
  bg: { minHeight: "100vh", width: "100vw", background: "linear-gradient(140deg, #1e293b 70%, #2563eb 110%)", color: "#e6eefb", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif", padding: 0 },
  shell: { maxWidth: 1330, margin: "0 auto", padding: "40px 18px 65px 18px", minHeight: "100vh" },
  headerBar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 17 },
  title: { fontSize: 29, fontWeight: 800, color: "#60a5fa", margin: 0, letterSpacing: 0.5, background: "none" },
  createBtn: { padding: "8px 25px", background: "linear-gradient(90deg,#2563eb 75%, #0ea5e9)", border: "none", color: "#fff", borderRadius: 9, fontWeight: 700, fontSize: 17, boxShadow: "0 2px 8px #2563eb33", cursor: "pointer", transition: "background 0.12s" },
  error: { background: "#3f1d1d", color: "#fecaca", fontWeight: 600, padding: "14px 24px", borderRadius: 8, border: "1.6px solid #f87171", margin: "18px 0 13px", fontSize: 16, textAlign: "center" },
  loading: { color: "#93c5fd", fontSize: 19, padding: 24, textAlign: "center", fontWeight: 500 },
  card: { background: "linear-gradient(110deg, #111827 70%, #1d4ed822 100%)", borderRadius: 15, boxShadow: "0 8px 36px #1e293b40, 0 2px 8px #2563eb33", border: "1.3px solid #2563eb26", marginBottom: 18, overflowX: "auto" },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: "0 0.2rem", fontSize: 15.6, color: "#dde7fa", background: "none", minWidth: 1250 },
  modelBadge: { background: "#2563eb28", color: "#2563eb", borderRadius: 8, padding: "2px 11px", fontSize: 13.3, fontWeight: 600 },
  airlineBadge: { background: "#1e40af16", color: "#2563eb", borderRadius: 8, padding: "2px 11px", fontSize: 13.3, fontWeight: 600, display: "inline-block" },
  activeStatus: { background: "#22c55e33", color: "#22c55e", borderRadius: 8, padding: "2px 11px", fontWeight: 700, fontSize: 13 },
  inactiveStatus: { background: "#f87171cc", color: "#fff", borderRadius: 8, padding: "2px 11px", fontWeight: 700, fontSize: 13 },
  editBtn: { background: "#2563eb", color: "#fff", borderRadius: 8, padding: "7px 15px", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", marginRight: 7 },
  deleteBtn: { background: "#f87171", color: "#fff", borderRadius: 8, padding: "7px 15px", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" },
};
