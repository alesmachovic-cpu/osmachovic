"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import SystemSearch from "@/components/SystemSearch";
import { useAuth } from "@/components/AuthProvider";
import { PoweredByAMGD } from "@/components/brand";

type ApiStatus = "ok" | "credit_low" | "error" | "no_key";
type ApiStatuses = { anthropic: ApiStatus; gemini: ApiStatus; openai: ApiStatus };

const API_CACHE_KEY = "vianema_api_status";
const API_CACHE_TTL = 30 * 60 * 1000; // 30 min

const API_LABELS: Record<string, string> = {
  anthropic: "Anthropic (Claude)",
  gemini: "Google Gemini",
  openai: "OpenAI (GPT)",
};
const STATUS_LABEL: Record<ApiStatus, string> = {
  ok: "OK",
  credit_low: "Nízke kredity",
  error: "Chyba",
  no_key: "Chýba kľúč",
};
const STATUS_COLOR: Record<ApiStatus, string> = {
  ok: "#34C759",
  credit_low: "#FF9500",
  error: "#FF3B30",
  no_key: "#AEAEB2",
};

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

/* ── Notifications Bell ── (rovnaký dizajn ako pôvodný ApiBell) */
interface NotifRow {
  id: string;
  typ: string | null;
  titulok: string | null;
  sprava: string | null;
  data: Record<string, unknown> | null;
  precitane: boolean;
  created_at: string;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "teraz";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d`;
}

/** Vyber URL kam má notifikácia po kliknutí navigovať. */
function notifTargetUrl(n: NotifRow): string | null {
  const data = (n.data || {}) as Record<string, unknown>;
  const dataUrl = typeof data.url === "string" ? data.url : null;
  const klientId = typeof data.klient_id === "string" ? data.klient_id : null;
  const objednavkaId = typeof data.objednavka_id === "string" ? data.objednavka_id : null;
  const inzeratId = typeof data.inzerat_id === "string" ? data.inzerat_id : null;

  switch (n.typ) {
    case "monitor_match":
      // Match kupujúceho — otvor jeho kartu (tab Objednávky)
      if (klientId) return `/klienti/${klientId}`;
      if (dataUrl) return dataUrl; // fallback na URL inzerátu
      return null;
    case "monitor_novy_inzerat":
      // Externý link na portál (nehnutelnosti.sk, bazos atď.) — otvor v novom tabe
      return dataUrl;
    case "monitor_summary":
      return "/monitor";
    case "lv_naber_pripravujeme":
    case "lv_data":
      return klientId ? `/klienti/${klientId}` : null;
    case "naklady":
      return "/operativa?tab=naklady";
    case "novy_klient":
    case "klient_zmena":
      return klientId ? `/klienti/${klientId}` : null;
    case "naber_dohodnuty":
    case "naber_pripomienka":
      return klientId ? `/klienti/${klientId}` : null;
    case "objednavka":
      return klientId ? `/klienti/${klientId}` : null;
    default:
      // Generický fallback — ak je url v dátach, použij ju
      return dataUrl;
  }
}

function NotificationsBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifs, setNotifs] = useState<NotifRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = async () => {
    if (!user?.id || loading) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/notifications?user_id=${encodeURIComponent(user.id)}`, { credentials: "include" });
      const d = await r.json();
      setNotifs(d.notifications || []);
      setUnread(d.unread || 0);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifs();
    // Poll každých 60s aby ikona mala fresh count
    const t = setInterval(fetchNotifs, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markRead = async (id: string) => {
    if (!user?.id) return;
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, precitane: true } : n));
    setUnread(u => Math.max(0, u - 1));
    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ user_id: user.id, mark_read: id }),
    }).catch(() => {});
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    setNotifs(prev => prev.map(n => ({ ...n, precitane: true })));
    setUnread(0);
    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ user_id: user.id, mark_read: "all" }),
    }).catch(() => {});
  };

  // Rovnaký dot color systém: zelený = nič nové, oranžový = sú neprečítané
  const dotColor = !user ? "#AEAEB2" : unread === 0 ? "#34C759" : "#FF9500";

  return (
    <div style={{ position: "relative" }} ref={dropRef}>
      <button
        onClick={() => setOpen(v => !v)}
        title={unread > 0 ? `${unread} neprečítaných notifikácií` : "Notifikácie"}
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
          width: "7px", height: "7px",
          background: dotColor,
          borderRadius: "50%", border: "1.5px solid var(--bg-surface)",
          transition: "background 0.3s ease",
        }} />
        {unread > 0 && (
          <span style={{
            position: "absolute", top: "-4px", right: "-4px",
            minWidth: "16px", height: "16px", padding: "0 4px",
            background: "#FF3B30", color: "#fff",
            borderRadius: "8px", fontSize: "10px", fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1.5px solid var(--bg-surface)",
          }}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "44px", right: 0,
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "12px", padding: "12px 14px",
          minWidth: "320px", maxWidth: "360px", maxHeight: "440px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 100,
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <p style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", margin: 0, letterSpacing: "0.06em" }}>
              NOTIFIKÁCIE {unread > 0 && <span style={{ color: "#FF9500" }}>· {unread} novej</span>}
            </p>
            {unread > 0 && (
              <button onClick={markAllRead} style={{
                fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500,
                background: "transparent", border: "none", cursor: "pointer",
                textDecoration: "underline",
              }}>Označiť všetky</button>
            )}
          </div>

          <div style={{ overflowY: "auto", marginRight: "-8px", paddingRight: "6px", flex: 1 }}>
            {!loading && notifs.length === 0 && (
              <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "16px 0", textAlign: "center" }}>
                Žiadne notifikácie
              </p>
            )}
            {notifs.map(n => {
              const target = notifTargetUrl(n);
              const isExternal = !!target && /^https?:\/\//i.test(target);
              return (
              <button
                key={n.id}
                onClick={() => {
                  if (!n.precitane) markRead(n.id);
                  if (target) {
                    setOpen(false);
                    if (isExternal) {
                      window.open(target, "_blank", "noopener,noreferrer");
                    } else {
                      router.push(target);
                    }
                  }
                }}
                title={target ? (isExternal ? `Otvoriť v novom okne: ${target}` : `Prejsť na ${target}`) : "Označiť ako prečítané"}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "10px 12px", borderRadius: "8px", marginBottom: "4px",
                  background: n.precitane ? "transparent" : "var(--bg-elevated)",
                  border: "1px solid", borderColor: n.precitane ? "transparent" : "var(--border)",
                  cursor: "pointer",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-elevated)"; }}
                onMouseLeave={e => { if (n.precitane) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  {!n.precitane && (
                    <span style={{
                      width: "7px", height: "7px", borderRadius: "50%",
                      background: "#FF9500", flexShrink: 0, marginTop: "5px",
                    }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {n.titulok && (
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "2px" }}>
                        {n.titulok}
                      </div>
                    )}
                    {n.sprava && (
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                        {n.sprava}
                      </div>
                    )}
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                      <span>{timeAgo(n.created_at)}</span>
                      {target && (
                        <span style={{
                          fontSize: "10px", fontWeight: 600,
                          color: isExternal ? "#3B82F6" : "var(--text-secondary)",
                          opacity: 0.8,
                        }}>
                          {isExternal ? "↗ otvoriť inzerát" : "→ otvoriť"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
              );
            })}
          </div>

          <a href="/notifikacie" onClick={() => setOpen(false)} style={{
            display: "block", textAlign: "center", marginTop: "8px", padding: "7px 0",
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            borderRadius: "8px", fontSize: "12px", color: "var(--text-secondary)",
            fontWeight: 500, textDecoration: "none",
          }}>Zobraziť všetky</a>
        </div>
      )}
    </div>
  );
}

/* ── API Status Bell ── (legacy, not rendered in navbar — replaced by NotificationsBell) */
function ApiBell() {
  const [statuses, setStatuses] = useState<ApiStatuses | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const fetchStatus = async (force = false) => {
    if (loading) return;
    if (!force) {
      try {
        const cached = localStorage.getItem(API_CACHE_KEY);
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < API_CACHE_TTL) {
            setStatuses(data);
            return;
          }
        }
      } catch {}
    }
    setLoading(true);
    try {
      const res = await fetch("/api/api-status");
      const data: ApiStatuses = await res.json();
      setStatuses(data);
      localStorage.setItem(API_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchStatus(); }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const issues = statuses
    ? (Object.entries(statuses) as [string, ApiStatus][]).filter(([, v]) => v !== "ok" && v !== "no_key")
    : [];
  const allOk = statuses && issues.length === 0;
  const dotColor = !statuses ? "#AEAEB2" : allOk ? "#34C759" : "#FF9500";

  return (
    <div style={{ position: "relative" }} ref={dropRef}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Stav API"
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
          width: "7px", height: "7px",
          background: dotColor,
          borderRadius: "50%", border: "1.5px solid var(--bg-surface)",
          transition: "background 0.3s ease",
        }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "44px", right: 0,
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "12px", padding: "14px 16px", minWidth: "220px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 100,
        }}>
          <p style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", margin: "0 0 10px", letterSpacing: "0.06em" }}>
            STAV API
          </p>

          {!statuses && !loading && (
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>Načítavam...</p>
          )}

          {statuses && (Object.entries(statuses) as [string, ApiStatus][]).map(([key, status]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 0" }}>
              <span style={{
                width: "8px", height: "8px", borderRadius: "50%",
                background: STATUS_COLOR[status], flexShrink: 0,
              }} />
              <span style={{ fontSize: "13px", color: "var(--text-primary)", flex: 1 }}>
                {API_LABELS[key]}
              </span>
              <span style={{ fontSize: "12px", color: STATUS_COLOR[status], fontWeight: "600" }}>
                {STATUS_LABEL[status]}
              </span>
            </div>
          ))}

          <button
            onClick={() => { setOpen(false); fetchStatus(true); }}
            disabled={loading}
            style={{
              width: "100%", marginTop: "12px", padding: "7px 0",
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: "8px", cursor: loading ? "default" : "pointer",
              fontSize: "12px", color: "var(--text-secondary)", fontWeight: "500",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Kontrolujem..." : "Skontrolovať znova"}
          </button>
        </div>
      )}
    </div>
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

        <NotificationsBell />

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
