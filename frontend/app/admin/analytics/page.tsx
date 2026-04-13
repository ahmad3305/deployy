"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/app/config";
import dynamic from "next/dynamic";

const ResponsiveBar = dynamic(() => import("@nivo/bar").then(m => m.ResponsiveBar), { ssr: false });
const ResponsivePie = dynamic(() => import("@nivo/pie").then(m => m.ResponsivePie), { ssr: false });
const ResponsiveLine = dynamic(() => import("@nivo/line").then(m => m.ResponsiveLine), { ssr: false });

type FlightSchedule = {
  flight_schedule_id: number;
  departure_datetime: string;
  arrival_datetime: string;
  flight_status: string;
  flight_id: number;
  aircraft_id: number;
};

type FlightRow = {
  flight_id: number;
  flight_type: string;
  source_airport_id: number;
  destination_airport_id: number;
};

type Aircraft = {
  aircraft_id: number;
  registration_number: string;
};

type Airport = {
  airport_id: number;
  airport_code: string;
};

export default function AnalyticsAdminPage() {
  const [schedules, setSchedules] = useState<FlightSchedule[]>([]);
  const [flights, setFlights] = useState<FlightRow[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();

  // Check auth on mount
  useEffect(() => {
    const user = typeof window !== "undefined" ? sessionStorage.getItem("user") : null;
    console.log("Checking admin auth for analytics, user:", user);

    if (!user) {
      console.log("No user found, redirecting to login");
      router.push("/login");
      return;
    }

    try {
      const parsed = JSON.parse(user);
      console.log("User role:", parsed.role);

      if (parsed.role !== "Admin") {
        console.log("User is not Admin, redirecting to login");
        router.push("/login");
        return;
      }

      setIsAuthorized(true);
    } catch (err) {
      console.error("Error parsing user:", err);
      router.push("/login");
    }
  }, [router]);

  // Fetch analytics data only if authorized
  useEffect(() => {
    if (!isAuthorized) return;

    async function fetchEverything() {
      try {
        setLoading(true);
        const token = sessionStorage.getItem("token") || "";

        if (!token) {
          throw new Error("No authentication token found");
        }

        console.log("Fetching analytics data with token:", token.substring(0, 20) + "...");

        const endpoints = [
          { name: "flight-schedules", url: `${API_BASE}/flight-schedules` },
          { name: "flights", url: `${API_BASE}/flights` },
          { name: "aircraft", url: `${API_BASE}/aircraft` },
          { name: "airports", url: `${API_BASE}/airports` },
        ];

        const responses: any = {};

        for (const endpoint of endpoints) {
          try {
            console.log(`Fetching ${endpoint.name} from ${endpoint.url}`);
            const res = await fetch(endpoint.url, {
              headers: { Authorization: `Bearer ${token}` },
            });

            console.log(`${endpoint.name} status:`, res.status);

            if (!res.ok) {
              const text = await res.text();
              console.error(`${endpoint.name} error response:`, text);
              throw new Error(`${endpoint.name}: HTTP ${res.status}`);
            }

            const json = await res.json();
            responses[endpoint.name] = json;
          } catch (err: any) {
            console.error(`Error fetching ${endpoint.name}:`, err);
            throw err;
          }
        }

        const schedulesData = Array.isArray(responses["flight-schedules"]?.data) ? responses["flight-schedules"].data : [];
        console.log("Schedules data sample:", schedulesData[0]);
        console.log("Flight statuses:", schedulesData.map((s: any) => s.flight_status));

        setSchedules(schedulesData);
        setFlights(Array.isArray(responses.flights?.data) ? responses.flights.data : []);
        setAircraft(Array.isArray(responses.aircraft?.data) ? responses.aircraft.data : []);
        setAirports(Array.isArray(responses.airports?.data) ? responses.airports.data : []);
      } catch (e: any) {
        console.error("Fetch analytics error:", e);
        setError(e.message || "Failed to load analytics data.");
      } finally {
        setLoading(false);
      }
    }

    fetchEverything();
  }, [isAuthorized]);

  const flightsPerDay = useMemo(() => {
    const days: Record<string, number> = {};
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days[key] = 0;
    }
    for (const s of schedules) {
      if (!s.departure_datetime) continue;
      const date = s.departure_datetime.slice(0, 10);
      if (date in days) days[date]++;
    }
    return Object.entries(days).map(([x, y]) => ({ x, y }));
  }, [schedules]);

  const statusData = useMemo(() => {
    const map: Record<string, number> = {};

    for (const s of schedules) {
      const status = (s.flight_status || "Unknown").trim();
      map[status] = (map[status] || 0) + 1;
    }

    console.log("Status breakdown:", map);

    return Object.entries(map)
      .filter(([_, v]) => v > 0)
      .map(([id, value]) => ({ id, value }));
  }, [schedules]);

  const aircraftMap: Record<number, Aircraft> = useMemo(
    () => Object.fromEntries(aircraft.map(a => [a.aircraft_id, a])),
    [aircraft]
  );

  const topAircraft = useMemo(() => {
    const done: Record<number, number> = {};
    for (const s of schedules) {
      if ((s.flight_status || "").toLowerCase() === "completed") {
        done[s.aircraft_id] = (done[s.aircraft_id] || 0) + 1;
      }
    }
    return Object.entries(done)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([aircraft_id, count]) => ({
        id: aircraftMap[Number(aircraft_id)]?.registration_number || `Aircraft ${aircraft_id}`,
        "Completed Flights": count,
      }));
  }, [schedules, aircraftMap]);

  const airportMap: Record<number, string> = useMemo(
    () => Object.fromEntries(airports.map(a => [a.airport_id, a.airport_code])),
    [airports]
  );

  const routeFreq = useMemo(() => {
    const flightMap = Object.fromEntries(flights.map(f => [f.flight_id, f]));
    const freq: Record<string, number> = {};
    for (const s of schedules) {
      const flight = flightMap[s.flight_id];
      if (!flight) continue;
      const src = airportMap[flight.source_airport_id] || `AP${flight.source_airport_id}`;
      const dst = airportMap[flight.destination_airport_id] || `AP${flight.destination_airport_id}`;
      const routeKey = `${src} → ${dst}`;
      freq[routeKey] = (freq[routeKey] || 0) + 1;
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([route, y]) => ({ route, "Frequency": y }));
  }, [schedules, flights, airportMap]);

  const flightTypeBreakdown = useMemo(() => {
    const count: Record<string, number> = {};
    for (const f of flights) {
      const type = f.flight_type || "Unknown";
      count[type] = (count[type] || 0) + 1;
    }
    return Object.entries(count).map(([type, val]) => ({
      type,
      "Count": val,
    }));
  }, [flights]);

  if (!isAuthorized) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner}>Checking authorization...</div>
      </div>
    );
  }

  return (
    <div style={styles.bg}>
      <div style={styles.shell}>
        <div style={styles.headerTop}>
          <button
            style={styles.backBtn}
            onClick={() => router.push("/admin/dashboard")}
            aria-label="Back to dashboard"
          >
            ← Back
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={styles.title}>📊 Analytics Dashboard</h1>
            <p style={styles.subtitle}>
              Advanced visualization of airport data. All insights here are extracted live from your database.
            </p>
          </div>
        </div>

        {loading ? (
          <div style={styles.loading}>Loading analytics...</div>
        ) : error ? (
          <div style={styles.error}>{error}</div>
        ) : (
          <div style={styles.chartsGrid}>
            <div style={styles.chartCard}>
              <h2 style={styles.sectionTitle}>📈 Flights Per Day (Last 30 Days)</h2>
              <div style={{ height: 260 }}>
                <ResponsiveLine
                  data={[{ id: "Flights", color: "#0ea5e9", data: flightsPerDay }]}
                  margin={{ top: 24, right: 30, bottom: 40, left: 45 }}
                  xScale={{ type: "point" }}
                  yScale={{ type: "linear", min: 0, max: "auto", stacked: false, reverse: false }}
                  axisBottom={{
                    tickSize: 6,
                    tickPadding: 5,
                    rotate: -36,
                    legend: "Date",
                    legendOffset: 38,
                    legendPosition: "middle",
                  }}
                  axisLeft={{
                    tickSize: 6,
                    tickPadding: 5,
                    legend: "Flights",
                    legendOffset: -38,
                    legendPosition: "middle",
                  }}
                  lineWidth={3}
                  colors={{ datum: "color" }}
                  pointSize={10}
                  pointColor={"#2563eb"}
                  pointBorderWidth={2}
                  pointBorderColor={{ from: "serieColor" }}
                  useMesh
                  theme={nivoTheme}
                />
              </div>
            </div>

            <div style={styles.chartCard}>
              <h2 style={styles.sectionTitle}>🎯 Flight Status Distribution</h2>
              <div style={{ height: 250, maxWidth: 420, margin: "0 auto" }}>
                {statusData.length > 0 ? (
                  <ResponsivePie
                    data={statusData}
                    theme={nivoTheme}
                    margin={{ top: 20, right: 20, bottom: 35, left: 20 }}
                    innerRadius={0.5}
                    padAngle={1.8}
                    activeOuterRadiusOffset={8}
                    colors={["#0ea5e9", "#84cc16", "#fbbf24", "#f87171", "#475569", "#86efac", "#c4b5fd"]}
                    borderWidth={2}
                    borderColor="#23304a"
                    enableArcLinkLabels={false}
                    legends={[
                      {
                        anchor: "bottom",
                        direction: "row",
                        justify: false,
                        translateY: 41,
                        itemWidth: 98,
                        itemHeight: 15,
                        itemsSpacing: 0,
                        symbolSize: 9,
                        symbolShape: "circle",
                      },
                    ]}
                  />
                ) : (
                  <div style={{ textAlign: "center", color: "#93c5fd", paddingTop: 80 }}>No data available</div>
                )}
              </div>
            </div>

            <div style={styles.chartCard}>
              <h2 style={styles.sectionTitle}>✈️ Top Aircraft (by Completed Flights)</h2>
              <div style={{ height: 250 }}>
                {topAircraft.length > 0 ? (
                  <ResponsiveBar
                    data={topAircraft}
                    keys={["Completed Flights"]}
                    indexBy="id"
                    margin={{ top: 20, right: 18, bottom: 38, left: 64 }}
                    theme={nivoTheme}
                    padding={0.24}
                    colors={["#2563eb"]}
                    axisBottom={{ legend: "Aircraft", legendPosition: "middle", legendOffset: 32 }}
                    axisLeft={{ legend: "Flights", legendPosition: "middle", legendOffset: -38 }}
                  />
                ) : (
                  <div style={{ textAlign: "center", color: "#93c5fd", paddingTop: 100 }}>No completed flights</div>
                )}
              </div>
            </div>

            <div style={styles.chartCard}>
              <h2 style={styles.sectionTitle}>🌍 Top Routes</h2>
              <div style={{ height: 250 }}>
                {routeFreq.length > 0 ? (
                  <ResponsiveBar
                    data={routeFreq}
                    keys={["Frequency"]}
                    indexBy="route"
                    margin={{ top: 20, right: 18, bottom: 62, left: 80 }}
                    theme={nivoTheme}
                    padding={0.22}
                    colors={["#38bdf8"]}
                    axisBottom={{
                      legend: "Route",
                      legendPosition: "middle",
                      legendOffset: 42,
                      tickRotation: -32,
                    }}
                    axisLeft={{ legend: "Frequency", legendPosition: "middle", legendOffset: -38 }}
                  />
                ) : (
                  <div style={{ textAlign: "center", color: "#93c5fd", paddingTop: 100 }}>No route data</div>
                )}
              </div>
            </div>

            <div style={styles.chartCard}>
              <h2 style={styles.sectionTitle}>🛫 Flight Type Breakdown</h2>
              <div style={{ height: 210, marginTop: 10 }}>
                {flightTypeBreakdown.length > 0 ? (
                  <ResponsiveBar
                    data={flightTypeBreakdown}
                    keys={["Count"]}
                    indexBy="type"
                    margin={{ top: 20, right: 16, bottom: 36, left: 63 }}
                    theme={nivoTheme}
                    padding={0.22}
                    colors={["#c026d3"]}
                    axisBottom={{
                      legend: "Flight Type",
                      legendPosition: "middle",
                      legendOffset: 26,
                    }}
                    axisLeft={{ legend: "Count", legendPosition: "middle", legendOffset: -38 }}
                  />
                ) : (
                  <div style={{ textAlign: "center", color: "#93c5fd", paddingTop: 80 }}>No flight type data</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
  bg: {
    minHeight: "100vh",
    width: "100vw",
    background: "linear-gradient(140deg, #1e293b 70%, #2563eb 130%)",
    color: "#e6eefb",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    padding: 0,
  },
  shell: {
    maxWidth: 1320,
    margin: "0 auto",
    padding: "40px 18px 55px 18px",
    minHeight: "100vh",
  },
  headerTop: {
    display: "flex",
    alignItems: "flex-start",
    gap: 20,
    marginBottom: 32,
    paddingBottom: 24,
    borderBottom: "1.5px solid #2563eb33",
  },
  backBtn: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    padding: "12px 20px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 2px 8px #2563eb44",
    transition: "all 0.2s",
    whiteSpace: "nowrap",
    minWidth: 120,
    marginTop: 2,
  },
  title: {
    fontSize: 32,
    fontWeight: 800,
    color: "#60a5fa",
    marginBottom: 8,
    background: "none",
    letterSpacing: 0.7,
    margin: 0,
  },
  subtitle: {
    color: "#93c5fd",
    fontSize: 17,
    marginBottom: 0,
    marginTop: 6,
    fontStyle: "italic",
    background: "none",
  },
  error: {
    background: "#3f1d1d",
    color: "#fecaca",
    fontWeight: 600,
    padding: "18px 28px",
    borderRadius: 10,
    border: "1.5px solid #f87171",
    margin: "26px 0",
    fontSize: 17,
    textAlign: "center",
  },
  loading: {
    color: "#93c5fd",
    fontSize: 18,
    padding: 22,
    textAlign: "center",
    fontWeight: 500,
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: 14,
    color: "#bfdbfe",
    fontSize: 19,
    fontWeight: 700,
  },
  chartsGrid: {
    display: "grid",
    gap: 34,
    gridTemplateColumns: "repeat(auto-fit, minmax(390px, 1fr))",
    margin: "30px 0",
  },
  chartCard: {
    background: "linear-gradient(110deg,#111827 70%, #1d4ed822 100%)",
    border: "1.3px solid #33415566",
    borderRadius: 15,
    padding: "22px 17px 12px 12px",
    minHeight: 190,
    boxShadow: "0 2px 12px #2563eb22, 0 8px 36px #11182728",
    display: "flex",
    flexDirection: "column",
  },
};

const nivoTheme = {
  textColor: "#e6eefb",
  axis: {
    domain: { line: { stroke: "#0ea5e9", strokeWidth: 1 } },
    legend: { text: { fontSize: 14, fill: "#93c5fd", fontWeight: 700 } },
    ticks: { line: { stroke: "#2563eb" }, text: { fontSize: 12, fill: "#cbd5e1" } },
  },
  grid: { line: { stroke: "#475569", strokeWidth: 1, strokeDasharray: "2 6" } },
  tooltip: {
    container: {
      background: "#1e293b",
      color: "#cbd5e1",
      fontSize: 15,
      borderRadius: 6,
      border: "1px solid #2563eb99",
    },
  },
  legends: { text: { fontSize: 13, fill: "#60a5fa" } },
};