"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { suppressCalendarToast } from "@/lib/calendar";

/**
 * Globálny toast pre Google Calendar notifikácie.
 *
 * Odchytáva CustomEvent "calendar:notify" z notifyCalendarFail() v calendar.ts.
 * Zobrazí nenáhly toast vpravo dole — žiadny blocking alert ktorý preruší flow.
 *
 * User môže potlačiť "viac nezobrazovať" → uloží sa do localStorage.
 *
 * Pridať raz do root layout (`src/app/layout.tsx`) — slúži všetkým stránkam.
 */
type Toast = {
  kind: "not_connected" | "error";
  message: string;
};

export default function CalendarToast() {
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    function handler(e: Event) {
      const ce = e as CustomEvent<Toast>;
      setToast(ce.detail);
      // Auto-hide po 8s
      const t = setTimeout(() => setToast(null), 8000);
      return () => clearTimeout(t);
    }
    window.addEventListener("calendar:notify", handler);
    return () => window.removeEventListener("calendar:notify", handler);
  }, []);

  if (!toast) return null;

  const isNotConnected = toast.kind === "not_connected";

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        maxWidth: 380,
        background: "#fff",
        borderRadius: 14,
        boxShadow: "0 12px 32px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)",
        border: `1px solid ${isNotConnected ? "#FCD34D" : "#FCA5A5"}`,
        padding: "14px 16px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ fontSize: 18, lineHeight: 1 }}>{isNotConnected ? "📅" : "⚠️"}</div>
        <div style={{ flex: 1, fontSize: 13, color: "#1F2937", lineHeight: 1.5 }}>
          {toast.message}
        </div>
        <button
          onClick={() => setToast(null)}
          aria-label="Zavrieť"
          style={{
            background: "transparent",
            border: 0,
            cursor: "pointer",
            color: "#9CA3AF",
            fontSize: 18,
            lineHeight: 1,
            padding: 0,
            marginLeft: 4,
          }}
        >
          ×
        </button>
      </div>
      {isNotConnected && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, fontSize: 12 }}>
          <Link
            href="/nastavenia?tab=integracie"
            style={{
              background: "#0F172A",
              color: "#fff",
              padding: "6px 12px",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Pripojiť Google
          </Link>
          <button
            onClick={() => {
              suppressCalendarToast();
              setToast(null);
            }}
            style={{
              background: "transparent",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
              color: "#6B7280",
              fontSize: 12,
            }}
          >
            Viac nezobrazovať
          </button>
        </div>
      )}
    </div>
  );
}
