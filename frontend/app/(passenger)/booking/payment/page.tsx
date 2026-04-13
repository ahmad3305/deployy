"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { API_BASE } from "@/app/config";

type OrderSummary = {
  flight_schedule_id: string;
  seat_class: string;
  seat_number: string;
  ticket_price: number;
  baggage_charges: number;
  total_amount: number;
  baggage_items: any[];
};

async function fetchJson(url: string, options?: RequestInit) {
  try {
    console.log(`[FETCH] URL: ${url}`);
    console.log(`[FETCH] Method: ${options?.method || "GET"}`);
    console.log(`[FETCH] Body:`, options?.body);

    const res = await fetch(url, options);

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

export default function PassengerPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const flightScheduleId = searchParams.get("flight_schedule_id");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"Credit Card" | "Cash" | "Online Transfer">(
    "Credit Card"
  );
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    if (storedUser) setUser(JSON.parse(storedUser));
  }, []);

  useEffect(() => {
    const orderData = sessionStorage.getItem("orderSummary");
    if (orderData) {
      setOrderSummary(JSON.parse(orderData));
    }
  }, []);

  const handleCreateTicket = async () => {
    if (!orderSummary || !user) {
      setError("Missing order or user information");
      return;
    }

    try {
      setLoading(true);
      setError("");

      console.log("User data:", user);
      console.log("Order summary:", orderSummary);

      // Step 1: Create Ticket
      console.log("Creating ticket...");
      const ticketPayload = {
        passenger_id: user.passenger_id,
        flight_schedule_id: Number(orderSummary.flight_schedule_id),
        seat_number: orderSummary.seat_number,
        seat_class: orderSummary.seat_class,
        ticket_price: orderSummary.total_amount, // Include baggage charges in ticket price
      };

      console.log("Ticket payload:", ticketPayload);

      const ticketResp = await fetchJson(`${API_BASE}/tickets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(ticketPayload),
      });

      console.log("Ticket response:", ticketResp);

      const newTicketId = ticketResp.data.ticket_id;
      console.log("New ticket ID:", newTicketId);

      setError(""); // Clear error on success

      // Store ticket ID for next step
      sessionStorage.setItem("ticketId", String(newTicketId));

      // Step 2: Proceed to checkout
      await handleCheckout(newTicketId);
    } catch (e: any) {
      console.error("Ticket creation error:", e);
      setError(e?.message || "Failed to create ticket");
      setLoading(false);
    }
  };

  const handleCheckout = async (tktId: number) => {
    try {
      console.log("Processing checkout for ticket:", tktId);

      const checkoutPayload = {
        ticket_id: tktId,
        payment_method: paymentMethod,
      };

      console.log("Checkout payload:", checkoutPayload);

      // Call checkout endpoint
      const checkoutResp = await fetchJson(`${API_BASE}/payments/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(checkoutPayload),
      });

      console.log("Checkout response:", checkoutResp);

      // Success - redirect to success page
      sessionStorage.removeItem("baggageData");
      sessionStorage.removeItem("orderSummary");

      router.push(`/booking/success?ticket_id=${tktId}`);
    } catch (e: any) {
      console.error("Checkout error:", e);
      setError(e?.message || "Payment processing failed");
      setLoading(false);
    }
  };

  if (!orderSummary) {
    return <div style={styles.center}>Loading payment details...</div>;
  }

  return (
    <div style={styles.bg}>
      <div style={styles.container}>
        <h1 style={styles.title}>💳 Payment Method</h1>
        <p style={styles.subtitle}>Select your preferred payment method and complete the booking.</p>

        <div style={styles.gridLayout}>
          {/* Left Column - Payment Options */}
          <div>
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Select Payment Method</h2>

              <div style={styles.paymentOptions}>
                {/* Credit Card */}
                <label style={styles.paymentOption}>
                  <input
                    type="radio"
                    name="payment_method"
                    value="Credit Card"
                    checked={paymentMethod === "Credit Card"}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    style={{ marginRight: 12 }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, color: "#e2e8f0" }}>💳 Credit Card</div>
                    <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                      Visa, Mastercard, or American Express
                    </div>
                  </div>
                </label>

                {/* Online Transfer */}
                <label style={styles.paymentOption}>
                  <input
                    type="radio"
                    name="payment_method"
                    value="Online Transfer"
                    checked={paymentMethod === "Online Transfer"}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    style={{ marginRight: 12 }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, color: "#e2e8f0" }}>🏦 Online Transfer</div>
                    <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                      Bank transfer or digital wallet
                    </div>
                  </div>
                </label>

                {/* Cash */}
                <label style={styles.paymentOption}>
                  <input
                    type="radio"
                    name="payment_method"
                    value="Cash"
                    checked={paymentMethod === "Cash"}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    style={{ marginRight: 12 }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, color: "#e2e8f0" }}>💰 Cash</div>
                    <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                      Pay at the airport counter
                    </div>
                  </div>
                </label>
              </div>

              {paymentMethod === "Credit Card" && (
                <div style={styles.infoBox}>
                  ℹ️ Your payment details will be securely processed. You will not be charged until
                  you complete this booking.
                </div>
              )}

              {paymentMethod === "Online Transfer" && (
                <div style={styles.infoBox}>
                  ℹ️ After selecting this method, you will receive bank transfer details to
                  complete the payment.
                </div>
              )}

              {paymentMethod === "Cash" && (
                <div style={styles.infoBox}>
                  ℹ️ Your booking will be reserved. You must pay at the airport counter before
                  check-in.
                </div>
              )}
            </section>

            {/* Terms & Conditions */}
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Terms & Conditions</h2>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                <p>
                  By proceeding with this booking, you agree to:
                  <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                    <li>Our airline's terms and conditions</li>
                    <li>Baggage policies and excess weight charges</li>
                    <li>Cancellation and refund policies</li>
                    <li>Privacy and data protection policy</li>
                  </ul>
                </p>
              </div>
              <label style={{ display: "flex", alignItems: "center", marginTop: 14, cursor: "pointer" }}>
                <input type="checkbox" style={{ marginRight: 8 }} defaultChecked />
                <span style={{ fontSize: 13, color: "#cbd5e1" }}>
                  I agree to the terms and conditions
                </span>
              </label>
            </section>
          </div>

          {/* Right Column - Order Review */}
          <div>
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Order Summary</h2>

              <div style={styles.summaryBlock}>
                <div style={styles.summaryLabel}>Seat</div>
                <div style={styles.summaryValue}>{orderSummary.seat_number}</div>
              </div>

              <div style={styles.summaryBlock}>
                <div style={styles.summaryLabel}>Class</div>
                <div style={styles.summaryValue}>{orderSummary.seat_class}</div>
              </div>

              <div style={{ ...styles.summaryBlock, borderBottomWidth: 0 }}>
                <div style={styles.summaryLabel}>Items</div>
                <div style={styles.summaryValue}>{1 + orderSummary.baggage_items.length}</div>
              </div>

              <div style={styles.summaryBreakdown}>
                <div style={styles.breakdownRow}>
                  <span>Ticket</span>
                  <span>PKR {orderSummary.ticket_price}</span>
                </div>

                {orderSummary.baggage_charges > 0 && (
                  <div style={styles.breakdownRow}>
                    <span>Baggage Charges</span>
                    <span>PKR {orderSummary.baggage_charges}</span>
                  </div>
                )}

                <div
                  style={{
                    ...styles.breakdownRow,
                    borderTop: "2px solid #334155",
                    paddingTop: 12,
                    marginTop: 12,
                    fontWeight: 700,
                  }}
                >
                  <span>Total Amount</span>
                  <span style={{ color: "#22c55e", fontSize: 18 }}>
                    PKR {orderSummary.total_amount}
                  </span>
                </div>
              </div>
            </section>

            {/* Passenger Info */}
            {user && (
              <section style={styles.card}>
                <h2 style={styles.sectionTitle}>Passenger</h2>
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

            {error && (
              <section style={{ ...styles.card, background: "#3f1d1d", border: "1px solid #7f1d1d" }}>
                <div style={{ color: "#fca5a5", fontSize: 14 }}>
                  <strong>Error:</strong> {error}
                </div>
              </section>
            )}

            {/* Actions */}
            <div style={styles.actions}>
              <button
                style={styles.secondaryBtn}
                onClick={() => router.back()}
                disabled={loading}
              >
                Back
              </button>
              <button
                style={loading ? styles.disabledBtn : styles.primaryBtn}
                onClick={handleCreateTicket}
                disabled={loading}
              >
                {loading ? "Processing..." : "Complete Booking"}
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
  paymentOptions: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  paymentOption: {
    display: "flex",
    alignItems: "flex-start" as const,
    padding: 14,
    background: "#0b1220",
    border: "2px solid #334155",
    borderRadius: 10,
    cursor: "pointer",
    transition: "all 0.2s",
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
  summaryBlock: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 0",
    borderBottom: "1px solid #334155",
  },
  summaryLabel: { color: "#94a3b8", fontSize: 14 },
  summaryValue: { color: "#e2e8f0", fontWeight: 700 },
  summaryBreakdown: { marginTop: 16 },
  breakdownRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    color: "#cbd5e1",
    fontSize: 14,
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
  disabledBtn: {
    border: "none",
    background: "#475569",
    color: "#cbd5e1",
    borderRadius: 10,
    padding: "12px 18px",
    fontWeight: 700,
    cursor: "not-allowed",
    opacity: 0.7,
  },
  center: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#0f172a",
    color: "#e2e8f0",
  },
};