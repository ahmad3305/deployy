"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

type RunwayBookingDetail = {
  booking_id: number;
  runway_id: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  booking_status: string;
  created_at: string;
  runway_code: string;
  airport_id: number;
  length: number;
  runway_status: string;
  airport_name: string;
  airport_code: string;
  city: string;
  country: string;
  registration_number: string;
  model_name: string;
  manufacturer: string;
  aircraft_status: string;
};

export default function RunwayBookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<RunwayBookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function fetchBooking() {
        try {
        setLoading(true);
        console.log("Fetching booking ID:", bookingId); // Debug
        
        const res = await fetch(`${API_BASE}/runway-booking/${bookingId}`, {
            headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
        });

        console.log("Response status:", res.status); // Debug
        const text = await res.text(); // Get as text first
        console.log("Response text:", text); // Debug
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${text}`);
        }

        const data = JSON.parse(text);
        setBooking(data.data);
        } catch (err: any) {
        console.error("Error fetching booking:", err);
        setError(err.message || "Failed to load booking details");
        } finally {
        setLoading(false);
        }
    }

    if (bookingId) fetchBooking();
    }, [bookingId]);


  if (loading) {
    return (
      <div style={styles.bg}>
        <div style={styles.shell}>
          <div style={{ textAlign: "center", paddingTop: 50 }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div style={styles.bg}>
        <div style={styles.shell}>
          <div style={{ color: "#ef4444", textAlign: "center", paddingTop: 50 }}>
            {error || "Booking not found"}
          </div>
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button style={styles.cta} onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={() => router.back()}>
            ← Back
          </button>
          <h1 style={styles.h1}>🛫 Runway Booking Details</h1>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 24 }}>
          {/* Left Column */}
          <Card>
            <CardHeading>Booking Information</CardHeading>
            <InfoRow label="Booking ID" value={`#${booking.booking_id}`} />
            <InfoRow label="Status" value={<StatusBadge status={booking.booking_status} />} />
            <InfoRow label="Booked on" value={new Date(booking.created_at).toLocaleDateString()} />
            <InfoRow label="Booking Date" value={new Date(booking.booking_date).toLocaleDateString()} />
            <InfoRow label="Time Slot" value={`${booking.start_time} - ${booking.end_time}`} />
          </Card>

          {/* Right Column */}
            <Card>
            <CardHeading>Runway Details</CardHeading>
            <InfoRow label="Runway Code" value={booking.runway_code} highlight />
            <InfoRow label="Length" value={`${booking.length}m`} />
            <InfoRow label="Status" value={<RunwayStatusBadge status={booking.runway_status} />} />
            </Card>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
          {/* Airport Info */}
          <Card>
            <CardHeading>Airport Information</CardHeading>
            <InfoRow label="Airport" value={booking.airport_name} highlight />
            <InfoRow label="Code" value={booking.airport_code} />
            <InfoRow label="Location" value={`${booking.city}, ${booking.country}`} />
          </Card>

          {/* Aircraft Info */}
          <Card>
            <CardHeading>Aircraft Details</CardHeading>
            <InfoRow label="Registration" value={booking.registration_number} highlight />
            <InfoRow label="Model" value={booking.model_name} />
            <InfoRow label="Manufacturer" value={booking.manufacturer} />
            <InfoRow label="Status" value={<AircraftStatusBadge status={booking.aircraft_status} />} />
          </Card>
        </div>

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <button style={styles.cta} onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "linear-gradient(110deg, #1e293b 70%, #2563eb18 100%)",
        borderRadius: 14,
        padding: 22,
        boxShadow: "0 8px 36px #1e293b40, 0 2px 8px #2563eb33",
        border: "1.5px solid #2563eb26",
      }}
    >
      {children}
    </div>
  );
}

function CardHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 18,
        fontWeight: 700,
        color: "#93c5fd",
        marginBottom: 16,
        marginTop: 0,
      }}
    >
      {children}
    </h2>
  );
}

function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "#64748b", fontWeight: 500 }}>{label}</span>
      <span
        style={{
          color: highlight ? "#2563eb" : "#e6eefb",
          fontWeight: highlight ? 700 : 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  let bg = "#fbbf24cc",
    color = "#543c11";
  if (status === "Approved") {
    bg = "#22c55ecc";
    color = "#073c19";
  } else if (status === "Reserved") {
    bg = "#60a5facc";
    color = "#17315a";
  } else if (status === "Cancelled") {
    bg = "#f87171cc";
    color = "#75030c";
  }
  return (
    <span
      style={{
        background: bg,
        color,
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {status}
    </span>
  );
}

function AircraftStatusBadge({ status }: { status: string }) {
  const bg = status === "Active" ? "#22c55ecc" : "#f87171cc";
  const color = status === "Active" ? "#073c19" : "#75030c";

  return (
    <span
      style={{
        background: bg,
        color,
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {status}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bg: {
    minHeight: "100vh",
    width: "100vw",
    background: "linear-gradient(140deg, #1e293b 70%, #2563eb 160%)",
    color: "#e6eefb",
    padding: 0,
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
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
    gap: 20,
    marginBottom: 24,
    paddingBottom: 24,
    borderBottom: "1.5px solid #1e293b55",
  },
  backBtn: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
  h1: {
    margin: 0,
    fontSize: 32,
    fontWeight: 800,
    color: "#93c5fd",
    letterSpacing: 0.6,
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
  },
};


function RunwayStatusBadge({ status }: { status: string }) {
  const bg = status === "active" ? "#22c55ecc" : "#f87171cc";
  const color = status === "active" ? "#073c19" : "#75030c";

  return (
    <span
      style={{
        background: bg,
        color,
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 600,
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}