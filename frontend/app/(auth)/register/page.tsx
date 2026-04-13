"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { register } from "../../services/auth.service";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [passportNumber, setPassportNumber] = useState("");
  const [nationality, setNationality] = useState("PK");
  const [dob, setDob] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const canSubmit = useMemo(() => {
    if (!email || password.length < 6) return false;
    return (
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      passportNumber.trim().length > 0 &&
      nationality.trim().length > 0 &&
      dob.trim().length > 0 &&
      contactNumber.trim().length > 0
    );
  }, [email, password, firstName, lastName, passportNumber, nationality, dob, contactNumber]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");

    try {
      await register({
        email,
        password,
        role: "Customer",
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        gender,
        passport_number: passportNumber.trim(),
        nationality: nationality.trim(),
        date_of_birth: dob.trim(),
        contact_number: contactNumber.trim(),
      });

      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <span style={styles.logoIcon}>✈️</span>
          <span style={styles.logoText}>AeroManager</span>
        </div>
        <h1 style={styles.title}>Create account</h1>
        <p style={styles.subtitle}>Join the airport management platform</p>

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
              placeholder="Min. 6 characters"
              style={styles.input}
              autoComplete="new-password"
            />
          </label>

          <div style={styles.sectionHeader}>
            <div style={styles.sectionLine} />
            <span style={styles.sectionLabel}>Passenger details</span>
            <div style={styles.sectionLine} />
          </div>

          <div style={styles.grid2}>
            <label style={styles.label}>
              First name
              <input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Ali"
                style={styles.input}
              />
            </label>
            <label style={styles.label}>
              Last name
              <input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Khan"
                style={styles.input}
              />
            </label>
          </div>

          <div style={styles.grid2}>
            <label style={styles.label}>
              Gender
              <select
                value={gender}
                onChange={e => setGender(e.target.value as "male" | "female")}
                style={styles.input}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
            <label style={styles.label}>
              Date of birth
              <input
                value={dob}
                onChange={e => setDob(e.target.value)}
                type="date"
                style={styles.input}
              />
            </label>
          </div>

          <label style={styles.label}>
            Passport number
            <input
              value={passportNumber}
              onChange={e => setPassportNumber(e.target.value)}
              placeholder="AA1234567"
              style={styles.input}
            />
          </label>

          <div style={styles.grid2}>
            <label style={styles.label}>
              Nationality
              <input
                value={nationality}
                onChange={e => setNationality(e.target.value)}
                placeholder="PK"
                style={styles.input}
              />
            </label>
            <label style={styles.label}>
              Contact number
              <input
                value={contactNumber}
                onChange={e => setContactNumber(e.target.value)}
                placeholder="+92300..."
                style={styles.input}
              />
            </label>
          </div>

          {error && (
            <div style={styles.errorBox}>
              <span>⚠</span> {error}
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
            {loading ? "Creating account..." : "Create account"}
          </button>

          <p style={styles.footer}>
            Already have an account?{" "}
            <a href="/login" style={styles.link}>
              Sign in
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "32px 16px",
    background: "linear-gradient(140deg, #0b1220 60%, #1e293b 100%)",
    color: "#e5e7eb",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 560,
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 18,
    padding: "32px 28px",
    boxShadow: "0 8px 40px #0b122066, 0 2px 8px #2563eb22",
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
  form: { display: "flex", flexDirection: "column", gap: 14 },
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
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    margin: "4px 0",
  },
  sectionLine: {
    flex: 1,
    height: 1,
    background: "#1f2937",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#475569",
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
    whiteSpace: "nowrap" as const,
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
  footer: {
    margin: "4px 0 0",
    fontSize: 14,
    color: "#64748b",
    textAlign: "center" as const,
  },
  link: { color: "#60a5fa", textDecoration: "none", fontWeight: 600 },
};