"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

type TicketDetails = {
  ticket_id: number;
  passenger_first_name: string;
  passenger_last_name: string;
  passenger_email: string;
  seat_number: string;
  seat_class: string;
  flight_number: string;
  departure_datetime: string;
  arrival_datetime: string;
  source_airport: string;
  destination_airport: string;
  status: string;
};

async function fetchJson(url: string, options?: RequestInit) {
  try {
    console.log(`[FETCH] URL: ${url}`);
    const res = await fetch(url, options);
    const text = await res.text();

    console.log(`[FETCH] Status: ${res.status}`);
    console.log(`[FETCH] Response (first 500 chars): ${text.substring(0, 500)}`);

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Non-JSON response from ${url}. Status: ${res.status}`);
    }

    if (!res.ok || json?.success === false) {
      throw new Error(json?.message || `Request failed (${res.status})`);
    }

    return json;
  } catch (err) {
    console.error(`[FETCH ERROR] ${url}:`, err);
    throw err;
  }
}

export default function BookingSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get("ticket_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState<TicketDetails | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    if (storedUser) {
      console.log("User from localStorage:", storedUser);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    async function init() {
      if (!ticketId) {
        setError("Missing ticket_id in URL.");
        setLoading(false);
        return;
      }

      if (!user) {
        console.log("Waiting for user data...");
        return;
      }

      try {
        setLoading(true);

        console.log("Fetching tickets for passenger:", user.passenger_id);

        // Fetch ticket details - Changed to /tickets (plural)
        const ticketsResp = await fetchJson(
          `${API_BASE}/tickets?passenger_id=${user.passenger_id}`,
          {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          }
        );

        console.log("Tickets response:", ticketsResp);

        const allTickets: TicketDetails[] = Array.isArray(ticketsResp?.data)
          ? ticketsResp.data
          : [];

        console.log("All tickets:", allTickets);

        const ticketData = allTickets.find(
          (t) => Number(t.ticket_id) === Number(ticketId)
        );

        console.log("Matched ticket:", ticketData);

        if (!ticketData) {
          throw new Error("Ticket not found.");
        }

        setTicket(ticketData);
      } catch (e: any) {
        console.error("Init error:", e);
        setError(e?.message || "Failed to load ticket details.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [ticketId, user]);

  if (loading) return <div style={styles.center}>Loading ticket details...</div>;
  if (error) return <div style={styles.centerError}>{error}</div>;

  return (
    <div style={styles.bg}>
      <div style={styles.container}>
        {/* Success Icon */}
        <div style={styles.successIcon}>✈️</div>

        <h1 style={styles.title}>Booking Confirmed! 🎉</h1>
        <p style={styles.subtitle}>Your flight ticket has been successfully booked.</p>

        {ticket && (
          <>
            {/* Ticket Card */}
            <section style={styles.ticketCard}>
              <div style={styles.ticketHeader}>
                <div>
                  <div style={styles.ticketLabel}>Ticket ID</div>
                  <div style={styles.ticketValue}>{ticket.ticket_id}</div>
                </div>
                <div style={{ textAlign: "right" as const }}>
                  <div style={styles.ticketLabel}>Status</div>
                  <div
                    style={{
                      ...styles.ticketValue,
                      color: "#22c55e",
                      background: "#1a3a1a",
                      padding: "6px 12px",
                      borderRadius: 6,
                      display: "inline-block",
                    }}
                  >
                    {ticket.status}
                  </div>
                </div>
              </div>

              <div style={styles.ticketDivider} />

              {/* Flight Info */}
              <div style={styles.flightSection}>
                <div style={styles.routeContainer}>
                  <div style={styles.airport}>
                    <div style={styles.airportCode}>{ticket.source_airport}</div>
                    <div style={styles.airportTime}>
                      {new Date(ticket.departure_datetime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <div style={styles.flightPath}>
                    <div style={styles.flightNumber}>✈️ {ticket.flight_number}</div>
                  </div>
                  <div style={styles.airport}>
                    <div style={styles.airportCode}>{ticket.destination_airport}</div>
                    <div style={styles.airportTime}>
                      {new Date(ticket.arrival_datetime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div style={styles.ticketDivider} />

              {/* Seat & Class */}
              <div style={styles.detailsGrid}>
                <div>
                  <div style={styles.detailLabel}>Seat Number</div>
                  <div style={styles.detailValue}>{ticket.seat_number}</div>
                </div>
                <div>
                  <div style={styles.detailLabel}>Seat Class</div>
                  <div style={styles.detailValue}>{ticket.seat_class}</div>
                </div>
                <div>
                  <div style={styles.detailLabel}>Passenger</div>
                  <div style={styles.detailValue}>
                    {ticket.passenger_first_name} {ticket.passenger_last_name}
                  </div>
                </div>
                <div>
                  <div style={styles.detailLabel}>Email</div>
                  <div style={styles.detailValue}>{ticket.passenger_email}</div>
                </div>
              </div>
            </section>

            {/* Important Info */}
            <section style={styles.infoCard}>
              <h2 style={styles.infoTitle}>📋 Important Information</h2>
              <ul style={styles.infoList}>
                <li>Check-in 2 hours before departure</li>
                <li>A confirmation email has been sent to {ticket.passenger_email}</li>
                <li>Your baggage allowance is included in your booking</li>
                <li>Download or print your boarding pass before arrival</li>
              </ul>
            </section>

            {/* Next Steps */}
            <section style={styles.infoCard}>
              <h2 style={styles.infoTitle}>🎯 Next Steps</h2>
              <ol style={styles.infoList}>
                <li>Save your ticket ID: <strong>{ticket.ticket_id}</strong></li>
                <li>Check your email for boarding pass and receipt</li>
                <li>Review baggage and extra charges</li>
                <li>Arrive at airport at least 2 hours early</li>
              </ol>
            </section>

            {/* Actions */}
            <div style={styles.actions}>
              <button
                style={styles.primaryBtn}
                onClick={() => router.push("/dashboard")}
              >
                Return to Dashboard
              </button>
              <button
                style={styles.secondaryBtn}
                onClick={() => router.push("/flight_booking")}
              >
                Book Another Flight
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bg: {
    minHeight: "100vh",
    background: "linear-gradient(135deg,#0f172a,#1e293b)",
    color: "#e2e8f0",
    padding: "28px 12px 48px",
  },
  container: { maxWidth: 900, margin: "0 auto" },
  successIcon: {
    fontSize: 80,
    textAlign: "center" as const,
    marginBottom: 20,
  },
  title: {
    fontSize: 40,
    margin: 0,
    color: "#22c55e",
    fontWeight: 800,
    textAlign: "center" as const,
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 32,
    color: "#94a3b8",
    textAlign: "center" as const,
    fontSize: 18,
  },
  ticketCard: {
    background: "linear-gradient(110deg,#111827 70%,#1d4ed822 100%)",
    border: "2px solid #22c55e",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  ticketHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  ticketLabel: { fontSize: 12, color: "#94a3b8", marginBottom: 4 },
  ticketValue: { fontSize: 18, fontWeight: 700, color: "#93c5fd" },
  ticketDivider: {
    height: 1,
    background: "#334155",
    margin: "16px 0",
  },
  flightSection: { marginBottom: 16 },
  routeContainer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  airport: {
    textAlign: "center" as const,
  },
  airportCode: {
    fontSize: 24,
    fontWeight: 700,
    color: "#60a5fa",
  },
  airportTime: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 8,
  },
  flightPath: {
    flex: 1,
    textAlign: "center" as const,
  },
  flightNumber: {
    fontSize: 16,
    fontWeight: 700,
    color: "#e2e8f0",
  },
  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 16,
  },
  detailLabel: { fontSize: 12, color: "#94a3b8", marginBottom: 4 },
  detailValue: { fontSize: 15, fontWeight: 600, color: "#e2e8f0" },
  infoCard: {
    background: "#1e3a5f",
    border: "1px solid #1e40af",
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
  },
  infoTitle: {
    marginTop: 0,
    marginBottom: 12,
    color: "#bfdbfe",
    fontSize: 18,
  },
  infoList: {
    margin: 0,
    paddingLeft: 20,
    color: "#cbd5e1",
    lineHeight: 1.8,
  },
  actions: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    marginTop: 28,
  },
  primaryBtn: {
    border: "none",
    background: "linear-gradient(90deg,#2563eb 80%,#0ea5e9)",
    color: "#fff",
    borderRadius: 10,
    padding: "14px 28px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 16,
  },
  secondaryBtn: {
    border: "1px solid #334155",
    background: "#0b1220",
    color: "#e2e8f0",
    borderRadius: 10,
    padding: "14px 28px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 16,
  },
  center: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#0f172a",
    color: "#e2e8f0",
  },
  centerError: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#0f172a",
    color: "#fca5a5",
    padding: 20,
    textAlign: "center" as const,
  },
};