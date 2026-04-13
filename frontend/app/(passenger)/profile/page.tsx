"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { API_BASE } from "@/app/config";

export default function PassengerProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("You are not logged in.");
          setLoading(false);
          return;
        }
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.message || "Failed to load profile.");
          setProfile(null);
        } else {
          setProfile(json.data);
        }
      } catch (e: any) {
        setError("An error occurred: " + (e?.message ?? e));
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  return (
    <div style={styles.outer}>
      <div style={styles.card}>
        {/* === BACK BUTTON === */}
        <button
          onClick={() => router.push('/dashboard')}
          style={styles.backBtn}
        >
          ← Back to Dashboard
        </button>
        <h1 style={styles.title}>My Profile</h1>
        {loading ? (
          <div style={styles.loading}>Loading...</div>
        ) : error ? (
          <div style={styles.error}>{error}</div>
        ) : profile ? (
          <ProfileDetails profile={profile} />
        ) : null}
      </div>
    </div>
  );
}

function ProfileDetails({ profile }: { profile: any }) {
  return (
    <div style={styles.infoGrid}>
      <InfoRow label="Full Name" value={`${profile.passenger_first_name ?? ""} ${profile.passenger_last_name ?? ""}`.trim() || "���"} />
      <InfoRow label="Email" value={profile.email ?? "—"} />
      <InfoRow label="Passport Number" value={profile.passport_number ?? "—"} />
      <InfoRow label="User ID" value={profile.user_id ?? "—"} />
      <InfoRow label="Account Created" value={profile.created_at ? new Date(profile.created_at).toLocaleString() : "—"} />
    </div>
  );
}
function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}:</span>
      <span style={styles.value}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  outer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    minHeight: "calc(100vh - 56px)",
    background: "none",
    paddingTop: 56 + 44,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 14,
    padding: 30,
    margin: "auto",
    color: "#e5e7eb",
    boxShadow: "0 2px 20px #1e293b22",
    position: "relative",
  },
  // --- Add this style for the back button ---
  backBtn: {
    position: "absolute",
    top: 18,
    left: 24,
    background: "none",
    color: "#60a5fa",
    border: "none",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    padding: 0,
    marginBottom: 18,
    outline: "none",
    transition: "color 0.17s",
  },
  title: { margin: 0, marginBottom: 22, fontSize: 27, color: "#60a5fa", textAlign: 'center' },
  loading: { color: "#60a5fa" },
  error: { color: "#fca5a5" },
  infoGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 13,
    marginTop: 6,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    borderBottom: "1px solid #1f293750",
    padding: "5px 0",
  },
  label: {
    color: "#b5caf7",
    fontWeight: 600,
    fontSize: 15.2,
  },
  value: {
    color: "#e5e7eb",
    fontWeight: 500,
    fontSize: 15.2,
    textAlign: "right",
    maxWidth: 220,
    overflowWrap: "break-word",
  },
};