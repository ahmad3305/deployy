"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { API_BASE } from "@/app/config";

const ADMIN_LINKS: { label: string; url: string; icon: string }[] = [
  { label: "Dashboard", icon: "🏠", url: "/admin/dashboard" },
  { label: "Analytics", icon: "📊", url: "/admin/analytics" },
  { label: "Flights", icon: "🛩️", url: "/admin/flights" },
  { label: "Schedules", icon: "📅", url: "/admin/schedules" },
  { label: "Airports", icon: "🛬", url: "/admin/airports" },
  { label: "Aircraft", icon: "✈️", url: "/admin/aircraft" },
  { label: "Staff", icon: "👔", url: "/admin/staff" },
  { label: "Crew", icon: "👨‍✈️", url: "/admin/crew" },
  { label: "Cargo", icon: "📦", url: "/admin/cargo" },
  { label: "Payments", icon: "💳", url: "/admin/payments" },
];

type Metrics = {
  totalFlights: number;
  totalSchedules: number;
  totalAircraft: number;
  totalStaff: number;
  totalAirports: number;
  upcomingFlights: number;
  cancelledFlights: number;
  delayedFlights: number;
  completedFlights: number;
};

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Check auth on mount
  useEffect(() => {
    const user = typeof window !== "undefined" ? sessionStorage.getItem("user") : null;
    console.log("Checking admin auth, user:", user);

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

  // Fetch metrics only if authorized
  useEffect(() => {
      if (!isAuthorized) return;

      async function fetchMetrics() {
        try {
          setLoading(true);
          const token = sessionStorage.getItem("token") || "";

          if (!token) {
            throw new Error("No authentication token found");
          }

          console.log("Fetching with token:", token.substring(0, 20) + "...");

          const endpoints = [
            { name: "flights", url: `${API_BASE}/flights` },
            { name: "schedules", url: `${API_BASE}/flight-schedules` },
            { name: "aircraft", url: `${API_BASE}/aircraft` },
            { name: "staff", url: `${API_BASE}/staff` },
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

          const scheduleRows = Array.isArray(responses.schedules?.data)
            ? responses.schedules.data
            : [];
          const now = new Date();

          let upcomingFlights = 0,
            cancelledFlights = 0,
            delayedFlights = 0,
            completedFlights = 0;

          for (const sched of scheduleRows) {
            const status = String(sched.flight_status || "").toLowerCase();
            if (status === "cancelled") cancelledFlights++;
            else if (status === "delayed") delayedFlights++;
            else if (status === "completed") completedFlights++;
            else if (
              new Date(sched.departure_datetime) > now &&
              status !== "completed"
            )
              upcomingFlights++;
          }

          setMetrics({
            totalFlights: Array.isArray(responses.flights?.data)
              ? responses.flights.data.length
              : 0,
            totalSchedules: scheduleRows.length,
            totalAircraft: Array.isArray(responses.aircraft?.data)
              ? responses.aircraft.data.length
              : 0,
            totalStaff: Array.isArray(responses.staff?.data)
              ? responses.staff.data.length
              : 0,
            totalAirports: Array.isArray(responses.airports?.data)
              ? responses.airports.data.length
              : 0,
            upcomingFlights,
            cancelledFlights,
            delayedFlights,
            completedFlights,
          });
        } catch (err: any) {
          console.error("Fetch metrics error:", err);
          setError(err?.message || "Failed to load dashboard metrics.");
        } finally {
          setLoading(false);
        }
      }

      fetchMetrics();
    }, [isAuthorized]);

  if (!isAuthorized) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner}>Checking authorization...</div>
      </div>
    );
  }

  return (
    <div style={styles.adminShell}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>✈️ Admin Panel</div>
        <nav>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {ADMIN_LINKS.map((link) => {
              const active = pathname === link.url;
              return (
                <li key={link.url}>
                  <button
                    aria-label={link.label}
                    style={{
                      ...styles.sidebarLink,
                      ...(active ? styles.sidebarLinkActive : {}),
                    }}
                    onClick={() => router.push(link.url)}
                  >
                    <span style={{ marginRight: 11 }}>{link.icon}</span>
                    {link.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <main style={styles.mainContent}>
        <h1 style={styles.title}>🛫 Admin Dashboard</h1>
        <p style={styles.subtitle}>
          Monitor your airport's live data, operations, and resources at a glance.
        </p>

        {loading ? (
          <div style={styles.loading}>Loading dashboard data...</div>
        ) : error ? (
          <div style={styles.error}>{error}</div>
        ) : metrics ? (
          <div style={styles.grid}>
            <StatCard
              label="Total Flights"
              value={metrics.totalFlights}
              accent="#60a5fa"
              onClick={() => router.push("/admin/flights")}
              icon="🛩️"
            />
            <StatCard
              label="Total Schedules"
              value={metrics.totalSchedules}
              accent="#06d6a0"
              onClick={() => router.push("/admin/schedules")}
              icon="📅"
            />
            <StatCard
              label="Upcoming Flights"
              value={metrics.upcomingFlights}
              accent="#84cc16"
              onClick={() => router.push("/admin/schedules")}
              icon="⏰"
            />
            <StatCard
              label="Delayed Flights"
              value={metrics.delayedFlights}
              accent="#fbbf24"
              onClick={() => router.push("/admin/schedules/delayed")}
              icon="⏳"
            />
            <StatCard
              label="Cancelled Flights"
              value={metrics.cancelledFlights}
              accent="#f87171"
              onClick={() => router.push("/admin/schedules")}
              icon="❌"
            />
            <StatCard
              label="Completed Flights"
              value={metrics.completedFlights}
              accent="#38bdf8"
              onClick={() => router.push("/admin/schedules")}
              icon="✅"
            />
            <StatCard
              label="Total Aircraft"
              value={metrics.totalAircraft}
              accent="#f472b6"
              onClick={() => router.push("/admin/aircraft")}
              icon="✈️"
            />
            <StatCard
              label="Total Staff"
              value={metrics.totalStaff}
              accent="#c084fc"
              onClick={() => router.push("/admin/staff")}
              icon="👔"
            />
            <StatCard
              label="Airports"
              value={metrics.totalAirports}
              accent="#fca5a5"
              onClick={() => router.push("/admin/airports")}
              icon="🛬"
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  onClick,
  icon,
}: {
  label: string;
  value: number;
  accent?: string;
  onClick?: () => void;
  icon?: string;
}) {
  return (
    <div
      style={{
        ...styles.card,
        borderTop: `4px solid ${accent || "#2563eb"}`,
        cursor: onClick ? "pointer" : undefined,
      }}
      onClick={onClick}
      tabIndex={onClick ? 0 : -1}
      aria-label={label}
    >
      <div style={{ fontSize: 39, marginBottom: 7 }}>{icon}</div>
      <div style={{ fontSize: 17, color: accent || "#60a5fa", fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: 30, color: "#e2e8f0", fontWeight: 800, marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

// ---- Inline Styles ----
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
  adminShell: {
    display: "flex",
    minHeight: "100vh",
    fontFamily:
      "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    background: "linear-gradient(140deg, #1e293b 70%, #2563eb 130%)",
  },
  sidebar: {
    width: 230,
    background: "#1e293b",
    borderRight: "2px solid #2563eb22",
    minHeight: "100vh",
    paddingTop: 0,
    position: "sticky",
    left: 0,
    top: 0,
    alignSelf: "flex-start",
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
  },
  sidebarHeader: {
    color: "#60a5fa",
    fontWeight: 900,
    fontSize: 26,
    textAlign: "center",
    padding: "22px 0 30px 0",
    borderBottom: "2px solid #2563eb22",
    letterSpacing: 1.2,
    marginBottom: 8,
    background: "none",
  },
  sidebarLink: {
    width: "100%",
    background: "none",
    border: "none",
    outline: "none",
    color: "#cbd5e1",
    fontWeight: 700,
    padding: "13px 30px 13px 27px",
    fontSize: 17,
    textAlign: "left",
    borderLeft: "5px solid transparent",
    cursor: "pointer",
    transition: "all 0.14s",
    backgroundColor: "transparent",
  },
  sidebarLinkActive: {
    color: "#60a5fa",
    backgroundColor: "#12203f",
    borderLeft: "5px solid #38bdf8",
    fontWeight: 900,
  },
  mainContent: {
    flex: 1,
    padding: "38px 40px 40px 40px",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
  },
  title: {
    fontSize: 32,
    fontWeight: 800,
    color: "#60a5fa",
    marginBottom: 8,
    background: "none",
    letterSpacing: 0.7,
  },
  subtitle: {
    color: "#93c5fd",
    fontSize: 17,
    marginBottom: 26,
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
  },
  loading: {
    color: "#93c5fd",
    fontSize: 18,
    padding: 22,
    textAlign: "center",
    fontWeight: 500,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))",
    gap: 24,
    marginTop: 15,
    marginBottom: 20,
  },
  card: {
    background: "linear-gradient(110deg,#1e293b, #2563eb0c)",
    borderRadius: 16,
    border: "1.3px solid #2563eb26",
    padding: "28px 16px",
    minHeight: 120,
    display: "flex",
    alignItems: "flex-start",
    flexDirection: "column",
    boxShadow: "0 2px 12px #2563eb22, 0 8px 36px #1e293b25",
    transition: "transform 0.1s",
    outline: "none",
  },
};