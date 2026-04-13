"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { API_BASE } from "@/app/config";

type RunwayBookingData = {
  runway_id: number;
  airport_id: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  runway_code: string;
  private_aircraft_id: number;
};

type PrivateAircraft = {
  private_aircraft_id: number;
  registration_number: string;
  model_name: string;
  manufacturer: string;
  seat_capacity: number;
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

export default function ConfirmBookingPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bookingData, setBookingData] = useState<RunwayBookingData | null>(null);
  const [aircraftData, setAircraftData] = useState<PrivateAircraft | null>(null);

  // Load booking data
  useEffect(() => {
    const data = sessionStorage.getItem("runwayBookingData");
    if (!data) {
      router.push("/(passenger)/runway_booking/available_runway");
      return;
    }

    const parsed = JSON.parse(data) as RunwayBookingData;
    setBookingData(parsed);

    // Fetch aircraft details
    fetchAircraftDetails(parsed.private_aircraft_id);
  }, [router]);

  const fetchAircraftDetails = async (aircraftId: number) => {
    try {
      const resp = await fetchJson(`${API_BASE}/private-aircraft`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      const aircraftList = Array.isArray(resp?.data) ? resp.data : [];
      const aircraft = aircraftList.find(
        (a: any) => a.private_aircraft_id === aircraftId
      );

      if (aircraft) {
        setAircraftData(aircraft);
      }
    } catch (err) {
      console.error("Error fetching aircraft:", err);
    }
  };

    const handleConfirmBooking = async () => {
    if (!bookingData || !aircraftData) {
      setError("Booking data is missing");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const payload = {
        private_aircraft_id: bookingData.private_aircraft_id,
        runway_id: bookingData.runway_id,
        booking_date: bookingData.booking_date,
        start_time: bookingData.start_time.includes(":") 
          ? bookingData.start_time 
          : `${bookingData.start_time}:00`,
        end_time: bookingData.end_time.includes(":") 
          ? bookingData.end_time 
          : `${bookingData.end_time}:00`,
      };

      console.log("Booking payload:", payload);

      const response = await fetchJson(
        `${API_BASE}/runway-booking/private`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify(payload),
        }
      );

      console.log("Booking confirmed:", response);

      // Clear session data
      sessionStorage.removeItem("runwayBookingData");

      // Show success
      alert(
        `Runway booking confirmed!\n\nBooking ID: ${response.data.booking_id}\nRunway: ${response.data.runway_code}\nDate: ${bookingData.booking_date}`
      );

      // Redirect to dashboard
      setTimeout(() => {
        router.push("/dashboard");
      }, 500);
    } catch (err: any) {
      console.error("Booking error:", err);
      setError(err?.message || "Failed to confirm booking");
      setLoading(false);
    }
  };

  if (!bookingData || !aircraftData) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner}>Loading booking details...</div>
      </div>
    );
  }

  return (
    <div style={styles.bg}>
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={() => router.back()}>
            ← Back
          </button>
          <h1 style={styles.title}>✅ Confirm Runway Booking</h1>
          <div />
        </div>

        {/* Runway Details */}
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Runway Details</h2>
          <div style={styles.detailGrid}>
            <DetailItem label="Runway Code" value={bookingData.runway_code} />
            <DetailItem label="Booking Date" value={bookingData.booking_date} />
            <DetailItem
              label="Start Time"
              value={bookingData.start_time}
            />
            <DetailItem label="End Time" value={bookingData.end_time} />
          </div>
        </section>

        {/* Aircraft Details */}
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Aircraft Details</h2>
          <div style={styles.detailGrid}>
            <DetailItem
              label="Registration"
              value={aircraftData.registration_number}
            />
            <DetailItem label="Model" value={aircraftData.model_name} />
            <DetailItem label="Manufacturer" value={aircraftData.manufacturer} />
            {aircraftData.seat_capacity && (
              <DetailItem
                label="Seat Capacity"
                value={String(aircraftData.seat_capacity)}
              />
            )}
          </div>
        </section>

        {/* Terms */}
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>📋 Booking Terms</h2>
          <ul style={styles.termsList}>
            <li>Runway booking is valid for the specified date and time only</li>
            <li>
              You must arrive at least 30 minutes before your scheduled time
            </li>
            <li>Cancellations must be made 24 hours in advance</li>
            <li>Late arrival may result in booking cancellation</li>
            <li>All aviation safety regulations must be followed</li>
          </ul>
        </section>

        {/* Error */}
        {error && (
          <section style={{ ...styles.card, background: "#7f1d1d", border: "1px solid #991b1b" }}>
            <div style={{ color: "#fca5a5", fontSize: 14 }}>
              <strong>Error:</strong> {error}
            </div>
          </section>
        )}

        {/* Actions */}
        <div style={styles.actions}>
          <button style={styles.secondaryBtn} onClick={() => router.back()}>
            Back
          </button>
          <button
            style={{
              ...styles.confirmBtn,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
            onClick={handleConfirmBooking}
            disabled={loading}
          >
            {loading ? "Confirming..." : "Confirm Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.detailItem}>
      <div style={styles.detailLabel}>{label}</div>
      <div style={styles.detailValue}>{value}</div>
    </div>
  );
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
  sectionTitle: {
    margin: 0,
    marginBottom: 16,
    fontSize: 18,
    fontWeight: 700,
    color: "#bfdbfe",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
  },
  detailItem: {
    background: "#0b1220",
    border: "1px solid #1f2937",
    borderRadius: 10,
    padding: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: 700,
    color: "#e2e8f0",
  },
  termsList: {
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
  confirmBtn: {
    border: "none",
    background: "linear-gradient(90deg,#22c55e 80%,#16a34a)",
    color: "#fff",
    borderRadius: 10,
    padding: "12px 24px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 16,
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
};