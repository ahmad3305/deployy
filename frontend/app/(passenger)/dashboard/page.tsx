"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

type Ticket = {
  ticket_id: number;
  flight_number: string;
  departure_datetime: string;
  source_airport: string;
  destination_airport: string;
  seat_number: string;
  status: string;
};

type Flight = {
  flight_schedule_id: number;
  airline_name: string;
  airline_code: string;
  flight_number: string;
  source_airport_name: string;
  source_city: string;
  source_country: string;
  source_airport_code: string;
  destination_airport_name: string;
  destination_city: string;
  destination_country: string;
  destination_airport_code: string;
  departure_datetime: string;
  created_at: string;
  estimated_duration: string;
  flight_type: string;
};

type RunwayBooking = {
  booking_id: number;
  runway_id: number;
  runway_code: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  booking_status: string;
  registration_number: string;
  model_name: string;
};

export default function PassengerDashboard() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [runwayBookings, setRunwayBookings] = useState<RunwayBooking[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [displayedFlights, setDisplayedFlights] = useState<Flight[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingRunways, setLoadingRunways] = useState(true);
  const [loadingFlights, setLoadingFlights] = useState(true);
  const [error, setError] = useState<string>("");
  const [displayedFlightsCount, setDisplayedFlightsCount] = useState(5);
  const router = useRouter();

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? sessionStorage.getItem("user") : null;
    console.log("Stored user:", storedUser); // Debug
    
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        console.log("User role:", parsed.role); // Debug
        
        // Check if user is a customer/passenger
        if (parsed.role !== "Customer") {
          console.log("Not a customer, redirecting to login");
          router.push("/login");
          return;
        }
        
        setUser(parsed);
      } catch (e) {
        console.error("Error parsing user:", e);
        router.push("/login");
      }
    } else {
      console.log("No user in sessionStorage");
      router.push("/login");
    }
    
    setIsLoading(false);
  }, [router]);

  // Fetch tickets
  useEffect(() => {
    if (user?.passenger_id) {
      setLoadingTickets(true);
      console.log("Fetching tickets for passenger:", user.passenger_id);

      fetch(`${API_BASE}/tickets?passenger_id=${user.passenger_id}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
      })
        .then((r) => {
          console.log("Tickets response status:", r.status);
          return r.json();
        })
        .then((r) => {
          console.log("Tickets response:", r);
          const allTickets: Ticket[] = Array.isArray(r.data) ? r.data : [];
          setTickets(allTickets);
        })
        .catch((err) => {
          console.error("Error fetching tickets:", err);
          setError("Failed to load tickets");
        })
        .finally(() => setLoadingTickets(false));
    }
  }, [user]);

   
    // Fetch runway bookings
  useEffect(() => {
    if (user?.user_id) {
      setLoadingRunways(true);
      console.log("Fetching runway bookings for user:", user.user_id);

      fetch(`${API_BASE}/runway-booking/private`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
      })
        .then((r) => {
          console.log("Runway bookings response status:", r.status);
          return r.json();
        })
        .then((r) => {
          console.log("Runway bookings response:", r);
          const allBookings: RunwayBooking[] = Array.isArray(r.data) ? r.data : [];
          console.log("All bookings received (count):", allBookings.length);

          // Filter for upcoming bookings
          const upcomingBookings = allBookings.filter((booking: RunwayBooking) => {
            const status = booking.booking_status?.toLowerCase();

            const isValidStatus =
              status === "reserved" || status === "approved";

            let bookingDateTime;
            try {
              if (booking.booking_date.includes('T')) {
                bookingDateTime = new Date(booking.booking_date);
              } else {
                bookingDateTime = new Date(`${booking.booking_date}T${booking.start_time}`);
              }
            } catch (e) {
              return false;
            }

            const isFuture = bookingDateTime > new Date();
            return isValidStatus && isFuture;
          });

          setRunwayBookings(upcomingBookings);
        })
        .catch((err) => {
          console.error("Error fetching runway bookings:", err);
        })
        .finally(() => setLoadingRunways(false));
    }
  }, [user]);

  // Fetch ALL flights
  useEffect(() => {
    setLoadingFlights(true);
    console.log("Fetching all flights");

    fetch(`${API_BASE}/flight-schedules`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
    })
      .then((r) => r.json())
      .then((r) => {
        console.log("Flights response:", r);
        const flightsData: Flight[] = Array.isArray(r.data) ? r.data : [];
        setFlights(flightsData);
        setDisplayedFlights(flightsData.slice(0, 5));
        setDisplayedFlightsCount(5);
      })
      .catch((err) => {
        console.error("Error fetching flights:", err);
        setError("Failed to load flights");
      })
      .finally(() => setLoadingFlights(false));
  }, []);

  const handleLoadMore = () => {
    const newCount = displayedFlightsCount + 10;
    setDisplayedFlightsCount(newCount);
    setDisplayedFlights(flights.slice(0, newCount));
  };

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div style={styles.bg}>
        <div style={{ textAlign: "center", paddingTop: 100, color: "#e6eefb" }}>
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        {/* Rest of your JSX remains the same */}
        <header style={styles.header}>
          <div>
            <h1 style={styles.h1}>
              ✈️ Welcome,{" "}
              <span style={styles.accent}>
                {user?.name?.split(" ")[0] ||
                  user?.email?.split("@")[0] ||
                  "Passenger"}
              </span>
              !
            </h1>
            <p style={styles.subtitle}>
              Manage your bookings, check tickets, and get ready to fly 🌏
            </p>
          </div>
          <div style={styles.buttonGroup}>
            <button
              style={styles.cta}
              onClick={() => router.push("/flight_booking")}
            >
              Book a Flight
            </button>
            <button
              style={styles.cta}
              onClick={() => router.push("/runway_booking/available_runway")}
            >
              Book a Runway
            </button>
            <button
              style={styles.cta}
              onClick={() => router.push("/cargo-shipment/create")}
            >
              Ship Cargo
            </button>
          </div>
        </header>

        {/* MY TICKETS */}
        <section>
          <SectionHeading>My Tickets ({tickets.length} total)</SectionHeading>
          {loadingTickets ? (
            <AestheticCard>
              <div>Loading tickets...</div>
            </AestheticCard>
          ) : error ? (
            <AestheticCard style={styles.error}>{error}</AestheticCard>
          ) : tickets.length === 0 ? (
            <AestheticCard>
              <div style={{ textAlign: "center" }}>
                You have no tickets.
              </div>
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
                    {tickets.map((ticket: Ticket, i: number) => (
                      <tr key={ticket.ticket_id || i}>
                        <td>{ticket.flight_number ?? "—"}</td>
                        <td>
                          {ticket.departure_datetime
                            ? new Date(
                                ticket.departure_datetime
                              ).toLocaleString()
                            : "—"}
                        </td>
                        <td>{ticket.source_airport ?? "—"}</td>
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
                            onClick={() =>
                              router.push(`/tickets/${ticket.ticket_id}`)
                            }
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

        {/* RUNWAY BOOKINGS */}
        <section>
          <SectionHeading>My Runway Bookings</SectionHeading>
          {loadingRunways ? (
            <AestheticCard>
              <div>Loading runway bookings...</div>
            </AestheticCard>
          ) : runwayBookings.length === 0 ? (
            <AestheticCard>
              <div style={{ textAlign: "center" }}>
                You have no upcoming runway bookings.
              </div>
            </AestheticCard>
          ) : (
            <AestheticCard noPad>
              <div style={{ overflowX: "auto" }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>Runway</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Aircraft</th>
                      <th>Registration</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {runwayBookings.map((booking: RunwayBooking, i: number) => (
                      <tr key={booking.booking_id || i}>
                        <td>{booking.runway_code ?? "—"}</td>
                        <td>
                          {booking.booking_date
                            ? new Date(booking.booking_date).toLocaleDateString()
                            : "—"}
                        </td>
                        <td>
                          {booking.start_time && booking.end_time
                            ? `${booking.start_time} - ${booking.end_time}`
                            : "—"}
                        </td>
                        <td>{booking.model_name ?? "—"}</td>
                        <td>{booking.registration_number ?? "—"}</td>
                        <td>
                          <span style={badgeForStatus(booking.booking_status ?? "—")}>
                            {booking.booking_status ?? "—"}
                          </span>
                        </td>
                        <td>
                          <button
                            style={styles.smallBtn}
                            onClick={() =>
                              router.push(`/runway_booking/${booking.booking_id}`)
                            }
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

        {/* ALL FLIGHTS */}
        <section>
          <SectionHeading>All Flights ({flights.length} total)</SectionHeading>
          {loadingFlights ? (
            <AestheticCard>
              <div>Loading flights...</div>
            </AestheticCard>
          ) : flights.length === 0 ? (
            <AestheticCard>
              <div style={{ textAlign: "center" }}>
                No flights found.
              </div>
            </AestheticCard>
          ) : (
            <>
              <AestheticCard noPad>
                <div style={{ overflowX: "auto" }}>
                  <table style={styles.tableLargeExpanded}>
                    <thead>
                      <tr>
                        <th>Airline</th>
                        <th>Flight No.</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Scheduled Date</th>
                        <th>Duration</th>
                        <th>Flight Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedFlights.map(
                        (flight: Flight, idx: number) => (
                          <tr key={flight.flight_schedule_id || idx}>
                            <td style={{ fontWeight: 600 }}>
                              {flight.airline_name || "—"}{" "}
                              <span
                                style={{
                                  color: "#60a5fa",
                                  fontWeight: 500,
                                  fontSize: 13,
                                  marginLeft: 5,
                                }}
                              >
                                ({flight.airline_code || "—"})
                              </span>
                            </td>
                            <td>{flight.flight_number ?? "—"}</td>
                            <td>
                              <span>
                                {flight.source_airport_name || "—"}
                              </span>
                              <div style={{ fontSize: 12, color: "#60a5fa" }}>
                                {flight.source_city}, {flight.source_country}
                              </div>
                              <div style={{ fontSize: 12, color: "#64748b" }}>
                                {flight.source_airport_code}
                              </div>
                            </td>
                            <td>
                              <span>
                                {flight.destination_airport_name || "—"}
                              </span>
                              <div style={{ fontSize: 12, color: "#60a5fa" }}>
                                {flight.destination_city},{" "}
                                {flight.destination_country}
                              </div>
                              <div style={{ fontSize: 12, color: "#64748b" }}>
                                {flight.destination_airport_code}
                              </div>
                            </td>
                            <td>
                              {(flight.departure_datetime
                                ? new Date(flight.departure_datetime)
                                : new Date(flight.created_at)
                              ).toLocaleString()}
                            </td>
                            <td>{flight.estimated_duration ?? "—"}</td>
                            <td>
                              <span
                                style={{
                                  background: "#2563eb28",
                                  color: "#2563eb",
                                  borderRadius: 8,
                                  padding: "2px 11px",
                                  fontSize: 13.3,
                                  fontWeight: 600,
                                }}
                              >
                                {flight.flight_type ?? "—"}
                              </span>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </AestheticCard>

              {displayedFlightsCount < flights.length && (
                <div style={{ marginTop: 18, textAlign: "center" }}>
                  <button style={styles.cta} onClick={handleLoadMore}>
                    Load More Flights ({displayedFlightsCount} of {flights.length})
                  </button>
                </div>
              )}
            </>
          )}
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
  if (status?.toLowerCase() === "confirmed" || status?.toLowerCase() === "booked" || status?.toLowerCase() === "approved") {
    bg = "#22c55ecc";
    color = "#073c19";
  }
  if (status?.toLowerCase() === "cancelled") {
    bg = "#f87171cc";
    color = "#75030c";
  }
  if (status?.toLowerCase() === "pending" || status?.toLowerCase() === "reserved" || status?.toLowerCase() === "checked-in") {
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

const styles: Record<string, React.CSSProperties> = {
  bg: {
    minHeight: "100vh",
    width: "100vw",
    background: "linear-gradient(140deg, #1e293b 70%, #2563eb 160%)",
    color: "#e6eefb",
    padding: 0,
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },

  shell: {
    maxWidth: 1200,
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
  
  buttonGroup: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
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
    transition: "background 0.18s",
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
  tableLargeExpanded: {
    width: "100%",
    background: "none",
    borderRadius: 16,
    borderCollapse: "separate",
    borderSpacing: "0 0.4rem",
    fontSize: 17,
    color: "#dde7fa",
    marginBottom: 0,
    marginTop: 0,
    minWidth: 1200,
  },
};