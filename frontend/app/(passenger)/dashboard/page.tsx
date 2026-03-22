"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

export default function PassengerDashboard() {
  const [user, setUser] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [flights, setFlights] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingFlights, setLoadingFlights] = useState(true);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    if (storedUser) setUser(JSON.parse(storedUser));
    else router.push("/login");
  }, [router]);

  useEffect(() => {
    if (user?.passenger_id) {
      setLoadingTickets(true);
      fetch(`${API_BASE}/tickets?passenger_id=${user.passenger_id}&status=upcoming`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
        .then(r => r.json())
        .then(r => setTickets(Array.isArray(r.data) ? r.data : []))
        .catch(() => setError("Failed to load tickets"))
        .finally(() => setLoadingTickets(false));
    }
  }, [user]);

  useEffect(() => {
    setLoadingFlights(true);
    fetch(`${API_BASE}/flights?upcoming=true`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then(r => r.json())
      .then(r => setFlights(Array.isArray(r.data) ? r.data : []))
      .catch(() => setError("Failed to load flights"))
      .finally(() => setLoadingFlights(false));
  }, []);

  if (!user) return null;

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.h1}>
              ✈️ Welcome,{" "}
              <span style={styles.accent}>
                {user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "Passenger"}
              </span>
              !
            </h1>
            <p style={styles.subtitle}>
              Manage your bookings, check tickets, and get ready to fly 🌏
            </p>
          </div>
          <button style={styles.cta} onClick={() => router.push("/flights/search")}>
            Book a Flight
          </button>
        </header>

        {/* MY TICKETS */}
        <section>
          <SectionHeading>My Upcoming Tickets</SectionHeading>
          {loadingTickets ? (
            <AestheticCard><div>Loading tickets...</div></AestheticCard>
          ) : error ? (
            <AestheticCard style={styles.error}>{error}</AestheticCard>
          ) : tickets.length === 0 ? (
            <AestheticCard>
              <div style={{ textAlign: "center" }}>You have no upcoming tickets.</div>
            </AestheticCard>
          ) : (
            <AestheticCard noPad>
              <div style={{ overflowX: "auto" }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>Flight</th>
                      <th>Date</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Seat</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((ticket, i) => (
                      <tr key={ticket.ticket_id || i}>
                        <td>{ticket.flight_number ?? "—"}</td>
                        <td>
                          {ticket.departure_time
                            ? new Date(ticket.departure_time).toLocaleString()
                            : "—"}
                        </td>
                        <td>{ticket.origin_airport ?? "—"}</td>
                        <td>{ticket.destination_airport ?? "—"}</td>
                        <td>{ticket.seat_number ?? "—"}</td>
                        <td>
                          <span style={badgeForStatus(ticket.status ?? "—")}>
                            {ticket.status ?? "—"}
                          </span>
                        </td>
                        <td>
                          <button
                            style={styles.smallBtn}
                            onClick={() => router.push(`/tickets/${ticket.ticket_id}`)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AestheticCard>
          )}
        </section>

        {/* UPCOMING FLIGHTS */}
        <section>
          <SectionHeading>Available Flights</SectionHeading>
          {loadingFlights ? (
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
                <table style={styles.tableLarge}>
                  <thead>
                    <tr>
                      <th>Airline</th>
                      <th>Flight No.</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Duration</th>
                      <th>Flight Type</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {flights.map((flight, idx) => (
                      <tr key={flight.flight_id || idx}>
                        <td style={{ fontWeight: 600 }}>
                          {flight.airline_name || "—"}{" "}
                          <span style={{
                            color: "#60a5fa",
                            fontWeight: 500,
                            fontSize: 13,
                            marginLeft: 5
                          }}>
                            ({flight.airline_code || "—"})
                          </span>
                        </td>
                        <td>{flight.flight_number ?? "—"}</td>
                        <td>
                          <span>{flight.source_airport_name || "—"}</span>
                          <div style={{ fontSize: 12, color: "#60a5fa" }}>
                            {flight.source_city}, {flight.source_country}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>
                            {flight.source_airport_code}
                          </div>
                        </td>
                        <td>
                          <span>{flight.destination_airport_name || "—"}</span>
                          <div style={{ fontSize: 12, color: "#60a5fa" }}>
                            {flight.destination_city}, {flight.destination_country}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>
                            {flight.destination_airport_code}
                          </div>
                        </td>
                        <td>{flight.estimated_duration ?? "—"}</td>
                        <td>
                          <span style={{
                            background: "#2563eb28",
                            color: "#2563eb",
                            borderRadius: 8,
                            padding: "2px 11px",
                            fontSize: 13.3,
                            fontWeight: 600,
                          }}>
                            {flight.flight_type ?? "—"}
                          </span>
                        </td>
                        <td>
                          <button
                            style={styles.smallBtn}
                            onClick={() => router.push(`/flights/${flight.flight_id}`)}
                          >
                            Book
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AestheticCard>
          )}
          <div style={{ marginTop: 18, textAlign: "center" }}>
            <button style={styles.cta} onClick={() => router.push("/flights/search")}>
              Search More Flights
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

// --- COMPONENTS ---
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 22,
        marginBottom: 10,
        marginTop: 34,
        letterSpacing: 0.2,
        fontWeight: 700,
        color: "#93c5fd",
        textShadow: "0 2px 16px #0ea5e925",
      }}
    >
      {children}
    </h2>
  );
}

// Accepts children & merges extra styles
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

function badgeForStatus(status: string) {
  let bg = "#fbbf24cc";
  let color = "#543c11";
  if (status?.toLowerCase() === "confirmed" || status?.toLowerCase() === "booked") {
    bg = "#22c55ecc";
    color = "#073c19";
  }
  if (status?.toLowerCase() === "cancelled") {
    bg = "#f87171cc";
    color = "#75030c";
  }
  if (status?.toLowerCase() === "pending") {
    bg = "#60a5facc";
    color = "#17315a";
  }
  return {
    background: bg,
    color,
    borderRadius: 9,
    padding: "2.5px 12px",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 0.3,
    marginRight: 8,
    textTransform: "capitalize" as const,
    border: "none",
    outline: "none",
  };
}

// --- STYLES ---
const styles: Record<string, React.CSSProperties> = {
  bg: {
    minHeight: "100vh",
    width: "100vw",
    background:
      "linear-gradient(140deg, #1e293b 70%, #2563eb 160%)",
    color: "#e6eefb",
    padding: 0,
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },
  shell: {
    maxWidth: 920,
    margin: "0 auto",
    padding: "32px 10px 50px 10px",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 40,
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
    padding: "8px 0 28px",
    borderBottom: "1.5px solid #1e293b55",
  },
  h1: {
    margin: 0,
    fontSize: 32,
    fontWeight: 800,
    color: "#93c5fd",
    letterSpacing: 0.6,
    textShadow: "0 2px 16px #1e293b33",
    lineHeight: 1.1,
  },
  accent: {
    color: "#2563eb",
    background: "linear-gradient(90deg,#1e40af22,#2563eb3d)",
    padding: "2px 10px",
    borderRadius: "9px",
    marginLeft: 2,
  },
  subtitle: {
    fontSize: 15,
    color: "#64748b",
    marginTop: 5,
    marginBottom: 0,
    textShadow: "0 2px 10px #0ea5e933",
    fontWeight: 500,
  },
  cta: {
    border: "none",
    padding: "13px 20px",
    background: "linear-gradient(80deg,#2563eb 70%,#60a5fa)",
    color: "#fff",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 17,
    cursor: "pointer",
    boxShadow: "0 2px 12px #2563eb44",
    marginLeft: 6,
    transition: "background 0.18s",
  },
  section: { marginBottom: 32 },
  table: {
    width: "100%",
    background: "none",
    borderRadius: 10,
    borderCollapse: "collapse",
    fontSize: 15.8,
    boxShadow: "none",
    color: "#dde7fa",
  },
  smallBtn: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    padding: "5.5px 15px",
    borderRadius: 8,
    fontSize: 13.5,
    cursor: "pointer",
    fontWeight: 600,
    margin: 0,
    boxShadow: "0 2px 6px #2563eb23",
    outline: "none",
  },
  error: {
    color: "#f26a6a",
    background: "#271e1e2b",
    border: "1px solid #b91c1ccc",
    fontWeight: 600,
  },
  flightGrid: {
    display: "flex",
    gap: 22,
    flexWrap: "wrap",
    marginTop: 8,
    justifyContent: "flex-start",
  },
  flightCard: {
    minWidth: 238,
    maxWidth: 330,
    flex: "1 1 240px",
  },
  flightHeader: {
    fontWeight: 700,
    fontSize: 18,
    color: "#93c5fd",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 10,
  },
  flightAirline: {
    fontSize: 14,
    color: "#38bdf8",
    fontWeight: 500,
    padding: "2px 7px",
    borderRadius: 7,
    background: "#2563eb22",
  },
  flightBtn: {
    marginTop: 11,
    padding: "7px 13px",
    background: "linear-gradient(90deg,#2563eb 80%, #0ea5e9)",
    color: "#fff",
    border: "none",
    borderRadius: 9,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 15.7,
    boxShadow: "0 2px 8px #2563eb33",
  },
  tableLarge: {              // <--- Ensure this is part of the styles object, comma after previous
    width: "100%",
    background: "none",
    borderRadius: 10,
    borderCollapse: "collapse",
    fontSize: 15.8,
    boxShadow: "none",
    color: "#dde7fa",
    marginBottom: 0,
    marginTop: 0,
    minWidth: 950,
  }
};

