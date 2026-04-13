"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

type Cargo = {
  cargo_id: number;
  tracking_number: string;
  cargo_type: string;
  description: string;
  weight_kg: number;
  origin_airport_name: string;
  origin_airport_code: string;
  origin_city: string;
  origin_country: string;
  destination_airport_name: string;
  destination_airport_code: string;
  destination_city: string;
  destination_country: string;
  sender_name: string;
  sender_contact: string;
  reciever_name: string;
  reciever_contact: string;
  status: string;
  is_insured: boolean;
  flight_number: string;
  airline_name: string;
  airline_code: string;
  flight_type: string;
  estimated_duration: string;
};

export default function CargoDetailPage() {
  const params = useParams();
  const cargoId = params.id as string;
  const router = useRouter();

  const [cargo, setCargo] = useState<Cargo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Cargo>>({});
  const [submitting, setSubmitting] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchCargo();
  }, [cargoId]);

  const fetchCargo = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/cargo/${cargoId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to load shipment");
        return;
      }

      setCargo(data.data);
      setEditData(data.data);
    } catch (err: any) {
      console.error("Error fetching cargo:", err);
      setError("Failed to load shipment");
    } finally {
      setLoading(false);
    }
  };

  const handleEditChange = (field: string, value: any) => {
    setEditData({ ...editData, [field]: value });
  };

  const handleSaveEdit = async () => {
  if (!cargo) return;

  try {
    setSubmitting(true);
    setMessage(null);

    const updatePayload: Record<string, any> = {};

    // Only include fields that changed
    Object.keys(editData).forEach((key) => {
      if (editData[key as keyof Cargo] !== cargo[key as keyof Cargo]) {
        updatePayload[key] = editData[key as keyof Cargo];
      }
    });

    if (Object.keys(updatePayload).length === 0) {
      setMessage({ type: "error", text: "No changes to save" });
      setSubmitting(false);
      return;
    }

    const res = await fetch(`${API_BASE}/cargo/${cargoId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(updatePayload),
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: data.message || "Failed to update shipment" });
      return;
    }

    setCargo(data.data);
    setEditData(data.data);
    setEditing(false);
    setMessage({ type: "success", text: "Shipment updated successfully" });
  } catch (err: any) {
    console.error("Error updating cargo:", err);
    setMessage({ type: "error", text: err.message || "Failed to update shipment" });
  } finally {
    setSubmitting(false);
  }
};

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this shipment?")) return;

    try {
      setCancelLoading(true);
      setMessage(null);

      const res = await fetch(`${API_BASE}/cargo/${cargoId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.message || "Failed to cancel shipment" });
        return;
      }

      setMessage({ type: "success", text: "Shipment cancelled successfully" });
      setTimeout(() => {
        router.push("/cargo-shipment");
      }, 1500);
    } catch (err: any) {
      console.error("Error cancelling cargo:", err);
      setMessage({ type: "error", text: err.message || "Failed to cancel shipment" });
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.bg}>
        <div style={styles.shell}>
          <AestheticCard>
            <div>Loading shipment details...</div>
          </AestheticCard>
        </div>
      </div>
    );
  }

  if (error || !cargo) {
    return (
      <div style={styles.bg}>
        <div style={styles.shell}>
          <button style={styles.backBtn} onClick={() => router.back()}>
            ← Back
          </button>
          <AestheticCard style={styles.error}>{error || "Shipment not found"}</AestheticCard>
        </div>
      </div>
    );
  }

  const canEdit = cargo.status !== "Delivered" && cargo.status !== "Cancelled";
  const canCancel = cargo.status !== "Delivered" && cargo.status !== "Cancelled";

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <button style={styles.backBtn} onClick={() => router.back()}>
          ← Back
        </button>

        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.h1}>📦 {cargo.tracking_number}</h1>
            <p style={styles.subtitle}>
              {cargo.origin_airport_code} → {cargo.destination_airport_code}
            </p>
          </div>
          <div style={styles.actionButtons}>
            {canEdit && !editing && (
              <button
                style={styles.editBtn}
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
            )}
            {editing && (
              <>
                <button
                  style={styles.saveBtn}
                  onClick={handleSaveEdit}
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Save"}
                </button>
                <button
                  style={styles.cancelEditBtn}
                  onClick={() => {
                    setEditing(false);
                    setEditData(cargo);
                  }}
                  disabled={submitting}
                >
                  Cancel Edit
                </button>
              </>
            )}
            {canCancel && !editing && (
              <button
                style={styles.deleteBtn}
                onClick={handleCancel}
                disabled={cancelLoading}
              >
                {cancelLoading ? "Cancelling..." : "Cancel Shipment"}
              </button>
            )}
          </div>
        </div>

        {message && (
          <div
            style={
              message.type === "success"
                ? styles.successBox
                : styles.errorBox
            }
          >
            {message.text}
          </div>
        )}

        {/* Status Overview */}
        <AestheticCard>
          <div style={styles.statusGrid}>
            <div style={styles.statusItem}>
              <div style={styles.statusLabel}>Current Status</div>
              <div style={statusBadgeLarge(cargo.status)}>
                {cargo.status}
              </div>
            </div>
            <div style={styles.statusItem}>
              <div style={styles.statusLabel}>Cargo Type</div>
              <div style={typeTagLarge(cargo.cargo_type)}>
                {cargo.cargo_type}
              </div>
            </div>
            <div style={styles.statusItem}>
              <div style={styles.statusLabel}>Weight</div>
              <div style={styles.statusValue}>{cargo.weight_kg} kg</div>
            </div>
            <div style={styles.statusItem}>
              <div style={styles.statusLabel}>Insurance</div>
              <div style={styles.statusValue}>
                {cargo.is_insured ? "✓ Insured" : "Not Insured"}
              </div>
            </div>
          </div>
        </AestheticCard>

        {/* Flight Information */}
        <AestheticCard>
          <h2 style={styles.sectionTitle}>✈️ Flight Information</h2>
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Flight Number</div>
              <div style={styles.infoValue}>{cargo.flight_number || "—"}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Airline</div>
              <div style={styles.infoValue}>
                {cargo.airline_name} ({cargo.airline_code})
              </div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Flight Type</div>
              <div style={styles.infoValue}>{cargo.flight_type || "—"}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Estimated Duration</div>
              <div style={styles.infoValue}>{cargo.estimated_duration || "—"}</div>
            </div>
          </div>
        </AestheticCard>

        {/* Route Information */}
        <AestheticCard>
          <h2 style={styles.sectionTitle}>📍 Route Information</h2>
          <div style={styles.routeContainer}>
            <div style={styles.airportBox}>
              <div style={styles.airportCode}>{cargo.origin_airport_code}</div>
              <div style={styles.airportName}>{cargo.origin_airport_name}</div>
              <div style={styles.airportDetails}>
                {cargo.origin_city}, {cargo.origin_country}
              </div>
            </div>
            <div style={styles.arrow}>→</div>
            <div style={styles.airportBox}>
              <div style={styles.airportCode}>{cargo.destination_airport_code}</div>
              <div style={styles.airportName}>{cargo.destination_airport_name}</div>
              <div style={styles.airportDetails}>
                {cargo.destination_city}, {cargo.destination_country}
              </div>
            </div>
          </div>
        </AestheticCard>

        {/* Cargo Details */}
        <AestheticCard>
          <h2 style={styles.sectionTitle}>📦 Cargo Details</h2>
          <div style={styles.editableContent}>
            {editing ? (
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <label style={styles.infoLabel}>Cargo Type</label>
                  <select
                    value={editData.cargo_type || ""}
                    onChange={(e) => handleEditChange("cargo_type", e.target.value)}
                    style={styles.editInput}
                  >
                    <option value="General">General</option>
                    <option value="Perishable">Perishable</option>
                    <option value="Hazardous">Hazardous</option>
                    <option value="Fragile">Fragile</option>
                    <option value="Live Animals">Live Animals</option>
                    <option value="Mail">Mail</option>
                  </select>
                </div>
                <div style={styles.infoItem}>
                  <label style={styles.infoLabel}>Weight (kg)</label>
                  <input
                    type="number"
                    value={editData.weight_kg || ""}
                    onChange={(e) => handleEditChange("weight_kg", parseFloat(e.target.value))}
                    step="0.01"
                    min="0.01"
                    style={styles.editInput}
                  />
                </div>
              </div>
            ) : (
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>Cargo Type</div>
                  <div style={styles.infoValue}>{cargo.cargo_type}</div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>Weight</div>
                  <div style={styles.infoValue}>{cargo.weight_kg} kg</div>
                </div>
              </div>
            )}
            {cargo.description && (
              <div style={styles.descriptionBox}>
                <div style={styles.infoLabel}>Description</div>
                <div style={styles.infoValue}>{cargo.description}</div>
              </div>
            )}
          </div>
        </AestheticCard>

        {/* Sender Information */}
        <AestheticCard>
          <h2 style={styles.sectionTitle}>👤 Sender Information</h2>
          <div style={styles.editableContent}>
            {editing ? (
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <label style={styles.infoLabel}>Name</label>
                  <input
                    type="text"
                    value={editData.sender_name || ""}
                    onChange={(e) => handleEditChange("sender_name", e.target.value)}
                    style={styles.editInput}
                    maxLength={50}
                  />
                </div>
                <div style={styles.infoItem}>
                  <label style={styles.infoLabel}>Contact</label>
                  <input
                    type="text"
                    value={editData.sender_contact || ""}
                    onChange={(e) => handleEditChange("sender_contact", e.target.value)}
                    style={styles.editInput}
                    maxLength={50}
                  />
                </div>
              </div>
            ) : (
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>Name</div>
                  <div style={styles.infoValue}>{cargo.sender_name}</div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>Contact</div>
                  <div style={styles.infoValue}>{cargo.sender_contact}</div>
                </div>
              </div>
            )}
          </div>
        </AestheticCard>

        {/* Receiver Information */}
        <AestheticCard>
          <h2 style={styles.sectionTitle}>👤 Receiver Information</h2>
          <div style={styles.editableContent}>
            {editing ? (
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <label style={styles.infoLabel}>Name</label>
                  <input
                    type="text"
                    value={editData.reciever_name || ""}
                    onChange={(e) => handleEditChange("reciever_name", e.target.value)}
                    style={styles.editInput}
                    maxLength={50}
                  />
                </div>
                <div style={styles.infoItem}>
                  <label style={styles.infoLabel}>Contact</label>
                  <input
                    type="text"
                    value={editData.reciever_contact || ""}
                    onChange={(e) => handleEditChange("reciever_contact", e.target.value)}
                    style={styles.editInput}
                    maxLength={50}
                  />
                </div>
              </div>
            ) : (
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>Name</div>
                  <div style={styles.infoValue}>{cargo.reciever_name}</div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>Contact</div>
                  <div style={styles.infoValue}>{cargo.reciever_contact}</div>
                </div>
              </div>
            )}
          </div>
        </AestheticCard>
      </div>
    </div>
  );
}

function AestheticCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(110deg, #1e293b 70%, #2563eb18 100%)",
        borderRadius: 14,
        padding: 22,
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
    fontSize: 16,
    fontWeight: 700,
    background: bg,
    color,
    borderRadius: 8,
    padding: "8px 14px",
    display: "inline-block",
    textTransform: "capitalize" as const,
  };
}

function typeTagLarge(type: string) {
  return {
    fontSize: 16,
    fontWeight: 700,
    background: "#2563eb28",
    color: "#60a5fa",
    borderRadius: 8,
    padding: "8px 14px",
    display: "inline-block",
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
    maxWidth: 1000,
    margin: "0 auto",
    padding: "32px 10px 50px 10px",
    minHeight: "100vh",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#60a5fa",
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
    marginBottom: 12,
    padding: 0,
  },
  headerRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 24,
    flexWrap: "wrap",
  },
  h1: {
    margin: 0,
    fontSize: 32,
    fontWeight: 800,
    color: "#93c5fd",
    letterSpacing: 0.6,
  },
  subtitle: {
    margin: "8px 0 0 0",
    fontSize: 16,
    color: "#64748b",
    fontWeight: 500,
  },
  actionButtons: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  editBtn: {
    border: "1.5px solid #2563eb",
    padding: "10px 16px",
    background: "transparent",
    color: "#60a5fa",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  saveBtn: {
    border: "none",
    padding: "10px 16px",
    background: "#10b981",
    color: "#fff",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  cancelEditBtn: {
    border: "1.5px solid #64748b",
    padding: "10px 16px",
    background: "transparent",
    color: "#cbd5e1",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  deleteBtn: {
    border: "none",
    padding: "10px 16px",
    background: "#ef4444",
    color: "#fff",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  sectionTitle: {
    margin: "0 0 16px 0",
    fontSize: 18,
    fontWeight: 700,
    color: "#93c5fd",
  },
  statusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 16,
  },
  statusItem: {
    textAlign: "center",
  },
  statusLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
    marginBottom: 6,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: 700,
    color: "#cbd5e1",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  },
  infoItem: {
    display: "flex",
    flexDirection: "column",
  },
  infoLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: 600,
    color: "#cbd5e1",
  },
  editableContent: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  editInput: {
    padding: "8px 10px",
    background: "#1e293b",
    border: "1.5px solid #2563eb33",
    borderRadius: 6,
    color: "#e6eefb",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
  },
  descriptionBox: {
    padding: 12,
    background: "#1e293b44",
    borderRadius: 8,
    marginTop: 12,
  },
  routeContainer: {
    display: "flex",
    alignItems: "center",
    gap: 20,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  airportBox: {
    textAlign: "center",
    padding: 16,
    background: "#1e293b44",
    borderRadius: 8,
  },
  airportCode: {
    fontSize: 24,
    fontWeight: 800,
    color: "#60a5fa",
  },
  airportName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#cbd5e1",
    marginTop: 4,
  },
  airportDetails: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  arrow: {
    fontSize: 28,
    fontWeight: 800,
    color: "#2563eb",
  },
  successBox: {
    background: "#064e3b",
    border: "1px solid #10b981",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    color: "#86efac",
    fontSize: 14,
    fontWeight: 600,
  },
  errorBox: {
    background: "#7f1d1d",
    border: "1px solid #dc2626",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
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
};