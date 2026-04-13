"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/app/config";

type Cargo = {
  cargo_id: number;
  flight_id: number;
  flight_number?: string;
  tracking_number: string;
  cargo_type: string;
  description?: string;
  weight_kg: number;
  origin_airport_id: number;
  origin_airport_name?: string;
  destination_airport_id: number;
  destination_airport_name?: string;
  sender_name: string;
  sender_contact: string;
  reciever_name: string;
  reciever_contact: string;
  status: string;
  is_insured: boolean;
};

export default function CargoListPage() {
  const router = useRouter();
  const [cargo, setCargo] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("token") || "";
        const res = await fetch(`${API_BASE}/cargo`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message);
        setCargo(json.data || []);
      } catch (e: any) {
        setError(e?.message || "Failed to load cargo records.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <div style={styles.headerBar}>
          <div style={styles.title}>All Cargo</div>
          <button style={styles.addBtn} onClick={() => router.push("/admin/cargo/create")}>+ Add Cargo</button>
        </div>
        <div style={styles.card}>
          {error && <div style={styles.error}>{error}</div>}
          {loading ? (
            <div style={styles.loading}>Loading cargo shipments...</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Tracking #</th>
                  <th style={styles.th}>Flight</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Weight (kg)</th>
                  <th style={styles.th}>Origin</th>
                  <th style={styles.th}>Destination</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Insured</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cargo.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", color: "#fca5a5", padding: 16 }}>
                      No cargo records found.
                    </td>
                  </tr>
                ) : (
                  cargo.map(c => (
                    <tr key={c.cargo_id}>
                      <td style={styles.td}>{c.tracking_number}</td>
                      <td style={styles.td}>{c.flight_number ? `${c.flight_number}` : c.flight_id}</td>
                      <td style={styles.td}>{c.cargo_type}</td>
                      <td style={styles.td}>{c.weight_kg}</td>
                      <td style={styles.td}>{c.origin_airport_name ?? c.origin_airport_id}</td>
                      <td style={styles.td}>{c.destination_airport_name ?? c.destination_airport_id}</td>
                      <td style={styles.td}>{c.status}</td>
                      <td style={styles.td}>{c.is_insured ? "Yes" : "No"}</td>
                      <td style={styles.td}>
                        <button style={styles.actionBtn} onClick={() => router.push(`/admin/cargo/${c.cargo_id}/edit`)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bg: { minHeight: "100vh", width: "100vw", background: "linear-gradient(140deg, #1e293b 70%, #2563eb 110%)", color: "#e6eefb", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif", padding: 0 },
  shell: { maxWidth: 1200, margin: "0 auto", padding: "45px 18px 55px 18px", minHeight: "100vh" },
  headerBar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 25 },
  title: { fontSize: 27, fontWeight: 800, color: "#60a5fa", marginBottom: 0, letterSpacing: 0.5, background: "none" },
  addBtn: { padding: "10px 23px", background: "linear-gradient(90deg,#2563eb 77%, #0ea5e9)", color: "#fff", borderRadius: 8, fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer", boxShadow: "0 2px 8px #2563eb33" },
  card: { background: "linear-gradient(110deg,#111827 70%, #1d4ed822 100%)", borderRadius: 15, boxShadow: "0 8px 36px #1e293b40, 0 2px 8px #2563eb33", border: "1.3px solid #2563eb26", marginBottom: 21, padding: "29px 25px 24px 25px" },
  error: { background: "#3f1d1d", color: "#fecaca", fontWeight: 600, padding: "14px 24px", borderRadius: 8, border: "1.5px solid #f87171", margin: "16px 0 8px", fontSize: 16, textAlign: "center" },
  loading: { color: "#93c5fd", fontSize: 18, padding: 23, textAlign: "center", fontWeight: 500 },
  table: { width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: 15.5 },
  th: { textAlign: "left", color: "#9dc3fa", fontWeight: 700, padding: "12px 7px", borderBottom: "1.5px solid #2563eb32" },
  td: { padding: "10px 7px", borderBottom: "1px solid #2563eb21" },
  actionBtn: { background: "#2563eb", color: "#fff", borderRadius: 8, padding: "7px 18px", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", marginRight: 8 },
};

