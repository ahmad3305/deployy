"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  const handleBookFlight = () => {
    router.push("/flight_booking");
    setMenuOpen(false);
  };

  return (
    <html lang="en">
      <head>
        <title>Jaahhaazz</title>
        <link
          rel="icon"
          href="/logo/airport-location-icon-logo-set-vector_1223784-8073.ico"
          sizes="any"
        />
      </head>
      <body
        style={{
          margin: 0,
          background: "#f5f7fa",
          fontFamily: "sans-serif",
        }}
      >
        {/* HEADER */}
        <header
          style={{
            width: "100%",
            background: "#2563eb",
            color: "#fff",
            padding: "0 24px",
            height: 56,
            display: "flex",
            alignItems: "center",
            boxShadow: "0 1.5px 9px #2563eb33",
            position: "fixed",
            zIndex: 50,
            top: 0,
            left: 0,
          }}
        >
          {/* Hamburger button for sidebar */}
          <button
            aria-label="Toggle menu"
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              fontSize: 28,
              marginRight: 18,
              cursor: "pointer",
              outline: "none",
            }}
            onClick={() => setMenuOpen((v) => !v)}
          >
            ☰
          </button>
          <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: 1 }}>
            🛫 Airline System
          </div>
        </header>

        {/* SIDEBAR */}
        <aside
          style={{
            position: "fixed",
            top: 56,
            left: menuOpen ? 0 : -200,
            height: "100%",
            width: 200,
            background: "#1e293b",
            color: "#e5e7eb",
            padding: "32px 0",
            transition: "left 0.2s",
            boxShadow: menuOpen ? "2px 0 16px #1e293b33" : "none",
            zIndex: 40,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <a
            href="/dashboard"
            style={menuLinkStyle}
            onClick={(e) => {
              e.preventDefault();
              router.push("/dashboard");
              setMenuOpen(false);
            }}
          >
            Dashboard
          </a>
          <button
            style={{
              ...menuLinkStyle,
              background: "none",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
            }}
            onClick={handleBookFlight}
          >
            Book Flight
          </button>
          <a
            href="/profile"
            style={menuLinkStyle}
            onClick={(e) => {
              e.preventDefault();
              router.push("/profile");
              setMenuOpen(false);
            }}
          >
            Profile
          </a>
           <a
            href="/cargo-shipment/track"
            style={menuLinkStyle}
            onClick={(e) => {
              e.preventDefault();
              router.push("/cargo-shipment/track");
              setMenuOpen(false);
            }}
          >
            Track Cargo
          </a>
        </aside>

        {/* SLIDING VERTICAL SEPARATOR (always rendered, animates in sync) */}
        <div
          style={{
            position: "fixed",
            top: 56,
            left: menuOpen ? 200 : 0,
            height: "100%",
            width: 3,
            background: "linear-gradient(to bottom, #60a5fa 0%, #2563eb 100%)",
            zIndex: 45,
            borderRadius: 3,
            boxShadow: "2px 0 16px #2563eb33",
            opacity: menuOpen ? 1 : 0,
            pointerEvents: "none",
            transition: "left 0.2s, opacity 0.18s",
          }}
        />

        {/* MAIN CONTENT */}
        <div
          style={{
            minHeight: "100vh",
            paddingTop: 56,
            paddingLeft: menuOpen ? 200 : 0,
            transition: "padding-left 0.2s",
          }}
        >
          {children}
        </div>
      </body>
    </html>
  );
}

const menuLinkStyle: React.CSSProperties = {
  display: "block",
  padding: "8px 22px",
  color: "#e5e7eb",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 17,
  borderRadius: 6,
  transition: "background 0.15s",
  margin: "0 0 2px 0",
};