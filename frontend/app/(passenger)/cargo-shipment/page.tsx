"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { API_BASE } from "@/app/config";

type Cargo = {
  cargo_id: number;
  tracking_number: string;
  cargo_type: string;
  weight_kg: number;
  origin_airport_name: string;
  destination_airport_name: string;
  status: string;
  sender_email: string;
  reciever_name: string;
  flight_number: string;
  is_insured: boolean;
};

export default function CargoShipmentsPage() {
  const [shipments, setShipments] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [displayedCount, setDisplayedCount] = useState(5);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? sessionStorage.getItem("user") : null;
    if (storedUser) setUser(JSON.parse(storedUser));
    else router.push("/login");
  }, [router]);

  const fetchShipments = useCallback(async () => {
  if (!user?.user_id) return;
  
  try {
    setLoading(true);
    const res = await fetch(`${API_BASE}/cargo?user_id=${user.user_id}`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
    });
    const data = await res.json();
    setShipments(Array.isArray(data.data) ? data.data : []);
    setDisplayedCount(5);
  } catch (err: any) {
    setError("Failed to load shipments");
  } finally {
    setLoading(false);
  }
}, [user?.user_id]);

useEffect(() => {
  if (user?.user_id) fetchShipments();
}, [user?.user_id, fetchShipments]);

  useEffect(() => {
    if (user) fetchShipments();
  }, [user, fetchShipments]);

  // Always derive the displayed list from shipments + filters
  const filtered = shipments.filter((s) => {
    if (filterStatus && s.status !== filterStatus) return false;
    if (filterType && s.cargo_type !== filterType) return false;
    return true;
  });

  const displayedShipments = filtered.slice(0, displayedCount);

  const handleLoadMore = () => setDisplayedCount((c) => c + 10);

  const handleCancel = async (cargoId: number) => {
    if (!confirm("Are you sure you want to cancel this shipment?")) return;

    try {
      const res = await fetch(`${API_BASE}/cargo/${cargoId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
      });

      if (res.ok) {
        await fetchShipments(); // re-fetch so state is always accurate
      } else {
        const data = await res.json();
        alert(data.message || "Failed to cancel shipment");
      }
    } catch (err) {
      alert("Error cancelling shipment");
    }
  };

  if (!user) return null;

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <h1 style={styles.h1}>📦 My Cargo Shipments</h1>
          <button style={styles.cta} onClick={() => router.push("/cargo-shipment/create")}>
            Create Shipment
          </button>
        </header>

        <div style={styles.filterSection}>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setDisplayedCount(5); }}
            style={styles.filterSelect}
          >
            <option value="">All Statuses</option>
            <option value="Booked">Booked</option>
            <option value="Loaded">Loaded</option>
            <option value="In Transit">In Transit</option>
            <option value="Unloaded">Unloaded</option>
            <option value="Customs Hold">Customs Hold</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setDisplayedCount(5); }}
            style={styles.filterSelect}
          >
            <option value="">All Types</option>
            <option value="General">General</option>
            <option value="Perishable">Perishable</option>
            <option value="Hazardous">Hazardous</option>
            <option value="Fragile">Fragile</option>
            <option value="Live Animals">Live Animals</option>
            <option value="Mail">Mail</option>
          </select>
        </div>

        {loading ? (
          <AestheticCard><div>Loading shipments...</div></AestheticCard>
        ) : error ? (
          <AestheticCard style={styles.error}>{error}</AestheticCard>
        ) : displayedShipments.length === 0 ? (
          <AestheticCard>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {filtered.length === 0 && shipments.length === 0
                  ? "You have no cargo shipments yet."
                  : "No shipments match the selected filters."}
              </div>
              {shipments.length === 0 && (
                <button
                  style={{ ...styles.smallBtn, marginTop: 12 }}
                  onClick={() => router.push("/cargo-shipment/create")}
                >
                  Create One
                </button>
              )}
            </div>
          </AestheticCard>
        ) : (
          <>
            <AestheticCard noPad>
              <div style={{ overflowX: "auto" }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>Tracking #</th>
                      <th>Type</th>
                      <th>Weight</th>
                      <th>Route</th>
                      <th>Receiver</th>
                      <th>Flight</th>
                      <th>Status</th>
                      <th>Insured</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedShipments.map((shipment) => (
                      <tr key={shipment.cargo_id}>
                        <td style={{ fontWeight: 600 }}>{shipment.tracking_number}</td>
                        <td><span style={typeTag(shipment.cargo_type)}>{shipment.cargo_type}</span></td>
                        <td>{shipment.weight_kg} kg</td>
                        <td>
                          <div style={{ fontSize: 13 }}>
                            {shipment.origin_airport_name} → {shipment.destination_airport_name}
                          </div>
                        </td>
                        <td style={{ fontSize: 13 }}>{shipment.reciever_name}</td>
                        <td>{shipment.flight_number ?? "—"}</td>
                        <td><span style={statusBadge(shipment.status)}>{shipment.status}</span></td>
                        <td>{shipment.is_insured ? "✓ Yes" : "No"}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              style={styles.viewBtn}
                              onClick={() => router.push(`/cargo-shipment/${shipment.cargo_id}`)}
                            >
                              View
                            </button>
                            <button
                              style={{
                                ...styles.cancelBtn,
                                opacity: shipment.status === "Cancelled" || shipment.status === "Delivered" ? 0.4 : 1,
                                cursor: shipment.status === "Cancelled" || shipment.status === "Delivered" ? "not-allowed" : "pointer",
                              }}
                              onClick={() => handleCancel(shipment.cargo_id)}
                              disabled={shipment.status === "Cancelled" || shipment.status === "Delivered"}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AestheticCard>

            {displayedCount < filtered.length && (
              <div style={{ marginTop: 18, textAlign: "center" }}>
                <button style={styles.cta} onClick={handleLoadMore}>
                  Load More ({displayedCount} of {filtered.length})
                </button>
              </div>
            )}
          </>
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
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function statusBadge(status: string) {
  let bg = "#fbbf24cc", color = "#543c11";
  if (status === "Delivered")    { bg = "#22c55ecc"; color = "#073c19"; }
  else if (status === "Cancelled") { bg = "#f87171cc"; color = "#75030c"; }
  else if (status === "Booked")    { bg = "#60a5facc"; color = "#17315a"; }
  else if (status === "In Transit") { bg = "#3b82f6cc"; color = "#1e3a8a"; }
  else if (status === "Customs Hold") { bg = "#f97316cc"; color = "#7c2d12"; }
  return {
    background: bg, color, borderRadius: 6,
    padding: "4px 10px", fontSize: 12, fontWeight: 600,
    textTransform: "capitalize" as const, display: "inline-block",
  };
}

function typeTag(type: string) {
  return {
    background: "#2563eb28", color: "#60a5fa", borderRadius: 6,
    padding: "4px 10px", fontSize: 12, fontWeight: 600, display: "inline-block",
  };
}

const styles: Record<string, React.CSSProperties> = {
  bg: {
    minHeight: "100vh", width: "100vw",
    background: "linear-gradient(140deg, #1e293b 70%, #2563eb 160%)",
    color: "#e6eefb", padding: 0,
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },
  shell: { maxWidth: 1200, margin: "0 auto", padding: "32px 10px 50px 10px", minHeight: "100vh" },
  header: {
    display: "flex", alignItems: "center", gap: 20,
    justifyContent: "space-between", marginBottom: 24,
    padding: "8px 0 28px", borderBottom: "1.5px solid #1e293b55", flexWrap: "wrap",
  },
  h1: { margin: 0, fontSize: 32, fontWeight: 800, color: "#93c5fd", letterSpacing: 0.6 },
  filterSection: { display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" },
  filterSelect: {
    background: "#1e293b", color: "#e6eefb", border: "1.5px solid #2563eb33",
    borderRadius: 8, padding: "8px 12px", fontSize: 14, fontWeight: 500,
    cursor: "pointer", outline: "none",
  },
  cta: {
    border: "none", padding: "13px 20px",
    background: "linear-gradient(80deg,#2563eb 70%,#60a5fa)",
    color: "#fff", borderRadius: 12, fontWeight: 700, fontSize: 17,
    cursor: "pointer", boxShadow: "0 2px 12px #2563eb44",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14, color: "#dde7fa" },
  smallBtn: {
    border: "none", background: "#2563eb", color: "#fff",
    padding: "6px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600,
  },
  viewBtn: {
    border: "none", background: "#2563eb", color: "#fff",
    padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600,
  },
  cancelBtn: {
    border: "none", background: "#ef4444", color: "#fff",
    padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
  },
  error: { color: "#f26a6a", background: "#271e1e2b", border: "1px solid #b91c1ccc", fontWeight: 600 },
};