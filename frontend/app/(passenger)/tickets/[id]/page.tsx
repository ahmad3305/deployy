"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

import { API_BASE } from "@/app/config";

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
  source_airport_code: string;
  destination_airport_code: string;
  terminal_name: string;
  gate_number: string;
  status: string;
  ticket_price: number;
  airline_name: string;
  airline_code: string;
};

type Baggage = {
  Baggage_id: number;
  baggage_type: string;
  weight: number;
  status: string;
};

async function fetchJson(url: string, options?: RequestInit) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Non-JSON response from ${url}`);
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

export default function TicketDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState<TicketDetails | null>(null);
  const [baggage, setBaggage] = useState<Baggage[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

      useEffect(() => {
      async function init() {
        if (!ticketId) {
          setError("Missing ticket ID");
          setLoading(false);
          return;
        }

        try {
          setLoading(true);

          // Fetch ticket details - use the dynamic route endpoint
          console.log("Fetching ticket:", ticketId);
          const ticketResp = await fetchJson(
            `${API_BASE}/tickets/${ticketId}`,  // ✅ Changed to dynamic route
            {
              headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },  // ✅ Changed to sessionStorage
            }
          );

          const ticketData = ticketResp?.data;
          if (!ticketData) {
            throw new Error("Ticket not found");
          }

          // Map the response to the expected fields
          const mappedTicket: TicketDetails = {
            ticket_id: ticketData.ticket_id,
            passenger_first_name: ticketData.first_name,  // ✅ From Passengers table
            passenger_last_name: ticketData.last_name,    // ✅ From Passengers table
            passenger_email: ticketData.email,             // ✅ From Passengers table
            seat_number: ticketData.seat_number,
            seat_class: ticketData.seat_class,
            flight_number: ticketData.flight_number,
            departure_datetime: ticketData.departure_datetime,
            arrival_datetime: ticketData.arrival_datetime,
            source_airport: ticketData.source_airport_name,  // ✅ From Airport (source)
            destination_airport: ticketData.destination_airport_name,  // ✅ From Airport (dest)
            source_airport_code: ticketData.source_airport_code,
            destination_airport_code: ticketData.destination_airport_code,
            terminal_name: ticketData.terminal_name,  // ✅ From Gates table
            gate_number: ticketData.gate_number,      // ✅ From Gates table
            status: ticketData.status,
            ticket_price: ticketData.ticket_price,
            airline_name: ticketData.airline_name,
            airline_code: ticketData.airline_code,
          };

          setTicket(mappedTicket);
          console.log("Ticket data:", mappedTicket);

          // Fetch baggage for this ticket
          console.log("Fetching baggage for ticket:", ticketId);
          const baggageResp = await fetchJson(
            `${API_BASE}/baggage?ticket_id=${ticketId}`,
            {
              headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },  // ✅ Changed
            }
          );

          const baggageData: Baggage[] = Array.isArray(baggageResp?.data)
            ? baggageResp.data
            : [];

          setBaggage(baggageData);
          console.log("Baggage data:", baggageData);
        } catch (e: any) {
          console.error("Init error:", e);
          setError(e?.message || "Failed to load ticket details");
        } finally {
          setLoading(false);
        }
      }

      init();
    }, [ticketId]);

        const handleCancelTicket = async () => {
        const confirmed = window.confirm(
            `Are you sure you want to cancel this ticket?\n\nTicket ID: ${ticket?.ticket_id}\nThis action cannot be undone.`
        );

        if (!confirmed) return;

        try {
            setCancelling(true);
            setCancelError("");

            console.log("Cancelling ticket:", ticketId);

            const response = await fetchJson(
              `${API_BASE}/tickets/${ticketId}`,
              {
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${sessionStorage.getItem("token")}`,  // ✅ Changed
                },
              }
            );

            console.log("Cancel response:", response);

            // Show success message
            alert(
            `Ticket cancelled successfully!\n\nRefund will be processed within 5-7 business days.`
            );

            // Redirect back to dashboard
            setTimeout(() => {
            router.push("/dashboard");
            }, 500);
        } catch (e: any) {
            console.error("Cancel error:", e);
            setCancelError(e?.message || "Failed to cancel ticket");
            setCancelling(false);
        }
    };

  if (loading)
    return (
      <div style={styles.center}>
        <div style={styles.spinner}>Loading ticket details...</div>
      </div>
    );
  if (error)
    return (
      <div style={styles.center}>
        <div style={styles.errorBox}>{error}</div>
      </div>
    );

  const canCancel =
    ticket && 
    (ticket.status?.toLowerCase() === "confirmed" || 
     ticket.status?.toLowerCase() === "pending") &&
    new Date(ticket.departure_datetime) > new Date();

  return (
    <div style={styles.bg}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={() => router.back()}>
            ← Back
          </button>
          <h1 style={styles.title}>🎫 Ticket Details</h1>
          <div />
        </div>

        {ticket && (
          <>
            {/* Ticket Card */}
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Ticket Information</h2>
                  <div style={styles.ticketId}>ID: {ticket.ticket_id}</div>
                </div>
                <div
                  style={{
                    ...badgeForStatus(ticket.status),
                    fontSize: 16,
                    padding: "8px 16px",
                  }}
                >
                  {ticket.status}
                </div>
              </div>

              <div style={styles.grid}>
                <InfoBlock label="Ticket ID" value={String(ticket.ticket_id)} />
                <InfoBlock label="Seat Number" value={ticket.seat_number} />
                <InfoBlock label="Seat Class" value={ticket.seat_class} />
                <InfoBlock label="Price" value={`PKR ${ticket.ticket_price}`} />
              </div>
            </section>

            {/* Passenger Information */}
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Passenger Information</h2>
              <div style={styles.grid}>
                <InfoBlock
                  label="Name"
                  value={`${ticket.passenger_first_name} ${ticket.passenger_last_name}`}
                />
                <InfoBlock label="Email" value={ticket.passenger_email} />
              </div>
            </section>

            {/* Flight Information */}
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Flight Information</h2>
              <div style={styles.flightInfo}>
                <div style={styles.routeSection}>
                  <div style={styles.airport}>
                    <div style={styles.airportCode}>
                      {ticket.source_airport_code}
                    </div>
                    <div style={styles.airportName}>
                      {ticket.source_airport}
                    </div>
                    <div style={styles.time}>
                      {new Date(ticket.departure_datetime).toLocaleTimeString(
                        [],
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </div>
                  </div>

                  <div style={styles.flightPath}>
                    <div style={styles.flightNumber}>
                      {ticket.airline_code} {ticket.flight_number}
                    </div>
                    <div style={styles.airline}>{ticket.airline_name}</div>
                  </div>

                  <div style={styles.airport}>
                    <div style={styles.airportCode}>
                      {ticket.destination_airport_code}
                    </div>
                    <div style={styles.airportName}>
                      {ticket.destination_airport}
                    </div>
                    <div style={styles.time}>
                      {new Date(ticket.arrival_datetime).toLocaleTimeString(
                        [],
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div style={styles.grid}>
                <InfoBlock
                  label="Departure Date"
                  value={new Date(ticket.departure_datetime).toLocaleDateString()}
                />
                <InfoBlock
                  label="Departure Time"
                  value={new Date(ticket.departure_datetime).toLocaleTimeString()}
                />
                <InfoBlock
                  label="Arrival Date"
                  value={new Date(ticket.arrival_datetime).toLocaleDateString()}
                />
                <InfoBlock
                  label="Arrival Time"
                  value={new Date(ticket.arrival_datetime).toLocaleTimeString()}
                />
                <InfoBlock label="Terminal" value={ticket.terminal_name || "TBA"} />
                <InfoBlock label="Gate" value={ticket.gate_number || "TBA"} />
              </div>
            </section>

            {/* Baggage Information */}
            {baggage.length > 0 && (
              <section style={styles.card}>
                <h2 style={styles.sectionTitle}>Baggage</h2>
                <div style={styles.baggageTable}>
                  <div style={styles.baggageHeader}>
                    <div>Type</div>
                    <div>Weight</div>
                    <div>Status</div>
                  </div>
                  {baggage.map((item, idx) => (
                    <div key={item.Baggage_id || idx} style={styles.baggageRow}>
                      <div>{item.baggage_type}</div>
                      <div>{item.weight} kg</div>
                      <div>
                        <span
                          style={{
                            ...badgeForStatus(item.status),
                            fontSize: 12,
                          }}
                        >
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Important Notes */}
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>📋 Important Notes</h2>
              <ul style={styles.notesList}>
                <li>Please arrive at the airport 2 hours before departure</li>
                <li>Check-in closes 30 minutes before departure</li>
                <li>Bring valid identification and travel documents</li>
                <li>Your boarding pass will be available 24 hours before flight</li>
                <li>For changes or cancellations, contact our support team</li>
              </ul>
            </section>

            {/* Cancel Error */}
            {cancelError && (
              <section style={{ ...styles.card, background: "#7f1d1d", border: "1px solid #991b1b" }}>
                <div style={{ color: "#fca5a5", fontSize: 14 }}>
                  <strong>Error:</strong> {cancelError}
                </div>
              </section>
            )}

            {/* Actions */}
            <div style={styles.actions}>
              <button style={styles.secondaryBtn} onClick={() => router.back()}>
                Back
              </button>
              <button
                style={styles.primaryBtn}
                onClick={() => {
                  const printWindow = window.open();
                  if (printWindow) {
                    printWindow.document.write(generatePrintableTicket(ticket));
                    printWindow.print();
                  }
                }}
              >
                Print Ticket
              </button>
              {canCancel && (
                <button
                  style={{
                    ...styles.dangerBtn,
                    opacity: cancelling ? 0.6 : 1,
                    cursor: cancelling ? "not-allowed" : "pointer",
                  }}
                  onClick={handleCancelTicket}
                  disabled={cancelling}
                >
                  {cancelling ? "Cancelling..." : "Cancel & Refund"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoBlock}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
    </div>
  );
}

function badgeForStatus(status: string) {
  let bg = "#fbbf24cc";
  let color = "#543c11";
  if (
    status?.toLowerCase() === "confirmed" ||
    status?.toLowerCase() === "booked"
  ) {
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
    textTransform: "capitalize" as const,
    border: "none",
    outline: "none",
    display: "inline-block",
  };
}

function generatePrintableTicket(ticket: TicketDetails) {
  return `
    <html>
      <head>
        <title>Ticket ${ticket.ticket_id}</title>
        <style>
          body { font-family: Arial; background: #f5f5f5; padding: 20px; }
          .ticket { background: white; padding: 40px; border-radius: 10px; max-width: 800px; margin: 0 auto; }
          h1 { color: #2563eb; text-align: center; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
          .item { border-bottom: 1px solid #eee; padding: 10px 0; }
          .label { color: #666; font-size: 12px; }
          .value { color: #000; font-weight: bold; font-size: 16px; }
          .route { display: flex; justify-content: space-around; align-items: center; padding: 30px; background: #f0f0f0; border-radius: 10px; margin: 20px 0; }
          .airport { text-align: center; }
          .code { font-size: 24px; font-weight: bold; color: #2563eb; }
          .name { font-size: 12px; color: #666; }
          @media print { body { background: white; } }
        </style>
      </head>
      <body>
        <div class="ticket">
          <h1>✈️ Flight Ticket</h1>
          <div class="item">
            <div class="label">Ticket ID</div>
            <div class="value">${ticket.ticket_id}</div>
          </div>
          
          <div class="route">
            <div class="airport">
              <div class="code">${ticket.source_airport_code}</div>
              <div class="name">${ticket.source_airport}</div>
              <div class="name">${new Date(ticket.departure_datetime).toLocaleTimeString()}</div>
            </div>
            <div>✈️</div>
            <div class="airport">
              <div class="code">${ticket.destination_airport_code}</div>
              <div class="name">${ticket.destination_airport}</div>
              <div class="name">${new Date(ticket.arrival_datetime).toLocaleTimeString()}</div>
            </div>
          </div>

          <div class="grid">
            <div class="item">
              <div class="label">Flight</div>
              <div class="value">${ticket.airline_code} ${ticket.flight_number}</div>
            </div>
            <div class="item">
              <div class="label">Seat</div>
              <div class="value">${ticket.seat_number}</div>
            </div>
            <div class="item">
              <div class="label">Class</div>
              <div class="value">${ticket.seat_class}</div>
            </div>
            <div class="item">
              <div class="label">Price</div>
              <div class="value">PKR ${ticket.ticket_price}</div>
            </div>
            <div class="item">
              <div class="label">Passenger</div>
              <div class="value">${ticket.passenger_first_name} ${ticket.passenger_last_name}</div>
            </div>
            <div class="item">
              <div class="label">Terminal</div>
              <div class="value">${ticket.terminal_name || "TBA"}</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

const styles: Record<string, React.CSSProperties> = {
  bg: {
    minHeight: "100vh",
    background: "linear-gradient(140deg, #1e293b 70%, #2563eb 160%)",
    color: "#e6eefb",
    padding: "32px 10px",
  },
  container: {
    maxWidth: 900,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: "1.5px solid #1e293b55",
  },
  backBtn: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    color: "#93c5fd",
  },
  card: {
    background: "linear-gradient(110deg, #1e293b 70%, #2563eb18 100%)",
    borderRadius: 14,
    padding: 22,
    marginBottom: 18,
    border: "1.5px solid #2563eb26",
    boxShadow: "0 8px 36px #1e293b40",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: "#bfdbfe",
    marginBottom: 4,
  },
  ticketId: {
    fontSize: 12,
    color: "#64748b",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
  },
  infoBlock: {
    background: "#0b1220",
    border: "1px solid #1f2937",
    borderRadius: 10,
    padding: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 600,
    color: "#e2e8f0",
  },
  flightInfo: {
    marginBottom: 20,
  },
  routeSection: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#0b1220",
    border: "1px solid #1f2937",
    borderRadius: 10,
    padding: 20,
    gap: 16,
  },
  airport: {
    textAlign: "center" as const,
    flex: 1,
  },
  airportCode: {
    fontSize: 24,
    fontWeight: 700,
    color: "#60a5fa",
  },
  airportName: {
    fontSize: 14,
    color: "#cbd5e1",
    marginTop: 4,
  },
  time: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 8,
  },
  flightPath: {
    textAlign: "center" as const,
    flex: 1,
  },
  flightNumber: {
    fontSize: 18,
    fontWeight: 700,
    color: "#60a5fa",
  },
  airline: {
    fontSize: 13,
    color: "#cbd5e1",
    marginTop: 4,
  },
  baggageTable: {
    marginTop: 12,
  },
  baggageHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 16,
    padding: 12,
    background: "#0b1220",
    borderRadius: 8,
    fontWeight: 600,
    color: "#bfdbfe",
    marginBottom: 8,
  },
  baggageRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 16,
    padding: 12,
    background: "#0b1220",
    borderRadius: 8,
    marginBottom: 8,
    color: "#cbd5e1",
  },
  notesList: {
    margin: 0,
    paddingLeft: 20,
    color: "#cbd5e1",
    lineHeight: 1.8,
  },
  center: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(140deg, #1e293b 70%, #2563eb 160%)",
    color: "#e6eefb",
  },
  spinner: {
    fontSize: 18,
    color: "#93c5fd",
  },
  errorBox: {
    background: "#7f1d1d",
    color: "#fca5a5",
    padding: 20,
    borderRadius: 10,
    fontSize: 16,
    textAlign: "center" as const,
  },
  actions: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 28,
  },
  primaryBtn: {
    border: "none",
    background: "linear-gradient(90deg,#2563eb 80%,#0ea5e9)",
    color: "#fff",
    borderRadius: 10,
    padding: "12px 24px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 16,
  },
  secondaryBtn: {
    border: "1px solid #334155",
    background: "#0b1220",
    color: "#e2e8f0",
    borderRadius: 10,
    padding: "12px 24px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 16,
  },
  dangerBtn: {
    border: "none",
    background: "linear-gradient(90deg,#dc2626 80%,#ef4444)",
    color: "#fff",
    borderRadius: 10,
    padding: "12px 24px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 16,
  },
};