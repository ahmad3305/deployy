"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllAirports, deleteAirport, Airport } from "@/app/services/airport.service";

export default function AirportsPage() {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const router = useRouter();

  async function loadData() {
    setLoading(true); setError(""); setDeleteError("");
    try {
      const token = localStorage.getItem("token") || "";
      const list = await getAllAirports(token);
      setAirports(list);
    } catch (e: any) {
      setError(e?.message || "Failed to load airports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this airport? This cannot be undone.")) return;
    setDeletingId(id); setDeleteError("");
    try {
      const token = localStorage.getItem("token") || "";
      await deleteAirport(id, token);
      setAirports(a => a.filter(x => x.airport_id !== id));
    } catch (e: any) {
      setDeleteError(e?.message || "Failed to delete airport.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <div style={styles.headerBar}>
          <h1 style={styles.title}>🛬 Airports Management</h1>
          <button style={styles.createBtn} onClick={() => router.push("/admin/airports/create")}>+ Add Airport</button>
        </div>
        {error && <div style={styles.error}>{error}</div>}
        {deleteError && <div style={styles.error}>{deleteError}</div>}
        {loading ? (
          <div style={styles.loading}>Loading airports...</div>
        ) : (
          <div style={styles.card}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>City</th>
                  <th>Country</th>
                  <th>Timezone</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {airports.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "#fca5a5" }}>
                      No airports found.
                    </td>
                  </tr>
                ) : (
                  airports.map(ap => (
                    <tr key={ap.airport_id}>
                      <td style={{ fontWeight: 700 }}>{ap.airport_name}</td>
                      <td>{ap.airport_code}</td>
                      <td>{ap.city}</td>
                      <td>{ap.country}</td>
                      <td>{ap.timezone}</td>
                      <td>
                        <button
                          style={styles.editBtn}
                          onClick={() => router.push(`/admin/airports/${ap.airport_id}/edit`)}
                        >Edit</button>
                        <button
                          style={styles.deleteBtn}
                          disabled={deletingId === ap.airport_id}
                          onClick={() => handleDelete(ap.airport_id)}
                        >{deletingId === ap.airport_id ? "Deleting..." : "Delete"}</button>
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
  shell: { maxWidth: 1100, margin: "0 auto", padding: "40px 18px 65px 18px", minHeight: "100vh" },
  headerBar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 17 },
  title: { fontSize: 29, fontWeight: 800, color: "#60a5fa", margin: 0, letterSpacing: 0.5, background: "none" },
  createBtn: { padding: "8px 25px", background: "linear-gradient(90deg,#2563eb 75%, #0ea5e9)", border: "none", color: "#fff", borderRadius: 9, fontWeight: 700, fontSize: 17, boxShadow: "0 2px 8px #2563eb33", cursor: "pointer", transition: "background 0.12s" },
  error: { background: "#3f1d1d", color: "#fecaca", fontWeight: 600, padding: "14px 24px", borderRadius: 8, border: "1.6px solid #f87171", margin: "18px 0 13px", fontSize: 16, textAlign: "center" },
  loading: { color: "#93c5fd", fontSize: 19, padding: 24, textAlign: "center", fontWeight: 500 },
  card: { background: "linear-gradient(110deg, #111827 70%, #1d4ed822 100%)", borderRadius: 15, boxShadow: "0 8px 36px #1e293b40, 0 2px 8px #2563eb33", border: "1.3px solid #2563eb26", marginBottom: 18, overflowX: "auto" },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: "0 0.2rem", fontSize: 16.6, color: "#dde7fa", background: "none", minWidth: 800 },
  editBtn: { background: "#2563eb", color: "#fff", borderRadius: 8, padding: "7px 15px", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", marginRight: 7 },
  deleteBtn: { background: "#f87171", color: "#fff", borderRadius: 8, padding: "7px 15px", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" },
};
