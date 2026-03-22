// frontend/app/layout.tsx
"use client";
import React, { useState } from "react";


export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

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
          <a href="/(passenger)/dashboard" style={menuLinkStyle}>
            Dashboard
          </a>
          <a href="/(passenger)/flights/search" style={menuLinkStyle}>
            Book Flight
          </a>
          <a href="/(passenger)/tickets" style={menuLinkStyle}>My Tickets</a>
          <a href="/(passenger)/baggage" style={menuLinkStyle}>My Baggage</a>
          <a href="/(passenger)/cargo/track" style={menuLinkStyle}>Track Cargo</a>
          <a href="/profile" style={menuLinkStyle}>Profile</a>
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