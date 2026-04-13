"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "../../services/auth.service";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [fadeOut, setFadeOut] = useState(false);

  const canSubmit = email && password.length >= 6;

  function getDashboardRoute(role: string): string {
    if (role === "Admin") return "/admin/dashboard";
    if (role === "Staff") return "/staff/dashboard";
    return "/dashboard"; // Customer
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError("");

    try {
      const { user } = await login(email, password);

      setFadeOut(true);
      setTimeout(() => {
        router.push(getDashboardRoute(user.role));
      }, 420);
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card} className={fadeOut ? "fade-out" : ""}>
        <div style={styles.logoRow}>
          <span style={styles.logoIcon}>✈️</span>
          <span style={styles.logoText}>AeroManager</span>
        </div>
        <h1 style={styles.title}>Welcome back</h1>
        <p style={styles.subtitle}>Sign in to your account to continue</p>

        <form onSubmit={onSubmit} style={styles.form}>
          <label style={styles.label}>
            Email address
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
              style={styles.input}
              autoComplete="email"
            />
          </label>

          <label style={styles.label}>
            Password
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              style={styles.input}
              autoComplete="current-password"
            />
          </label>

          {error && (
            <div style={styles.errorBox}>
              <span style={styles.errorIcon}>⚠</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit || loading}
            style={{
              ...styles.button,
              opacity: !canSubmit || loading ? 0.6 : 1,
              cursor: !canSubmit || loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? (
              <span style={styles.loadingRow}>
                <span style={styles.spinner} /> Signing in...
              </span>
            ) : (
              "Sign in"
            )}
          </button>

          <p style={styles.footer}>
            Don&apos;t have an account?{" "}
            <a href="/register" style={styles.link}>
              Create one
            </a>
          </p>
        </form>
      </div>

      <style>{`
        .fade-out {
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.42s cubic-bezier(.83,-0.01,.23,1.11);
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background: "linear-gradient(140deg, #0b1220 60%, #1e293b 100%)",
    color: "#e5e7eb",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 18,
    padding: "32px 28px",
    boxShadow: "0 8px 40px #0b122066, 0 2px 8px #2563eb22",
    transition: "opacity 0.42s cubic-bezier(.83,-0.01,.23,1.11)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  logoIcon: { fontSize: 28 },
  logoText: {
    fontSize: 20,
    fontWeight: 700,
    color: "#60a5fa",
    letterSpacing: 0.4,
  },
  title: { margin: 0, fontSize: 26, fontWeight: 800, color: "#f1f5f9" },
  subtitle: { margin: "6px 0 24px", fontSize: 14, color: "#64748b" },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    fontSize: 14,
    fontWeight: 500,
    color: "#cbd5e1",
  },
  input: {
    padding: "11px 14px",
    borderRadius: 10,
    border: "1px solid #1f2937",
    background: "#0b1220",
    color: "#e5e7eb",
    fontSize: 15,
    outline: "none",
    transition: "border-color 0.2s",
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 10,
    background: "#7f1d1d22",
    border: "1px solid #b91c1c55",
    color: "#fca5a5",
    fontSize: 14,
  },
  errorIcon: { fontSize: 15 },
  button: {
    marginTop: 4,
    padding: "12px 14px",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(90deg, #2563eb 70%, #60a5fa)",
    color: "white",
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
    boxShadow: "0 2px 12px #2563eb44",
    transition: "opacity 0.2s",
  },
  loadingRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  } as React.CSSProperties,
  spinner: {
    width: 16,
    height: 16,
    border: "2px solid #ffffff44",
    borderTop: "2px solid #fff",
    borderRadius: "50%",
    display: "inline-block",
    animation: "spin 0.7s linear infinite",
  } as React.CSSProperties,
  footer: { margin: "4px 0 0", fontSize: 14, color: "#64748b", textAlign: "center" },
  link: { color: "#60a5fa", textDecoration: "none", fontWeight: 600 },
};