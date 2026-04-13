"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

type TrackingResult = {
  cargo_id: number;
  tracking_number: string;
  cargo_type: string;
  weight_kg: number;
  origin_airport_code: string;
  origin_airport_name: string;
  origin_city: string;
  destination_airport_code: string;
  destination_airport_name: string;
  destination_city: string;
  sender_name: string;
  reciever_name: string;
  status: string;
  flight_number: string;
  is_insured: boolean;
  created_at?: string;
};

export default function TrackCargoPage() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [searched, setSearched] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    if (storedUser) setUser(JSON.parse(storedUser));
    else router.push("/login");
  }, [router]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setSearched(false);

    if (!trackingNumber.trim()) {
      setError("Please enter a tracking number");
      return;
    }

    if (!user) {
      setError("User not authenticated");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE}/cargo?tracking_number=${trackingNumber}&user_id=${user.user_id}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );
      const data = await res.json();

      setSearched(true);

      if (!res.ok || !data.data || data.data.length === 0) {
        setError("No shipment found with this tracking number");
        return;
      }

      setResult(data.data[0]);
    } catch (err: any) {
      console.error("Error tracking cargo:", err);
      setError("Failed to search tracking number");
    } finally {
      setLoading(false);
    }
  };

  const getStatusSteps = (status: string) => {
    const statuses = [
      "Booked",
      "Loaded",
      "In Transit",
      "Unloaded",
      "Customs Hold",
      "Delivered",
    ];
    const currentIndex = statuses.indexOf(status);
    return statuses.map((s, i) => ({
      name: s,
      completed: i <= currentIndex,
      current: i === currentIndex,
    }));
  };

  if (!user) return null;

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <h1 style={styles.h1}>📦 Track Your Shipment</h1>
          <p style={styles.subtitle}>
            Enter your tracking number to get real-time updates
          </p>
        </header>

        {/* Search Section */}
        <AestheticCard noPad>
          <form onSubmit={handleSearch} style={styles.searchForm}>
            <div style={styles.searchInput}>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Enter tracking number (e.g., TRK123456)"
                style={styles.input}
                maxLength={10}
              />
              <button type="submit" style={styles.searchBtn} disabled={loading}>
                {loading ? "Searching..." : "Track"}
              </button>
            </div>
            {error && <div style={styles.errorBox}>{error}</div>}
          </form>
        </AestheticCard>

        {/* Results Section */}
        {searched && !result && !loading && (
          <AestheticCard style={styles.error}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                No shipment found
              </div>
              <div style={{ fontSize: 14, color: "#cbd5e1", marginTop: 8 }}>
                Please check the tracking number and try again
              </div>
            </div>
          </AestheticCard>
        )}

        {result && (
          <>
            {/* Shipment Summary */}
            <AestheticCard>
              <div style={styles.summaryGrid}>
                <div style={styles.summaryItem}>
                  <div style={styles.summaryLabel}>Tracking Number</div>
                  <div style={styles.summaryValue}>{result.tracking_number}</div>
                </div>
                <div style={styles.summaryItem}>
                  <div style={styles.summaryLabel}>Cargo Type</div>
                  <div style={typeTag(result.cargo_type)}>{result.cargo_type}</div>
                </div>
                <div style={styles.summaryItem}>
                  <div style={styles.summaryLabel}>Weight</div>
                  <div style={styles.summaryValue}>{result.weight_kg} kg</div>
                </div>
                <div style={styles.summaryItem}>
                  <div style={styles.summaryLabel}>Insurance</div>
                  <div style={styles.summaryValue}>
                    {result.is_insured ? "✓ Insured" : "Not Insured"}
                  </div>
                </div>
              </div>
            </AestheticCard>

            {/* Status Tracker */}
            <AestheticCard>
              <h2 style={styles.sectionTitle}>📍 Shipment Status</h2>
              <div style={styles.statusTracker}>
                {getStatusSteps(result.status).map((step, index) => (
                  <div key={index} style={styles.stepContainer}>
                    <div
                      style={{
                        ...styles.stepCircle,
                        ...(step.completed ? styles.stepCircleCompleted : {}),
                        ...(step.current ? styles.stepCircleCurrent : {}),
                      }}
                    >
                      {step.completed && !step.current ? "✓" : ""}
                    </div>
                    <div
                      style={{
                        ...styles.stepLabel,
                        ...(step.current ? styles.stepLabelCurrent : {}),
                      }}
                    >
                      {step.name}
                    </div>
                    {index < getStatusSteps(result.status).length - 1 && (
                      <div
                        style={{
                          ...styles.stepLine,
                          ...(getStatusSteps(result.status)[index + 1].completed
                            ? styles.stepLineCompleted
                            : {}),
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div style={styles.currentStatusBox}>
                <span style={statusBadgeLarge(result.status)}>
                  Current Status: {result.status}
                </span>
              </div>
            </AestheticCard>

            {/* Route Information */}
            <AestheticCard>
              <h2 style={styles.sectionTitle}>✈️ Route Information</h2>
              <div style={styles.routeContainer}>
                <div style={styles.routeAirport}>
                  <div style={styles.airportCode}>{result.origin_airport_code}</div>
                  <div style={styles.airportName}>{result.origin_airport_name}</div>
                  <div style={styles.airportCity}>{result.origin_city}</div>
                </div>
                <div style={styles.routeArrow}>→</div>
                <div style={styles.routeAirport}>
                  <div style={styles.airportCode}>{result.destination_airport_code}</div>
                  <div style={styles.airportName}>{result.destination_airport_name}</div>
                  <div style={styles.airportCity}>{result.destination_city}</div>
                </div>
              </div>
            </AestheticCard>

            {/* Sender & Receiver */}
            <AestheticCard>
              <h2 style={styles.sectionTitle}>👥 Sender & Receiver</h2>
              <div style={styles.contactGrid}>
                <div style={styles.contactBox}>
                  <div style={styles.contactTitle}>📤 From</div>
                  <div style={styles.contactName}>{result.sender_name}</div>
                </div>
                <div style={styles.contactBox}>
                  <div style={styles.contactTitle}>📥 To</div>
                  <div style={styles.contactName}>{result.reciever_name}</div>
                </div>
              </div>
            </AestheticCard>

            {/* Flight Information */}
            {result.flight_number && (
              <AestheticCard>
                <h2 style={styles.sectionTitle}>🛫 Flight Information</h2>
                <div style={styles.flightBox}>
                  <div style={styles.flightNumber}>{result.flight_number}</div>
                  <div style={styles.flightNote}>
                    This shipment is being transported on this flight
                  </div>
                </div>
              </AestheticCard>
            )}

            {/* Action Buttons */}
            <div style={styles.actionSection}>
              <button
                style={styles.newSearchBtn}
                onClick={() => {
                  setTrackingNumber("");
                  setResult(null);
                  setError("");
                  setSearched(false);
                }}
              >
                Search Another
              </button>
              <button
                style={styles.viewDetailsBtn}
                onClick={() => router.push("/cargo-shipment")}
              >
                View All Shipments
              </button>
            </div>
          </>
        )}

        {/* Empty State */}
        {!searched && !result && (
          <AestheticCard>
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📦</div>
              <div style={styles.emptyTitle}>Track Your Cargo</div>
              <div style={styles.emptyText}>
                Enter your tracking number above to see the real-time status of your
                shipment, route information, and delivery details.
              </div>
              <button
                style={styles.viewAllBtn}
                onClick={() => router.push("/cargo-shipment")}
              >
                View My Shipments
              </button>
            </div>
          </AestheticCard>
        )}
      </div>
    </div>
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
      }}
    >
      {children}
    </div>
  );
}

function typeTag(type: string) {
  return {
    background: "#2563eb28",
    color: "#60a5fa",
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 13,
    fontWeight: 600,
    display: "inline-block",
  };
}

function statusBadgeLarge(status: string) {
  let bg = "#fbbf24cc";
  let color = "#543c11";
  if (status === "Delivered") {
    bg = "#22c55ecc";
    color = "#073c19";
  } else if (status === "Cancelled") {
    bg = "#f87171cc";
    color = "#75030c";
  } else if (status === "In Transit") {
    bg = "#3b82f6cc";
    color = "#1e3a8a";
  } else if (status === "Customs Hold") {
    bg = "#f97316cc";
    color = "#7c2d12";
  }
  return {
    fontSize: 15,
    fontWeight: 700,
    background: bg,
    color,
    borderRadius: 8,
    padding: "8px 14px",
    display: "inline-block",
    textTransform: "capitalize" as const,
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
    maxWidth: 900,
    margin: "0 auto",
    padding: "32px 10px 50px 10px",
    minHeight: "100vh",
  },
  header: {
    marginBottom: 28,
    textAlign: "center",
  },
  h1: {
    margin: "0 0 8px 0",
    fontSize: 36,
    fontWeight: 800,
    color: "#93c5fd",
    letterSpacing: 0.6,
  },
  subtitle: {
    margin: 0,
    fontSize: 16,
    color: "#64748b",
    fontWeight: 500,
  },
  searchForm: {
    padding: 22,
  },
  searchInput: {
    display: "flex",
    gap: 10,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    padding: "12px 14px",
    background: "#1e293b",
    border: "1.5px solid #2563eb33",
    borderRadius: 8,
    color: "#e6eefb",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
  },
  searchBtn: {
    border: "none",
    padding: "12px 24px",
    background: "linear-gradient(80deg,#2563eb 70%,#60a5fa)",
    color: "#fff",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: "0 2px 12px #2563eb44",
    whiteSpace: "nowrap",
  },
  errorBox: {
    background: "#7f1d1d",
    border: "1px solid #dc2626",
    borderRadius: 8,
    padding: 12,
    color: "#fca5a5",
    fontSize: 14,
    fontWeight: 600,
  },
  error: {
    color: "#f26a6a",
    background: "#271e1e2b",
    border: "1px solid #b91c1ccc",
    fontWeight: 600,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 16,
  },
  summaryItem: {
    textAlign: "center",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 700,
    color: "#cbd5e1",
  },
  sectionTitle: {
    margin: "0 0 16px 0",
    fontSize: 18,
    fontWeight: 700,
    color: "#93c5fd",
  },
  statusTracker: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    overflowX: "auto",
    paddingBottom: 8,
  },
  stepContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flex: 1,
    minWidth: 80,
    position: "relative",
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "#1e293b",
    border: "2px solid #2563eb33",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    color: "#64748b",
    fontSize: 18,
    marginBottom: 8,
  },
  stepCircleCompleted: {
    background: "#10b981",
    borderColor: "#10b981",
    color: "#fff",
  },
  stepCircleCurrent: {
    background: "#2563eb",
    borderColor: "#60a5fa",
    color: "#fff",
    boxShadow: "0 0 12px #2563eb66",
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#64748b",
    textAlign: "center",
    maxWidth: 70,
  },
  stepLabelCurrent: {
    color: "#60a5fa",
    fontWeight: 700,
  },
  stepLine: {
    position: "absolute",
    top: 20,
    left: "50%",
    width: "100%",
    height: 2,
    background: "#2563eb33",
    zIndex: -1,
  },
  stepLineCompleted: {
    background: "#10b981",
  },
  currentStatusBox: {
    textAlign: "center",
    padding: 16,
    background: "#1e293b44",
    borderRadius: 8,
  },
  routeContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    gap: 20,
    flexWrap: "wrap",
  },
  routeAirport: {
    textAlign: "center",
    padding: 16,
    background: "#1e293b44",
    borderRadius: 8,
    minWidth: 150,
  },
  airportCode: {
    fontSize: 24,
    fontWeight: 800,
    color: "#60a5fa",
  },
  airportName: {
    fontSize: 13,
    fontWeight: 700,
    color: "#cbd5e1",
    marginTop: 4,
  },
  airportCity: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  routeArrow: {
    fontSize: 28,
    fontWeight: 800,
    color: "#2563eb",
  },
  contactGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  contactBox: {
    padding: 16,
    background: "#1e293b44",
    borderRadius: 8,
  },
  contactTitle: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
    marginBottom: 8,
  },
  contactName: {
    fontSize: 15,
    fontWeight: 700,
    color: "#cbd5e1",
  },
  flightBox: {
    padding: 16,
    background: "#1e293b44",
    borderRadius: 8,
    textAlign: "center",
  },
  flightNumber: {
    fontSize: 20,
    fontWeight: 800,
    color: "#60a5fa",
  },
  flightNote: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 6,
  },
  actionSection: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  newSearchBtn: {
    border: "1.5px solid #2563eb",
    padding: "12px 24px",
    background: "transparent",
    color: "#60a5fa",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  viewDetailsBtn: {
    border: "none",
    padding: "12px 24px",
    background: "linear-gradient(80deg,#2563eb 70%,#60a5fa)",
    color: "#fff",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  emptyState: {
    textAlign: "center",
    padding: 48,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#93c5fd",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 24,
    maxWidth: 400,
  },
  viewAllBtn: {
    border: "none",
    padding: "12px 24px",
    background: "linear-gradient(80deg,#2563eb 70%,#60a5fa)",
    color: "#fff",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
};