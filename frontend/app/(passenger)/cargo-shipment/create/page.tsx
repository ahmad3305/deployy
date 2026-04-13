"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { API_BASE } from "@/app/config";

type Airport = {
  airport_id: number;
  airport_name: string;
  airport_code: string;
  city: string;
};

type Flight = {
  flight_id: number;
  flight_number: string;
  airline_name: string;
  source_airport_name: string;
  destination_airport_name: string;
  departure_datetime: string;
};

const generateTrackingNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `TRK${timestamp}${random}`.substring(0, 10);
};

export default function CreateCargoPage() {
  const [formData, setFormData] = useState({
    flight_id: "",
    tracking_number: generateTrackingNumber(),
    cargo_type: "General",
    description: "",
    weight_kg: "",
    origin_airport_id: "",
    destination_airport_id: "",
    reciever_name: "",
    reciever_contact: "",
    is_insured: false,
  });

  const [airports, setAirports] = useState<Airport[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loadingAirports, setLoadingAirports] = useState(true);
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    if (storedUser) setUser(JSON.parse(storedUser));
    else router.push("/login");
    
    fetchAirports();
  }, [router]);

  const fetchAirports = async () => {
    try {
      setLoadingAirports(true);
      const res = await fetch(`${API_BASE}/airports`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      setAirports(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error("Error fetching airports:", err);
      setError("Failed to load airports");
    } finally {
      setLoadingAirports(false);
    }
  };

  const fetchFlights = async (originId: number, destId: number) => {
    if (!originId || !destId || originId === destId) {
      setFlights([]);
      return;
    }

    try {
      setLoadingFlights(true);
      const res = await fetch(
        `${API_BASE}/flights?source_airport_id=${originId}&destination_airport_id=${destId}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );
      const data = await res.json();
      setFlights(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error("Error fetching flights:", err);
      setFlights([]);
    } finally {
      setLoadingFlights(false);
    }
  };

  const handleAirportChange = (field: string, value: string) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);

    if (
      newData.origin_airport_id &&
      newData.destination_airport_id &&
      newData.origin_airport_id !== newData.destination_airport_id
    ) {
      fetchFlights(
        parseInt(newData.origin_airport_id),
        parseInt(newData.destination_airport_id)
      );
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target as any;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    });
  };

  const handleGenerateNew = () => {
    setFormData({
      ...formData,
      tracking_number: generateTrackingNumber(),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.flight_id) {
      setError("Please select a flight");
      return;
    }
    if (!formData.weight_kg || parseFloat(formData.weight_kg) <= 0) {
      setError("Weight must be greater than 0");
      return;
    }
    if (!formData.reciever_name.trim()) {
      setError("Receiver name is required");
      return;
    }
    if (!formData.reciever_contact.trim()) {
      setError("Receiver contact is required");
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        flight_id: parseInt(formData.flight_id),
        tracking_number: formData.tracking_number,
        cargo_type: formData.cargo_type,
        description: formData.description || null,
        weight_kg: parseFloat(formData.weight_kg),
        origin_airport_id: parseInt(formData.origin_airport_id),
        destination_airport_id: parseInt(formData.destination_airport_id),
        reciever_name: formData.reciever_name,
        reciever_contact: formData.reciever_contact,
        is_insured: formData.is_insured,
      };

      const res = await fetch(`${API_BASE}/cargo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to create shipment");
        return;
      }

      setSuccess("Shipment created successfully!");
      setTimeout(() => {
        router.push(`/cargo-shipment/${data.data.cargo_id}`);
      }, 1500);
    } catch (err: any) {
      console.error("Error creating shipment:", err);
      setError(err.message || "Failed to create shipment");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <button
          style={styles.backBtn}
          onClick={() => router.back()}
        >
          ← Back
        </button>

        <h1 style={styles.h1}>📦 Create Cargo Shipment</h1>

        <AestheticCard noPad>
          <form onSubmit={handleSubmit} style={styles.form}>
            {error && <div style={styles.errorBox}>{error}</div>}
            {success && <div style={styles.successBox}>{success}</div>}

            {/* Sender Info - Auto-filled */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>👤 Your Information (Sender)</h2>
              <div style={styles.infoBox}>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Email:</span>
                  <span style={styles.infoValue}>{user.email}</span>
                </div>
                <div style={styles.infoText}>
                  Your details will be automatically associated with this shipment.
                </div>
              </div>
            </div>

            {/* Section 1: Airports & Flight */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Route & Flight</h2>

              <div style={styles.formGroup}>
                <label style={styles.label}>Origin Airport *</label>
                <select
                  name="origin_airport_id"
                  value={formData.origin_airport_id}
                  onChange={(e) => handleAirportChange("origin_airport_id", e.target.value)}
                  style={styles.input}
                  disabled={loadingAirports}
                >
                  <option value="">Select origin airport...</option>
                  {airports.map((airport) => (
                    <option key={airport.airport_id} value={airport.airport_id}>
                      {airport.airport_code} - {airport.airport_name} ({airport.city})
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Destination Airport *</label>
                <select
                  name="destination_airport_id"
                  value={formData.destination_airport_id}
                  onChange={(e) => handleAirportChange("destination_airport_id", e.target.value)}
                  style={styles.input}
                  disabled={loadingAirports}
                >
                  <option value="">Select destination airport...</option>
                  {airports.map((airport) => (
                    <option key={airport.airport_id} value={airport.airport_id}>
                      {airport.airport_code} - {airport.airport_name} ({airport.city})
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Flight *</label>
                <select
                  name="flight_id"
                  value={formData.flight_id}
                  onChange={handleChange}
                  style={styles.input}
                  disabled={!formData.origin_airport_id || !formData.destination_airport_id || loadingFlights}
                >
                  <option value="">
                    {loadingFlights ? "Loading flights..." : "Select a flight..."}
                  </option>
                  {flights.map((flight) => (
                    <option key={flight.flight_id} value={flight.flight_id}>
                      {flight.flight_number} - {flight.airline_name} (
                      {new Date(flight.departure_datetime).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Section 2: Cargo Details */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Cargo Details</h2>

              <div style={styles.formGroup}>
                <label style={styles.label}>Tracking Number *</label>
                <div style={styles.trackingRow}>
                  <input
                    type="text"
                    name="tracking_number"
                    value={formData.tracking_number}
                    readOnly
                    style={{ ...styles.input, ...styles.trackingInput }}
                    title="Auto-generated tracking number"
                  />
                  <button
                    type="button"
                    style={styles.regenerateBtn}
                    onClick={handleGenerateNew}
                    title="Generate a new tracking number"
                  >
                    🔄 New
                  </button>
                </div>
                <div style={styles.trackingHint}>
                  Auto-generated unique tracking number. Click "New" to regenerate.
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Cargo Type *</label>
                <select
                  name="cargo_type"
                  value={formData.cargo_type}
                  onChange={handleChange}
                  style={styles.input}
                >
                  <option value="General">General</option>
                  <option value="Perishable">Perishable</option>
                  <option value="Hazardous">Hazardous</option>
                  <option value="Fragile">Fragile</option>
                  <option value="Live Animals">Live Animals</option>
                  <option value="Mail">Mail</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Weight (kg) *</label>
                <input
                  type="number"
                  name="weight_kg"
                  value={formData.weight_kg}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Item description (optional)"
                  style={{ ...styles.input, minHeight: 80, resize: "vertical" }}
                />
              </div>

              <div style={styles.checkboxGroup}>
                <input
                  type="checkbox"
                  name="is_insured"
                  checked={formData.is_insured}
                  onChange={handleChange}
                  style={styles.checkbox}
                />
                <label style={styles.checkboxLabel}>Add Insurance</label>
              </div>
            </div>

            {/* Section 3: Receiver Info */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>📤 Receiver Information</h2>

              <div style={styles.formGroup}>
                <label style={styles.label}>Name *</label>
                <input
                  type="text"
                  name="reciever_name"
                  value={formData.reciever_name}
                  onChange={handleChange}
                  placeholder="Full name"
                  style={styles.input}
                  maxLength={50}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Contact *</label>
                <input
                  type="text"
                  name="reciever_contact"
                  value={formData.reciever_contact}
                  onChange={handleChange}
                  placeholder="Phone or email"
                  style={styles.input}
                  maxLength={50}
                />
              </div>
            </div>

            {/* Submit */}
            <div style={styles.formActions}>
              <button
                type="button"
                style={styles.cancelBtn}
                onClick={() => router.back()}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={styles.submitBtn}
                disabled={submitting}
              >
                {submitting ? "Creating..." : "Create Shipment"}
              </button>
            </div>
          </form>
        </AestheticCard>
      </div>
    </div>
  );
}

function AestheticCard({
  children,
  noPad,
}: {
  children: React.ReactNode;
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
    maxWidth: 800,
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
  h1: {
    margin: "0 0 24px 0",
    fontSize: 32,
    fontWeight: 800,
    color: "#93c5fd",
    letterSpacing: 0.6,
    textShadow: "0 2px 16px #1e293b33",
  },
  form: {
    padding: 22,
  },
  section: {
    marginBottom: 28,
    paddingBottom: 28,
    borderBottom: "1px solid #2563eb22",
  },
  sectionTitle: {
    margin: "0 0 16px 0",
    fontSize: 18,
    fontWeight: 700,
    color: "#93c5fd",
  },
  infoBox: {
    padding: 16,
    background: "#1e293b44",
    borderRadius: 8,
    border: "1px solid #2563eb22",
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: "#64748b",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: 700,
    color: "#cbd5e1",
  },
  infoText: {
    fontSize: 12,
    color: "#64748b",
    fontStyle: "italic",
    marginTop: 8,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    display: "block",
    marginBottom: 6,
    fontSize: 14,
    fontWeight: 600,
    color: "#cbd5e1",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    background: "#1e293b",
    border: "1.5px solid #2563eb33",
    borderRadius: 8,
    color: "#e6eefb",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  },
  trackingRow: {
    display: "flex",
    gap: 8,
  },
  trackingInput: {
    flex: 1,
    cursor: "not-allowed",
    opacity: 0.8,
  },
  regenerateBtn: {
    border: "1.5px solid #2563eb33",
    padding: "10px 12px",
    background: "transparent",
    color: "#60a5fa",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  trackingHint: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 6,
    fontStyle: "italic",
  },
  checkboxGroup: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    cursor: "pointer",
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: 500,
    color: "#cbd5e1",
    cursor: "pointer",
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
  formActions: {
    display: "flex",
    gap: 12,
    justifyContent: "flex-end",
    marginTop: 28,
  },
  submitBtn: {
    border: "none",
    padding: "12px 24px",
    background: "linear-gradient(80deg,#2563eb 70%,#60a5fa)",
    color: "#fff",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    boxShadow: "0 2px 12px #2563eb44",
  },
  cancelBtn: {
    border: "1.5px solid #2563eb33",
    padding: "12px 24px",
    background: "transparent",
    color: "#cbd5e1",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  },
};