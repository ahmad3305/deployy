"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

export default function FlightBookingPage() {
  const [flights, setFlights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/flight-schedules`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then(r => r.json())
      .then(r => setFlights(Array.isArray(r.data) ? r.data : []))
      .catch(() => setError("Failed to load flights"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <h1 style={styles.title}>Book Upcoming Flights</h1>
        <p style={styles.info}>
          All flights listed below. To book, click the "Book" button for your desired flight.
        </p>
        {loading ? (
          <AestheticCard>
            <div>Loading flights...</div>
          </AestheticCard>
        ) : error ? (
          <AestheticCard style={styles.error}>{error}</AestheticCard>
        ) : flights.length === 0 ? (
          <AestheticCard>
            <div style={{ textAlign: "center" }}>No upcoming flights found.</div>
          </AestheticCard>
        ) : (
          <AestheticCard noPad>
            <div style={{ overflowX: "auto" }}>
              <table style={styles.tableCompact}>
                <thead>
                  <tr>
                    <th>Airline</th>
                    <th>Flight</th>
                    <th>Route</th>
                    <th>Departure</th>
                    <th>Duration</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {flights.map((flight, idx) => {
                    const status = flight.flight_status ?? "Scheduled";
                    const isBookable = status.toLowerCase() !== "cancelled" && status.toLowerCase() !== "completed";
                    return (
                      <tr key={flight.flight_schedule_id || idx}>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: "15px" }}>
                            {flight.airline_name || "—"}
                          </div>
                          <div style={{ fontSize: "12px", color: "#60a5fa" }}>
                            {flight.airline_code || "—"}
                          </div>
                        </td>
                        <td style={{ fontWeight: 600, fontSize: "15px" }}>
                          {flight.flight_number ?? "—"}
                        </td>
                        <td>
                          <div style={{ fontSize: "14px", fontWeight: 500 }}>
                            {flight.source_airport_code || "—"} → {flight.destination_airport_code || "—"}
                          </div>
                          <div style={{ fontSize: "12px", color: "#60a5fa", marginTop: "2px" }}>
                            {flight.source_city} to {flight.destination_city}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: "14px" }}>
                            {flight.departure_datetime
                              ? new Date(flight.departure_datetime).toLocaleDateString()
                              : "—"}
                          </div>
                          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                            {flight.departure_datetime
                              ? new Date(flight.departure_datetime).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })
                              : "—"}
                          </div>
                        </td>
                        <td style={{ fontSize: "14px" }}>
                          {flight.estimated_duration ?? "—"}
                        </td>
                        <td>
                          <span style={{
                            background: "#2563eb28",
                            color: "#2563eb",
                            borderRadius: 6,
                            padding: "4px 10px",
                            fontSize: 12,
                            fontWeight: 600,
                            display: "inline-block"
                          }}>
                            {flight.flight_type ?? "—"}
                          </span>
                        </td>
                        <td>
                          <span style={statusBadge(status)}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>
                        </td>
                        <td>
                          <button
                            style={isBookable ? styles.bookBtn : styles.bookBtnDisabled}
                            disabled={!isBookable}
                            onClick={() => {
                              if (isBookable) 
                                router.push(`/booking?flight_schedule_id=${flight.flight_schedule_id}`);
                            }}
                          >
                            Book
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </AestheticCard>
        )}
      </div>
      <style>
        {`
          table th, table td {
            padding: 14px 16px !important;
            text-align: left;
            vertical-align: middle;
          }
          table th {
            border-bottom: 2px solid #2563eb33;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.5px;
            color: #60a5fa;
            background: #1e293b44;
            white-space: nowrap;
          }
          table tr {
            background: #23304a77;
            border-radius: 10px;
            margin-bottom: 6px;
            box-shadow: 0 2px 8px #2563eb18;
          }
          table tr:not(:last-child) {
            border-bottom: 1px solid #2563eb22;
          }
          table td {
            font-size: 14px;
          }
        `}
      </style>
    </div>
  );
}

// --- COMPONENTS ---

function AestheticCard({
  children,
  style,
  noPad,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  noPad?: boolean;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(110deg, #1e293b 70%, #2563eb18 100%)",
        borderRadius: 14,
        padding: noPad ? 0 : 22,
        boxShadow: "0 8px 36px #1e293b40, 0 2px 8px #2563eb33",
        border: "1.5px solid #2563eb26",
        marginBottom: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function statusBadge(status: string) {
  status = status?.toLowerCase?.() || "";
  let bg = "#60a5facc";
  let color = "#17315a";
  if (status === "confirmed" || status === "scheduled") {
    bg = "#22c55ecc";
    color = "#073c19";
  }
  if (status === "cancelled") {
    bg = "#f87171cc";
    color = "#75030c";
  }
  if (status === "pending" || status === "delayed") {
    bg = "#fbbf24cc";
    color = "#543c11";
  }
  if (status === "completed") {
    bg = "#94a3b8cc";
    color = "#1e293b";
  }
  return {
    background: bg,
    color,
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 650,
    letterSpacing: 0.3,
    textTransform: "capitalize" as const,
    border: "none",
    outline: "none",
    boxShadow: "0 1px 4px #1117",
    display: "inline-block"
  };
}

// --- STYLES ---
const styles: Record<string, React.CSSProperties> = {
  bg: {
    minHeight: "100vh",
    width: "100vw",
    background: "linear-gradient(140deg, #1e293b 70%, #2563eb 120%)",
    color: "#e6eefb",
    padding: 0,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },
  shell: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "40px 12px 60px 12px",
    minHeight: "100vh",
  },
  title: {
    fontSize: 31,
    fontWeight: 800,
    color: "#60a5fa",
    marginBottom: 8,
    background: "none"
  },
  info: {
    color: "#60a5fa",
    fontSize: 16.5,
    marginBottom: 20,
    marginTop: 0,
    fontStyle: "italic",
    background: "none",
  },
  tableCompact: {
    width: "100%",
    background: "none",
    borderRadius: 12,
    borderCollapse: "separate",
    borderSpacing: "0 0.4rem",
    fontSize: 14,
    color: "#dde7fa",
    marginBottom: 0,
    marginTop: 0,
    boxShadow: "none"
  },
  bookBtn: {
    border: "none",
    background: "linear-gradient(90deg,#2563eb 80%, #0ea5e9)",
    color: "#fff",
    padding: "7px 16px",
    borderRadius: 7,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    boxShadow: "0 2px 8px #2563eb33",
    outline: "none",
    transition: "background 0.1s",
    whiteSpace: "nowrap"
  },
  bookBtnDisabled: {
    border: "none",
    background: "#64748b",
    color: "#a9adc7",
    padding: "7px 16px",
    borderRadius: 7,
    cursor: "not-allowed",
    fontWeight: 700,
    fontSize: 13,
    boxShadow: "0 2px 5px #1e293b21",
    opacity: 0.62,
    transition: "background 0.2s",
    whiteSpace: "nowrap"
  },
  error: {
    color: "#f26a6a",
    background: "#271e1e2b",
    border: "1px solid #b91c1ccc",
    fontWeight: 600,
  },
};