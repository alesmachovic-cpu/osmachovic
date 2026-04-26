"use client";

import { useState, useEffect } from "react";
import SystemSearch from "@/components/SystemSearch";
import { useAuth } from "@/components/AuthProvider";
import { PoweredByAMGD } from "@/components/brand";
import NotificationBell from "@/components/NotificationBell";
// Note: ApiBell bol presunutý do samostatnej stránky /stav-api (admin only).
// V navbare zostáva len NotificationBell pre in-app notifikácie.

function useTime() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function greeting(hour: number) {
  if (hour < 5) return "Dobrú noc";
  if (hour < 12) return "Dobré ráno";
  if (hour < 18) return "Dobrý deň";
  return "Dobrý večer";
}

/* ── Simple flip card digit ── */
function FlipDigit({ value }: { value: string }) {
  const [display, setDisplay] = useState(value);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (value !== display) {
      setAnimate(true);
      const t = setTimeout(() => {
        setDisplay(value);
        setAnimate(false);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [value, display]);

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: "20px", height: "28px",
      background: "#F0F0F2", border: "1px solid #E5E5EA",
      borderRadius: "6px",
      fontSize: "15px", fontWeight: "700", color: "#6B7280",
      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
      position: "relative", overflow: "hidden",
      transition: "transform 0.2s ease",
      transform: animate ? "scaleY(0.6)" : "scaleY(1)",
    }}>
      {/* Horizontal line in middle */}
      <span style={{
        position: "absolute", top: "50%", left: "2px", right: "2px",
        height: "1px", background: "rgba(0,0,0,0.06)",
      }} />
      {display}
    </span>
  );
}

function FlipClock({ time, blink }: { time: string; blink: boolean }) {
  const digits = time.replace(":", "").split("");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
      <FlipDigit value={digits[0] || "0"} />
      <FlipDigit value={digits[1] || "0"} />
      <span style={{
        fontSize: "14px", fontWeight: "700", color: "#AEAEB2",
        lineHeight: 1, margin: "0 1px",
        opacity: blink ? 1 : 0.15,
        transition: "opacity 0.4s ease",
      }}>:</span>
      <FlipDigit value={digits[2] || "0"} />
      <FlipDigit value={digits[3] || "0"} />
    </span>
  );
}

export default function Navbar() {
  const { user } = useAuth();
  const now = useTime();
  const hour = now.getHours();
  const secs = now.getSeconds();
  const timeStr = now.toLocaleTimeString("sk", { hour: "2-digit", minute: "2-digit" });
  return (
    <header
      style={{
        height: "60px",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
        position: "sticky",
        top: 0,
        zIndex: 10,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Hamburger — visible only on mobile */}
        <button
          className="hamburger-btn"
          onClick={() => document.body.classList.toggle("sidebar-open")}
          style={{
            display: "none",
            width: "36px", height: "36px", borderRadius: "9px",
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "var(--text-primary)", flexShrink: 0,
          }}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h1 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: 0, whiteSpace: "nowrap" }}>
            {greeting(hour)}, {user?.name.split(" ")[0] || "Aleš"}
          </h1>
          <FlipClock time={timeStr} blink={secs % 2 === 0} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div className="navbar-search" style={{ width: "280px" }}>
          <SystemSearch />
        </div>

        {/* In-app notifikácie — bell s badge unread */}
        <NotificationBell />

        {/* Tier 1 — AMGD whisper pred avatarom (interný maklér view) */}
        <div className="navbar-amgd-whisper" style={{ color: "var(--text-muted)" }}>
          <PoweredByAMGD size="sm" />
        </div>

        <div className="navbar-avatar" style={{
          width: "36px", height: "36px", borderRadius: "50%",
          background: "#374151", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: "12px", fontWeight: "700",
          color: "#fff", cursor: "pointer", flexShrink: 0,
        }}>
          {user?.initials || "AM"}
        </div>
      </div>
    </header>
  );
}
