"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllFlights, Flight } from "@/app/services/flight.service";

export default function FlightsAdminPage() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function loadFlights() {
      setLoading(true);
      try {
        const token = localStorage.getItem("token") || "";
        const data = await getAllFlights(token);
        setFlights(data);
      } catch (e: any) {
        setError(e?.message || "Failed to load flights.");
      } finally {
        setLoading(false);
      }
    }
    loadFlights();
  }, []);

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <div style={styles.headerBar}>
          <h1 style={styles.title}>🛫 Flights</h1>
          <button style={styles.createBtn} onClick={() => router.push("/admin/flights/create")}>
            + Create Flight
          </button>
        </div>
        {loading ? (
          <div style={styles.loading}>Loading flights...</div>
        ) : error ? (
          <div style={styles.error}>{error}</div>
        ) : (
          <div style={styles.card}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Airline</th>
                  <th>Flight No</th>
                  <th>Route</th>
                  <th>Type</th>
                  <th>Duration</th>
                  <th>From</th>
                  <th>To</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {flights.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "#fca5a5" }}>
                      No flights found.
                    </td>
                  </tr>
                ) : (
                  flights.map((f) => (
                    <tr
                      key={f.flight_id}
                      style={{ cursor: "pointer" }}
                      tabIndex={0}
                      onClick={() => router.push(`/admin/flights/${f.flight_id}`)}
                    >
                      <td>
                        <span style={{ fontWeight: 600 }}>{f.airline_name}</span>
                        <span style={{ color: "#60a5fa", fontSize: 13, marginLeft: 5 }}>({f.airline_code})</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{f.flight_number}</span>
                      </td>
                      <td>
                        <span>
                          {f.source_airport_code} <span style={{ color: "#93c5fd" }}>→</span> {f.destination_airport_code}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          background: "#2563eb28",
                          color: "#2563eb",
                          borderRadius: 8,
                          padding: "2px 11px",
                          fontSize: 13.3,
                          fontWeight: 600,
                        }}>
                          {f.flight_type}
                        </span>
                      </td>
                      <td>
                        {typeof f.estimated_duration === "string"
                          ? f.estimated_duration.slice(0, 5)
                          : f.estimated_duration}
                      </td>
                      <td>
                        <div style={{ color: "#e0e7ef" }}>{f.source_airport_name}</div>
                        <div style={{ color: "#60a5fa", fontSize: 13 }}>{f.source_city}, {f.source_country}</div>
                      </td>
                      <td>
                        <div style={{ color: "#e0e7ef" }}>{f.destination_airport_name}</div>
                        <div style={{ color: "#60a5fa", fontSize: 13 }}>{f.destination_city}, {f.destination_country}</div>
                      </td>
                      <td>
                        <span style={styles.viewBtn} onClick={e => {
                          e.stopPropagation();
                          router.push(`/admin/flights/${f.flight_id}`);
                        }}>
                          View
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <style>{`
        th, td {
          padding: 16px 17px;
          text-align: left;
        }
        th {
          border-bottom: 2px solid #2563eb33;
          font-size: 15.7px;
          font-weight: 700;
          color: #60a5fa;
          background: #1e293b44;
        }
        tr {
          background: #23304a77;
        }
        tr:not(:last-child) {
          border-bottom: 1px solid #2563eb22;
        }
        tr:focus {
          outline: 2px solid #2563ebcd;
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bg: {
    minHeight: "100vh",
    width: "100vw",
    background: "linear-gradient(140deg, #1e293b 70%, #2563eb 120%)",
    color: "#e6eefb",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    padding: 0,
  },
  shell: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "40px 18px 55px 18px",
    minHeight: "100vh",
  },
  headerBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  title: {
    fontSize: 30,
    fontWeight: 800,
    color: "#60a5fa",
    margin: 0,
    letterSpacing: 0.5,
    background: "none",
  },
  createBtn: {
    padding: "8px 25px",
    background: "linear-gradient(90deg,#2563eb 75%, #0ea5e9)",
    border: "none",
    color: "#fff",
    borderRadius: 9,
    fontWeight: 700,
    fontSize: 17,
    boxShadow: "0 2px 8px #2563eb33",
    cursor: "pointer",
    transition: "background 0.12s",
  },
  loading: {
    color: "#93c5fd",
    fontSize: 18,
    padding: 28,
    textAlign: "center",
    fontWeight: 500,
    marginTop: 22,
  },
  error: {
    background: "#3f1d1d",
    color: "#fecaca",
    fontWeight: 600,
    padding: "18px 28px",
    borderRadius: 10,
    border: "1.5px solid #f87171",
    margin: "30px 0 25px",
    fontSize: 17,
    textAlign: "center",
  },
  card: {
    background: "linear-gradient(110deg, #111827 70%, #1d4ed822 100%)",
    borderRadius: 15,
    boxShadow: "0 8px 36px #1e293b40, 0 2px 8px #2563eb33",
    border: "1.3px solid #2563eb26",
    marginBottom: 18,
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: "0 0.2rem",
    fontSize: 16.6,
    color: "#dde7fa",
    background: "none",
    minWidth: 1160,
  },
  viewBtn: {
    background: "#2563eb",
    color: "#fff",
    borderRadius: 10,
    padding: "7px 21px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    boxShadow: "0 2px 5px #1e293b21",
    transition: "background 0.12s",
    textAlign: "center",
    display: "inline-block"
  },
};
