"use client";

import { useState, useEffect, useRef } from "react";
import SystemSearch from "@/components/SystemSearch";
import { useAuth } from "@/components/AuthProvider";

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

/* ── Flip digit — subtle style ── */
function FlipDigit({ value }: { value: string }) {
  const [cur, setCur] = useState(value);
  const [prev, setPrev] = useState(value);
  const [flipping, setFlipping] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (value !== cur) {
      setPrev(cur);
      setCur(value);
      setFlipping(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setFlipping(false), 450);
    }
  }, [value, cur]);

  const S = 26;
  const half = S / 2;
  const BG = "var(--bg-elevated, #F0F0F2)";
  const FG = "var(--text-secondary, #86868B)";

  const cardStyle: React.CSSProperties = {
    width: "18px", height: `${S}px`, position: "relative", overflow: "hidden",
    borderRadius: "5px", background: BG,
    border: "1px solid var(--border, #E8E8ED)",
    fontSize: "14px", fontWeight: "700", color: FG,
    fontFamily: "var(--font-geist-mono), monospace",
    display: "inline-flex", flexShrink: 0,
  };
  const topHalf: React.CSSProperties = {
    position: "absolute", top: 0, left: 0, right: 0, height: `${half}px`,
    overflow: "hidden", display: "flex", alignItems: "flex-end", justifyContent: "center",
    lineHeight: `${S}px`,
  };
  const bottomHalf: React.CSSProperties = {
    position: "absolute", bottom: 0, left: 0, right: 0, height: `${half}px`,
    overflow: "hidden", display: "flex", alignItems: "flex-start", justifyContent: "center",
    lineHeight: `${S}px`,
  };
  const divider: React.CSSProperties = {
    position: "absolute", top: "50%", left: 0, right: 0, height: "1px",
    background: "rgba(0,0,0,0.06)", zIndex: 5,
  };

  return (
    <span className="flip-digit" style={cardStyle}>
      <span style={{ ...bottomHalf, zIndex: 1 }}><span style={{ transform: `translateY(-${half}px)` }}>{cur}</span></span>
      <span style={{ ...topHalf, zIndex: 1 }}>{cur}</span>

      {flipping && (
        <span className="flip-top" style={{
          ...topHalf, zIndex: 3, background: BG, borderRadius: "5px 5px 0 0",
          transformOrigin: "bottom center",
        }}>{prev}</span>
      )}
      {flipping && (
        <span className="flip-bottom" style={{
          ...bottomHalf, zIndex: 2, background: BG, borderRadius: "0 0 5px 5px",
          transformOrigin: "top center",
        }}><span style={{ transform: `translateY(-${half}px)` }}>{cur}</span></span>
      )}

      <span style={divider} />
    </span>
  );
}

function FlipClock({ time, blink }: { time: string; blink: boolean }) {
  const chars = time.split("");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
      {chars.map((c, i) =>
        c === ":" ? (
          <span key={i} style={{
            fontSize: "12px", fontWeight: "600", color: "var(--text-muted)",
            lineHeight: 1, margin: "0 1px",
            opacity: blink ? 1 : 0.2,
            transition: "opacity 0.3s",
          }}>:</span>
        ) : (
          <FlipDigit key={i} value={c} />
        )
      )}
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
            {greeting(hour)}, {user?.name.split(" ")[0] || "Aleš"} 👋
          </h1>
          <FlipClock time={timeStr} blink={secs % 2 === 0} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div className="navbar-search" style={{ width: "280px" }}>
          <SystemSearch />
        </div>

        <button
          style={{
            width: "36px", height: "36px", borderRadius: "9px",
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "var(--text-secondary)", position: "relative",
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span style={{
            position: "absolute", top: "7px", right: "7px",
            width: "7px", height: "7px", background: "var(--danger)",
            borderRadius: "50%", border: "1.5px solid var(--bg-surface)",
          }} />
        </button>

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
