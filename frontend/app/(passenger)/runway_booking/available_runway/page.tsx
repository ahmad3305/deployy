"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { API_BASE } from "@/app/config";

type Runway = {
  runway_id: number;
  airport_id: number;
  runway_code: string;
  length: number;
  status: string;
};

type Airport = {
  airport_id: number;
  airport_name: string;
  airport_code: string;
  city: string;
  country: string;
};

async function fetchJson(url: string, options?: RequestInit) {
  try {
    console.log(`[FETCH] URL: ${url}`);
    const res = await fetch(url, options);
    const text = await res.text();

    console.log(`[FETCH] Status: ${res.status}`);
    console.log(`[FETCH] Response (first 800 chars): ${text.substring(0, 800)}`);

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Non-JSON response from ${url}`);
    }

    if (!res.ok) {
      throw new Error(json?.message || `Request failed (${res.status})`);
    }

    return json;
  } catch (err) {
    console.error(`[FETCH ERROR] ${url}:`, err);
    throw err;
  }
}

export default function AvailableRunwayPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [airports, setAirports] = useState<Airport[]>([]);
  const [availableRunways, setAvailableRunways] = useState<Runway[]>([]);

  const [selectedAirport, setSelectedAirport] = useState<string>("");
  const [selectedRunway, setSelectedRunway] = useState<string>("");
  const [bookingDate, setBookingDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // Fetch airports on mount
  useEffect(() => {
    async function getAirports() {
      try {
        console.log("Fetching airports...");
        const resp = await fetchJson(`${API_BASE}/airports`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });

        console.log("Airports response:", resp);

        // Handle both response formats
        let airportList: Airport[] = [];
        if (Array.isArray(resp?.data)) {
          airportList = resp.data;
        } else if (Array.isArray(resp)) {
          airportList = resp;
        }

        console.log("Parsed airports:", airportList);

        if (airportList.length === 0) {
          setError("No airports available");
          setAirports([]);
        } else {
          setAirports(airportList);
          setError("");
        }
      } catch (err: any) {
        console.error("Error fetching airports:", err);
        setError(err?.message || "Failed to load airports");
        setAirports([]);
      } finally {
        setLoading(false);
      }
    }

    getAirports();
  }, []);

    // Fetch available runways when filters change
  const handleCheckAvailability = async () => {
    if (!selectedAirport || !bookingDate || !startTime || !endTime) {
      setError("Please fill in all fields");
      return;
    }

    if (startTime >= endTime) {
      setError("Start time must be before end time");
      return;
    }

    try {
      setSearching(true);
      setError("");
      setSelectedRunway(""); // Reset selected runway

      // Format times as HH:MM:SS
      const startTimeFormatted = `${startTime}:00`;
      const endTimeFormatted = `${endTime}:00`;

      const airportId = parseInt(selectedAirport, 10);

      console.log("Checking availability with params:", {
        airport_id: airportId,
        booking_date: bookingDate,
        start_time: startTimeFormatted,
        end_time: endTimeFormatted,
      });

      const resp = await fetchJson(
        `${API_BASE}/runway-booking/availability?` +
          `airport_id=${airportId}&` +
          `booking_date=${bookingDate}&` +
          `start_time=${encodeURIComponent(startTimeFormatted)}&` +
          `end_time=${encodeURIComponent(endTimeFormatted)}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );

      console.log("Availability response:", resp);

      if (resp.data === false) {
        setAvailableRunways([]);
        setError("No runways available for the selected time slot");
      } else {
        let runways: Runway[] = [];
        if (Array.isArray(resp?.data)) {
          runways = resp.data;
        } else if (Array.isArray(resp)) {
          runways = resp;
        }

        console.log("Available runways:", runways);

        if (runways.length === 0) {
          setError("No runways available for the selected time slot");
          setAvailableRunways([]);
        } else {
          setAvailableRunways(runways);
          setError("");
        }
      }
    } catch (err: any) {
      console.error("Error checking availability:", err);
      setError(err?.message || "Failed to check runway availability");
      setAvailableRunways([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectRunway = () => {
    if (!selectedRunway) {
      setError("Please select a runway");
      return;
    }

    const selected = availableRunways.find(r => r.runway_id === parseInt(selectedRunway));
    if (!selected) {
      setError("Selected runway not found");
      return;
    }

    // Store booking details in session storage
    sessionStorage.setItem(
      "runwayBookingData",
      JSON.stringify({
        runway_id: parseInt(selectedRunway),
        airport_id: parseInt(selectedAirport),
        booking_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        runway_code: selected.runway_code,
      })
    );

    router.push("/runway_booking/aircraft_details");
  };

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  if (loading) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner}>Loading airports...</div>
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
          <h1 style={styles.title}>🛫 Select Available Runway</h1>
          <div />
        </div>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Search Runway Availability</h2>

          <div style={styles.grid}>
            {/* Airport Selection */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Select Airport</label>
              <select
                style={styles.select}
                value={selectedAirport}
                onChange={(e) => {
                  setSelectedAirport(e.target.value);
                  setAvailableRunways([]);
                  setSelectedRunway("");
                  setError("");
                }}
              >
                <option value="">-- Choose an airport --</option>
                {airports.map((airport) => (
                  <option key={airport.airport_id} value={airport.airport_id}>
                    {airport.airport_code} - {airport.airport_name} ({airport.city}, {airport.country})
                  </option>
                ))}
              </select>
              {airports.length === 0 && (
                <div style={{ fontSize: 12, color: "#f97316", marginTop: 4 }}>
                  No airports available
                </div>
              )}
            </div>

            {/* Booking Date */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Booking Date</label>
              <input
                type="date"
                style={styles.input}
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                min={getTodayDate()}
              />
            </div>

            {/* Start Time */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Start Time</label>
              <input
                type="time"
                style={styles.input}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>

            {/* End Time */}
            <div style={styles.formGroup}>
              <label style={styles.label}>End Time</label>
              <input
                type="time"
                style={styles.input}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <button 
            style={searching ? { ...styles.searchBtn, opacity: 0.6 } : styles.searchBtn} 
            onClick={handleCheckAvailability} 
            disabled={searching}
          >
            {searching ? "Searching..." : "Check Availability"}
          </button>
        </section>

        {/* Available Runways */}
        {availableRunways.length > 0 && (
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Available Runways ({availableRunways.length})</h2>
            <div style={styles.runwayGrid}>
              {availableRunways.map((runway) => (
                <div
                  key={runway.runway_id}
                  style={{
                    ...styles.runwayCard,
                    ...(selectedRunway === String(runway.runway_id)
                      ? styles.runwayCardSelected
                      : {}),
                  }}
                  onClick={() => setSelectedRunway(String(runway.runway_id))}
                >
                  <div style={styles.runwayCode}>{runway.runway_code}</div>
                  <div style={styles.runwayDetail}>Length: {runway.length}m</div>
                  <div style={styles.runwayDetail}>Status: {runway.status}</div>
                  <input
                    type="radio"
                    name="runway"
                    value={runway.runway_id}
                    checked={selectedRunway === String(runway.runway_id)}
                    onChange={() => setSelectedRunway(String(runway.runway_id))}
                    style={{ marginTop: 12 }}
                  />
                </div>
              ))}
            </div>

            <button style={styles.continueBtn} onClick={handleSelectRunway}>
              Continue with Selected Runway
            </button>
          </section>
        )}

        {/* Error Message */}
        {error && (
          <section style={{ ...styles.card, background: "#7f1d1d", border: "1px solid #991b1b" }}>
            <div style={{ color: "#fca5a5", fontSize: 14 }}>
              <strong>Error:</strong> {error}
            </div>
          </section>
        )}
      </div>
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
    marginBottom: 16,
  },
  formGroup: {
    display: "flex",
    flexDirection: "column" as const,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#cbd5e1",
    marginBottom: 8,
  },
  select: {
    background: "#0b1220",
    color: "#e2e8f0",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    fontWeight: 500,
  },
  input: {
    background: "#0b1220",
    color: "#e2e8f0",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
  },
  searchBtn: {
    border: "none",
    background: "linear-gradient(90deg,#2563eb 80%,#0ea5e9)",
    color: "#fff",
    borderRadius: 10,
    padding: "12px 24px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 16,
  },
  runwayGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 14,
    marginBottom: 16,
  },
  runwayCard: {
    background: "#0b1220",
    border: "2px solid #334155",
    borderRadius: 10,
    padding: 16,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  runwayCardSelected: {
    background: "#1e3a5f",
    border: "2px solid #2563eb",
  },
  runwayCode: {
    fontSize: 18,
    fontWeight: 700,
    color: "#60a5fa",
    marginBottom: 8,
  },
  runwayDetail: {
    fontSize: 13,
    color: "#cbd5e1",
    marginBottom: 6,
  },
  continueBtn: {
    border: "none",
    background: "linear-gradient(90deg,#22c55e 80%,#16a34a)",
    color: "#fff",
    borderRadius: 10,
    padding: "12px 24px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 16,
    width: "100%",
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