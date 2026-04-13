"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getFlightById, deleteFlight, Flight } from "@/app/services/flight.service";

export default function FlightDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [flight, setFlight] = useState<Flight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchFlight() {
      setLoading(true);
      setError("");
      try {
        const id = params?.id as string;
        if (!id || isNaN(Number(id))) throw new Error("Invalid ID in URL");
        const token = localStorage.getItem("token") || "";
        const flightData = await getFlightById(id, token);
        setFlight(flightData);
      } catch (e: any) {
        setError(typeof e === "string" ? e : e?.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchFlight();
  }, [params?.id]);

  async function handleDelete() {
    if (!flight) return;
    if (!window.confirm("Are you sure you want to delete this flight? This action cannot be undone.")) return;
    try {
      const token = localStorage.getItem("token") || "";
      await deleteFlight(flight.flight_id, token);
      router.push("/admin/flights");
    } catch (e: any) {
      alert(e?.message || "Failed to delete flight.");
    }
  }

  function handleEdit() {
    if (!flight) return;
    router.push(`/admin/flights/${flight.flight_id}/edit`);
  }

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <h1 style={styles.title}>🛩️ Flight Details</h1>
        <button style={styles.backBtn} onClick={() => router.back()}>
          &larr; Back
        </button>
        {loading ? (
          <div style={styles.loading}>Loading...</div>
        ) : error ? (
          <div style={styles.error}>{error}</div>
        ) : !flight ? (
          <div style={styles.loading}>No data found.</div>
        ) : (
          <div style={styles.card}>
            <div style={styles.headerRow}>
              <div>
                <div style={styles.label}>Flight</div>
                <div style={styles.valueBig}>
                  {flight.airline_code}-{flight.flight_number}
                  <span style={styles.valueSmall}>
                    {" "}
                    ({flight.airline_name}){" "}
                    <span style={{ color: "#38bdf8", marginLeft: 7 }}>{flight.flight_type}</span>
                  </span>
                </div>
              </div>
              <div style={styles.actionBar}>
                <button style={styles.editBtn} onClick={handleEdit}>
                  Edit
                </button>
                <button style={styles.deleteBtn} onClick={handleDelete}>
                  Delete
                </button>
              </div>
            </div>
            <div style={styles.grid}>
              <div>
                <div style={styles.label}>From</div>
                <div style={styles.value}>
                  <span style={styles.airportCode}>{flight.source_airport_code}</span> —{" "}
                  {flight.source_airport_name}
                  <div style={styles.secondary}>
                    {flight.source_city}, {flight.source_country}
                  </div>
                  <div style={styles.secondary}>
                    TZ: {flight.source_timezone}
                  </div>
                </div>
              </div>
              <div>
                <div style={styles.label}>To</div>
                <div style={styles.value}>
                  <span style={styles.airportCode}>{flight.destination_airport_code}</span> —{" "}
                  {flight.destination_airport_name}
                  <div style={styles.secondary}>
                    {flight.destination_city}, {flight.destination_country}
                  </div>
                  <div style={styles.secondary}>
                    TZ: {flight.destination_timezone}
                  </div>
                </div>
              </div>
              <div>
                <div style={styles.label}>Airline Country</div>
                <div style={styles.value}>{flight.airline_country}</div>
              </div>
              <div>
                <div style={styles.label}>Estimated Duration</div>
                <div style={styles.value}>
                  {typeof flight.estimated_duration === "string"
                    ? flight.estimated_duration.slice(0, 5)
                    : flight.estimated_duration}
                </div>
              </div>
              <div>
                <div style={styles.label}>Created At</div>
                <div style={styles.value}>
                  {flight.created_at
                    ? new Date(flight.created_at).toLocaleString(undefined, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })
                    : "—"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @media (max-width: 800px) {
          .flight-grid {
            grid-template-columns: 1fr !important;
          }
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
    fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
    padding: 0,
  },
  shell: {
    maxWidth: 750,
    margin: "0 auto",
    padding: "45px 18px 55px 18px",
    minHeight: "100vh",
  },
  title: {
    fontSize: 29,
    fontWeight: 800,
    color: "#60a5fa",
    marginBottom: 18,
    letterSpacing: 0.5,
    background: "none",
  },
  backBtn: {
    background: "none",
    color: "#60a5fa",
    border: "1.5px solid #2563eb44",
    borderRadius: 7,
    fontWeight: 600,
    fontSize: 16.5,
    padding: "7px 26px",
    cursor: "pointer",
    marginBottom: 25,
  },
  card: {
    background: "linear-gradient(110deg,#111827 70%, #1d4ed822 100%)",
    borderRadius: 15,
    boxShadow: "0 8px 36px #1e293b40, 0 2px 8px #2563eb33",
    border: "1.3px solid #2563eb26",
    marginBottom: 21,
    padding: "27px 25px 23px 25px",
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
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 26,
    gap: 26,
    flexWrap: "wrap" as const,
  },
  actionBar: {
    display: "flex",
    gap: 12,
  },
  editBtn: {
    background: "linear-gradient(90deg,#2563eb 77%, #0ea5e9)",
    color: "#fff",
    border: "none",
    borderRadius: 9,
    fontWeight: 700,
    fontSize: 16,
    padding: "9px 24px",
    cursor: "pointer",
    boxShadow: "0 2px 8px #2563eb33",
  },
  deleteBtn: {
    background: "#f87171",
    color: "#fff",
    border: "none",
    borderRadius: 9,
    fontWeight: 700,
    fontSize: 16,
    padding: "9px 24px",
    cursor: "pointer",
    boxShadow: "0 2px 8px #f8717155",
  },
  label: {
    color: "#93c5fd",
    fontWeight: 500,
    fontSize: 15.5,
    marginBottom: 1,
  },
  valueBig: {
    color: "#e0e7ef",
    fontWeight: 800,
    fontSize: 26,
    marginBottom: 2,
  },
  valueSmall: {
    fontWeight: 600,
    fontSize: 17,
    color: "#60a5fa",
  },
  airportCode: {
    fontWeight: 800,
    fontSize: 17,
    color: "#60a5fa",
    marginRight: 6,
    letterSpacing: "0.03em",
  },
  value: {
    color: "#e0e7ef",
    fontWeight: 600,
    fontSize: 16.5,
  },
  secondary: {
    color: "#38bdf8",
    fontSize: 13.2,
    marginTop: 1,
    fontWeight: 500,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    columnGap: 35,
    rowGap: 17,
    marginTop: 9,
  },
};
