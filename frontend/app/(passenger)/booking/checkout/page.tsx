"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

type SeatClass = "Economy" | "Business" | "First";

type FlightSchedule = {
  flight_schedule_id: number;
  flight_id: number;
  aircraft_id: number;
  gate_id: number;
  departure_datetime: string;
  arrival_datetime: string;
  flight_status: string;
  created_at: string;
  flight_number: number;
  flight_type: string;
  estimated_duration: string;
  airline_name: string;
  airline_code: string;
  source_airport_name: string;
  source_airport_code: string;
  source_city: string;
  destination_airport_name: string;
  destination_airport_code: string;
  destination_city: string;
  gate_number: string;
  terminal_name: string;
  source_airport_id?: number;
  destination_airport_id?: number;
};

type BaggageItem = {
  id: string;
  baggage_type: "Carry-on" | "Checked" | "Personal Item";
  weight_kg: number;
};

type TicketData = {
  ticket_id: number;
  seat_number: string;
  seat_class: string;
  status: string;
};

type PriceRow = {
  price_id: number;
  source_airport_id: number;
  destination_airport_id: number;
  economy_price: string | number;
  business_price: string | number;
  first_class_price: string | number;
  source_airport_code?: string;
  dest_airport_code?: string;
};

const BAGGAGE_ALLOWANCE: Record<SeatClass, Record<string, { free_weight: number; price_per_kg: number }>> = {
  Economy: {
    "Carry-on": { free_weight: 7, price_per_kg: 0 },
    "Checked": { free_weight: 20, price_per_kg: 500 },
    "Personal Item": { free_weight: 5, price_per_kg: 0 },
  },
  Business: {
    "Carry-on": { free_weight: 10, price_per_kg: 0 },
    "Checked": { free_weight: 40, price_per_kg: 300 },
    "Personal Item": { free_weight: 8, price_per_kg: 0 },
  },
  First: {
    "Carry-on": { free_weight: 12, price_per_kg: 0 },
    "Checked": { free_weight: 60, price_per_kg: 200 },
    "Personal Item": { free_weight: 10, price_per_kg: 0 },
  },
};

async function fetchJson(url: string, options?: RequestInit) {
  try {
    const res = await fetch(url, options);

    console.log(`[FETCH] URL: ${url}`);
    console.log(`[FETCH] Status: ${res.status}`);
    console.log(`[FETCH] Content-Type: ${res.headers.get("content-type")}`);

    const text = await res.text();
    console.log(`[FETCH] Raw Response: ${text.substring(0, 500)}`);

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(
        `Non-JSON response from ${url}. Status: ${res.status}. Response: ${text.substring(0, 200)}`
      );
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

export default function PassengerCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const flightScheduleId = searchParams.get("flight_schedule_id");
  const seatClass = (searchParams.get("seat_class") as SeatClass) || "Economy";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [schedule, setSchedule] = useState<FlightSchedule | null>(null);
  const [ticketPrice, setTicketPrice] = useState(0);
  const [seatNumber, setSeatNumber] = useState("");
  const [baggage, setBaggage] = useState<BaggageItem[]>([]);
  const [availableSeats, setAvailableSeats] = useState<string[]>([]);
  const [bookedSeats, setBookedSeats] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<any>(null);
  const [prices, setPrices] = useState<PriceRow[]>([]);

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    if (storedUser) setUser(JSON.parse(storedUser));
  }, []);

  useEffect(() => {
    const bagData = sessionStorage.getItem("baggageData");
    if (bagData) {
      setBaggage(JSON.parse(bagData));
    }
  }, []);

  useEffect(() => {
    async function init() {
      if (!flightScheduleId) {
        setError("Missing flight_schedule_id in URL.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch ALL flight schedules
        console.log(`Fetching all flight schedules to find ID: ${flightScheduleId}`);
        const schedulesResp = await fetchJson(
          `${API_BASE}/flight-schedules`,
          {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          }
        );

        const allSchedules: FlightSchedule[] = Array.isArray(schedulesResp?.data)
          ? schedulesResp.data
          : [];

        const scheduleData = allSchedules.find(
          (s) => Number(s.flight_schedule_id) === Number(flightScheduleId)
        );

        if (!scheduleData) {
          throw new Error(`Flight schedule with ID ${flightScheduleId} not found.`);
        }

        console.log("Schedule found:", scheduleData);
        setSchedule(scheduleData);

        // Fetch prices - SAME WAY AS BOOKING PAGE
        console.log("Fetching prices");
        const pricesResp = await fetchJson(`${API_BASE}/price`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });

        const allPrices: PriceRow[] = Array.isArray(pricesResp?.data)
          ? pricesResp.data
          : [];
        
        console.log("All prices fetched:", allPrices);
        setPrices(allPrices);

        // Fetch booked tickets for this flight
        console.log("Step 3: Fetching tickets for flight schedule:", flightScheduleId);

        try {
          const ticketsResp = await fetchJson(
            `${API_BASE}/ticket?flight_schedule_id=${flightScheduleId}`,
            {
              headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            }
          );

          const allTickets: TicketData[] = Array.isArray(ticketsResp?.data)
            ? ticketsResp.data
            : [];

          console.log("All tickets for this flight:", allTickets);

          // Filter booked seats by seat class and status (exclude cancelled/moved)
          const bookedSeatsForClass = allTickets
            .filter(
              (t) =>
                t.seat_class === seatClass &&
                (t.status === "Pending" || t.status === "Confirmed" || t.status === "Boarded")
            )
            .map((t) => t.seat_number);

          console.log("Booked seats for", seatClass, ":", bookedSeatsForClass);
          setBookedSeats(new Set(bookedSeatsForClass));
        } catch (ticketErr: any) {
          console.warn("Could not fetch tickets, continuing without seat blocking:", ticketErr.message);
        }

        // Generate available seats
        const seats: string[] = [];
        const seatPrefix =
          seatClass === "Economy" ? "E" : seatClass === "Business" ? "B" : "F";

        for (let i = 1; i <= 50; i++) {
          seats.push(`${seatPrefix}${i}`);
        }

        setAvailableSeats(seats);
      } catch (e: any) {
        console.error("Init error:", e);
        setError(e?.message || "Failed to load checkout details.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [flightScheduleId, seatClass]);

  // Match price exactly like booking page
  const matchedPrice = useMemo(() => {
    if (!schedule || prices.length === 0) return null;

    if (schedule.source_airport_id && schedule.destination_airport_id) {
      return (
        prices.find(
          (p) =>
            Number(p.source_airport_id) === Number(schedule.source_airport_id) &&
            Number(p.destination_airport_id) === Number(schedule.destination_airport_id)
        ) || null
      );
    }

    return (
      prices.find(
        (p) =>
          p.source_airport_code === schedule.source_airport_code &&
          p.dest_airport_code === schedule.destination_airport_code
      ) || null
    );
  }, [schedule, prices]);

  // Get selected fare exactly like booking page
  const selectedFare = useMemo(() => {
    if (!matchedPrice) return null;
    if (seatClass === "Economy") return matchedPrice.economy_price;
    if (seatClass === "Business") return matchedPrice.business_price;
    return matchedPrice.first_class_price;
  }, [matchedPrice, seatClass]);

  const baggageCharges = useMemo(() => {
    let total = 0;
    baggage.forEach((item) => {
      const allowance = BAGGAGE_ALLOWANCE[seatClass][item.baggage_type];
      const excessWeight = Math.max(0, item.weight_kg - allowance.free_weight);
      total += excessWeight * allowance.price_per_kg;
    });
    return total;
  }, [baggage, seatClass]);

  const totalAmount = Number(selectedFare) + baggageCharges;

  const handleContinueToPayment = () => {
    if (!seatNumber) {
      alert("Please select a seat");
      return;
    }

    // Store order summary for payment page
    sessionStorage.setItem(
      "orderSummary",
      JSON.stringify({
        flight_schedule_id: flightScheduleId,
        seat_class: seatClass,
        seat_number: seatNumber,
        ticket_price: Number(selectedFare),
        baggage_charges: baggageCharges,
        total_amount: totalAmount,
        baggage_items: baggage,
      })
    );

    router.push(`/booking/payment?flight_schedule_id=${flightScheduleId}`);
  };

  if (loading) return <div style={styles.center}>Loading checkout details...</div>;
  if (error) return <div style={styles.centerError}>{error}</div>;
  if (!schedule) return <div style={styles.center}>No schedule found.</div>;

  return (
    <div style={styles.bg}>
      <div style={styles.container}>
        <h1 style={styles.title}>📋 Order Review & Seat Selection</h1>
        <p style={styles.subtitle}>Select your seat and review your booking details.</p>

        <div style={styles.gridLayout}>
          {/* Left Column - Flight & Seat Info */}
          <div>
            {/* Flight Summary */}
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Flight Details</h2>
              <div style={styles.flightSummary}>
                <div>
                  <div style={styles.routeLabel}>From</div>
                  <div style={styles.routeValue}>{schedule.source_airport_code}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    {schedule.source_airport_name}
                  </div>
                </div>
                <div style={{ textAlign: "center", color: "#60a5fa", fontSize: 24 }}>✈️</div>
                <div>
                  <div style={styles.routeLabel}>To</div>
                  <div style={styles.routeValue}>{schedule.destination_airport_code}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    {schedule.destination_airport_name}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 14, fontSize: 14, color: "#cbd5e1" }}>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: "#94a3b8" }}>Flight:</span> {schedule.flight_number}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: "#94a3b8" }}>Departure:</span>{" "}
                  {new Date(schedule.departure_datetime).toLocaleString()}
                </div>
                <div>
                  <span style={{ color: "#94a3b8" }}>Duration:</span> {schedule.estimated_duration}
                </div>
              </div>
            </section>

            {/* Seat Selection */}
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Select Your Seat</h2>
              <div style={styles.seatLegend}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <div style={{ ...styles.seatButton, width: 30, height: 30 }} />
                  <span>Available</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <div style={{ ...styles.seatButton, ...styles.seatButtonSelected, width: 30, height: 30 }} />
                  <span>Selected</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <div style={{ ...styles.seatButton, ...styles.seatButtonBooked, width: 30, height: 30 }} />
                  <span>Booked</span>
                </div>
              </div>
              <div style={styles.seatGrid}>
                {availableSeats.map((seat) => {
                  const isBooked = bookedSeats.has(seat);
                  const isSelected = seatNumber === seat;

                  return (
                    <button
                      key={seat}
                      disabled={isBooked}
                      style={{
                        ...styles.seatButton,
                        ...(isBooked ? styles.seatButtonBooked : {}),
                        ...(isSelected ? styles.seatButtonSelected : {}),
                      }}
                      onClick={() => !isBooked && setSeatNumber(seat)}
                      title={isBooked ? "Seat already booked" : ""}
                    >
                      {seat}
                    </button>
                  );
                })}
              </div>
              {seatNumber && (
                <div style={{ marginTop: 14, padding: 12, background: "#1e3a5f", borderRadius: 8 }}>
                  <span style={{ color: "#bfdbfe" }}>Selected Seat: </span>
                  <span style={{ color: "#60a5fa", fontWeight: 700 }}>{seatNumber}</span>
                </div>
              )}
            </section>

            {/* Baggage Summary */}
            {baggage.length > 0 && (
              <section style={styles.card}>
                <h2 style={styles.sectionTitle}>Baggage Items</h2>
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  {baggage.map((item, idx) => (
                    <div key={item.id} style={styles.baggageSummaryItem}>
                      <div>
                        <span style={{ color: "#cbd5e1" }}>Item {idx + 1}:</span>{" "}
                        <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
                          {item.baggage_type}
                        </span>
                      </div>
                      <div style={{ color: "#94a3b8", fontSize: 13 }}>
                        {item.weight_kg} kg
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right Column - Order Summary */}
          <div>
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Order Summary</h2>

              <div style={styles.summaryBreakdown}>
                <div style={styles.breakdownRow}>
                  <span>Ticket ({seatClass})</span>
                  <span style={{ color: "#60a5fa", fontWeight: 600 }}>PKR {selectedFare || "Loading..."}</span>
                </div>

                {baggage.length > 0 && (
                  <div style={styles.breakdownRow}>
                    <span>Baggage ({baggage.length} items)</span>
                    <span style={{ color: "#f97316", fontWeight: 600 }}>PKR {baggageCharges}</span>
                  </div>
                )}

                <div
                  style={{
                    ...styles.breakdownRow,
                    borderTop: "2px solid #334155",
                    paddingTop: 12,
                    marginTop: 12,
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 16 }}>Total Amount</span>
                  <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 20 }}>
                    PKR {totalAmount}
                  </span>
                </div>
              </div>

              <div style={styles.infoBox}>
                ℹ️ Proceed to payment to complete your booking. Your ticket will be confirmed once
                payment is successful.
              </div>
            </section>

            {/* Passenger Info */}
            {user && (
              <section style={styles.card}>
                <h2 style={styles.sectionTitle}>Passenger Info</h2>
                <div style={{ fontSize: 14, color: "#cbd5e1" }}>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ color: "#94a3b8" }}>Name:</span> {user.name || user.email}
                  </div>
                  <div>
                    <span style={{ color: "#94a3b8" }}>Email:</span> {user.email}
                  </div>
                </div>
              </section>
            )}

            {/* Actions */}
            <div style={styles.actions}>
              <button style={styles.secondaryBtn} onClick={() => router.back()}>
                Back
              </button>
              <button style={styles.primaryBtn} onClick={handleContinueToPayment}>
                Continue to Payment
              </button>
            </div>
          </div>
        </div>
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
  container: { maxWidth: 1200, margin: "0 auto" },
  title: { fontSize: 32, margin: 0, color: "#93c5fd", fontWeight: 800 },
  subtitle: { marginTop: 8, marginBottom: 24, color: "#94a3b8" },
  gridLayout: {
    display: "grid",
    gridTemplateColumns: "1fr 380px",
    gap: 20,
  },
  card: {
    background: "linear-gradient(110deg,#111827 70%,#1d4ed822 100%)",
    border: "1px solid #33415566",
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: 14,
    color: "#bfdbfe",
    fontSize: 18,
  },
  flightSummary: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    background: "#0b1220",
    border: "1px solid #1f2937",
    borderRadius: 10,
    padding: 12,
  },
  routeLabel: { fontSize: 12, color: "#94a3b8" },
  routeValue: { fontSize: 16, fontWeight: 700, color: "#93c5fd" },
  seatLegend: {
    display: "flex",
    gap: 16,
    marginBottom: 14,
    padding: 10,
    background: "#0b1220",
    borderRadius: 8,
  },
  seatGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(50px, 1fr))",
    gap: 8,
  },
  seatButton: {
    border: "1px solid #334155",
    background: "#0b1220",
    color: "#cbd5e1",
    padding: "8px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    transition: "all 0.2s",
  },
  seatButtonSelected: {
    background: "#2563eb",
    color: "#fff",
    borderColor: "#2563eb",
  },
  seatButtonBooked: {
    background: "#4b5563",
    color: "#94a3b8",
    borderColor: "#334155",
    cursor: "not-allowed",
    opacity: 0.6,
  },
  baggageSummaryItem: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    borderBottom: "1px solid #1f2937",
  },
  summaryBreakdown: {},
  breakdownRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 0",
    color: "#cbd5e1",
    fontSize: 14,
  },
  infoBox: {
    marginTop: 14,
    background: "#1e3a5f",
    border: "1px solid #1e40af",
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    color: "#bfdbfe",
  },
  actions: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  },
  primaryBtn: {
    border: "none",
    background: "linear-gradient(90deg,#2563eb 80%,#0ea5e9)",
    color: "#fff",
    borderRadius: 10,
    padding: "12px 18px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryBtn: {
    border: "1px solid #334155",
    background: "#0b1220",
    color: "#e2e8f0",
    borderRadius: 10,
    padding: "12px 18px",
    fontWeight: 600,
    cursor: "pointer",
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