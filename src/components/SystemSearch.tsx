"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

interface SearchResult {
  id: string;
  type: "klient" | "nehnutelnost" | "system" | "calendar";
  title: string;
  detail: string;
  href: string;
  icon?: string;
  action?: () => void;
}

const SYSTEM_PAGES: SearchResult[] = [
  { id: "s-prehlad", type: "system", title: "Prehľad", detail: "Dashboard, štatistiky, aktivita", href: "/", icon: "📊" },
  { id: "s-portfolio", type: "system", title: "Portfólio", detail: "Nehnuteľnosti, inzeráty", href: "/portfolio", icon: "🏠" },
  { id: "s-klienti", type: "system", title: "Klienti", detail: "Zoznam klientov, pridanie nového", href: "/klienti", icon: "👥" },
  { id: "s-kupujuci", type: "system", title: "Kupujúci", detail: "Zoznam kupujúcich klientov", href: "/kupujuci", icon: "🔍" },
  { id: "s-analyzy", type: "system", title: "Analýza trhu", detail: "Trhové dáta, cenové mapy", href: "/analyzy", icon: "📈" },
  { id: "s-kalkulator", type: "system", title: "Kalkulátor", detail: "Výpočet provízie, hypotéky", href: "/kalkulator", icon: "🧮" },
  { id: "s-matching", type: "system", title: "Matching", detail: "Párovanie klientov s nehnuteľnosťami", href: "/matching", icon: "🔗" },
  { id: "s-nastavenia", type: "system", title: "Nastavenia", detail: "Mesačné ciele, prispôsobenie systému", href: "/nastavenia", icon: "⚙️" },
  { id: "s-nastavenia-ciele", type: "system", title: "Mesačné ciele", detail: "Nastavenie cieľov pre kruhy", href: "/nastavenia", icon: "🎯" },
  { id: "s-notifikacie", type: "system", title: "Notifikácie", detail: "Upozornenia, správy", href: "/notifikacie", icon: "🔔" },
  { id: "s-log", type: "system", title: "System Log", detail: "História akcií, logy", href: "/log", icon: "📋" },
  { id: "s-ai-writer", type: "system", title: "AI Writer", detail: "Generovanie inzerátov, popisov", href: "/ai-writer", icon: "✍️" },
];

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Parse natural language calendar commands
// e.g. "stretnutie 18:00 robotnicka" → { summary: "stretnutie robotnicka", time: "18:00" }
// e.g. "obhliadka zajtra 14:30 Petrzalka" → { summary: "obhliadka Petrzalka", time: "14:30", dayOffset: 1 }
function parseCalendarCommand(q: string): { summary: string; time: string; location: string; dateStr?: string } | null {
  const keywords = ["stretnutie", "obhliadka", "schodzka", "meeting", "call", "hovor", "telefonat", "udalost", "event"];
  const qNorm = normalize(q);
  const hasKeyword = keywords.some(k => qNorm.includes(k));
  if (!hasKeyword) return null;

  // Extract time (HH:MM pattern)
  const timeMatch = q.match(/(\d{1,2}:\d{2})/);
  if (!timeMatch) return null;
  const time = timeMatch[1];

  // Extract date keywords
  let dateStr: string | undefined;
  const today = new Date();
  if (qNorm.includes("zajtra") || qNorm.includes("tomorrow")) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    dateStr = d.toISOString().split("T")[0];
  } else if (qNorm.includes("pozajtra")) {
    const d = new Date(today);
    d.setDate(d.getDate() + 2);
    dateStr = d.toISOString().split("T")[0];
  } else if (qNorm.includes("pondelok") || qNorm.includes("utorok") || qNorm.includes("streda") || qNorm.includes("stvrtok") || qNorm.includes("piatok")) {
    const dayMap: Record<string, number> = { pondelok: 1, utorok: 2, streda: 3, stvrtok: 4, piatok: 5, sobota: 6, nedela: 0 };
    for (const [dayName, dayNum] of Object.entries(dayMap)) {
      if (qNorm.includes(dayName)) {
        const d = new Date(today);
        const diff = (dayNum - d.getDay() + 7) % 7 || 7;
        d.setDate(d.getDate() + diff);
        dateStr = d.toISOString().split("T")[0];
        break;
      }
    }
  }

  // Remove time, date keywords, and calendar keywords to get location/summary
  let rest = q
    .replace(/\d{1,2}:\d{2}/, "")
    .replace(/zajtra|pozajtra|pondelok|utorok|streda[u]?|stvrtok|piatok|sobota|nedel[au]/gi, "")
    .trim();

  // Split: first keyword is the event type, rest is location
  const words = rest.split(/\s+/).filter(Boolean);
  let eventType = "";
  const locationParts: string[] = [];
  for (const w of words) {
    if (!eventType && keywords.some(k => normalize(w).includes(k))) {
      eventType = w;
    } else {
      locationParts.push(w);
    }
  }

  const location = locationParts.join(" ");
  const summary = [eventType, location].filter(Boolean).join(" ") || rest;

  return { summary: summary.charAt(0).toUpperCase() + summary.slice(1), time, location, dateStr };
}

export default function SystemSearch() {
  const { user: authUser } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const [calendarCreating, setCalendarCreating] = useState(false);
  const [calendarMsg, setCalendarMsg] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const q = query.trim();
      const qNorm = normalize(q);

      // Calendar command detection
      const calCmd = parseCalendarCommand(q);

      // System pages — instant, no DB call
      const systemResults = SYSTEM_PAGES.filter(p =>
        normalize(p.title).includes(qNorm) || normalize(p.detail).includes(qNorm)
      );

      // DB search
      const [{ data: klienti }, { data: nehnutelnosti }] = await Promise.all([
        supabase.from("klienti").select("id, meno, telefon, email, lokalita, status")
          .or(`meno.ilike.%${q}%,telefon.ilike.%${q}%,email.ilike.%${q}%,lokalita.ilike.%${q}%`)
          .limit(5),
        supabase.from("nehnutelnosti").select("id, nazov, lokalita, cena, typ")
          .or(`nazov.ilike.%${q}%,lokalita.ilike.%${q}%,typ.ilike.%${q}%`)
          .limit(5),
      ]);

      const items: SearchResult[] = [];

      // Calendar suggestion first if detected
      if (calCmd) {
        const dateLabel = calCmd.dateStr
          ? new Date(calCmd.dateStr).toLocaleDateString("sk", { weekday: "short", day: "numeric", month: "short" })
          : "dnes";
        items.push({
          id: "cal-create",
          type: "calendar",
          title: `${calCmd.summary}`,
          detail: `${dateLabel} o ${calCmd.time}${calCmd.location ? ` · ${calCmd.location}` : ""} — klikni pre vytvorenie`,
          href: "#",
          icon: "📅",
        });
      }

      // System pages
      items.push(...systemResults);

      // DB results
      items.push(
        ...(klienti ?? []).map(k => ({
          id: k.id, type: "klient" as const,
          title: k.meno,
          detail: [k.telefon, k.lokalita, k.status].filter(Boolean).join(" · "),
          href: "/klienti",
        })),
        ...(nehnutelnosti ?? []).map(n => ({
          id: n.id, type: "nehnutelnost" as const,
          title: n.nazov || n.typ || "Nehnuteľnosť",
          detail: [n.lokalita, n.cena ? `${n.cena.toLocaleString("sk")} €` : null].filter(Boolean).join(" · "),
          href: "/portfolio",
        })),
      );
      setResults(items);
      setSearching(false);
    }, 400);
  }, [query]);

  async function handleCreateCalendarEvent() {
    if (!authUser?.id || calendarCreating) return;
    const calCmd = parseCalendarCommand(query);
    if (!calCmd) return;

    setCalendarCreating(true);
    setCalendarMsg("");
    try {
      const today = new Date();
      const dateBase = calCmd.dateStr || today.toISOString().split("T")[0];
      const [h, m] = calCmd.time.split(":").map(Number);
      const start = new Date(`${dateBase}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
      const end = new Date(start.getTime() + 3600000); // +1h

      const res = await fetch("/api/google/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: authUser.id,
          summary: calCmd.summary,
          start: start.toISOString(),
          end: end.toISOString(),
          location: calCmd.location || "",
        }),
      });

      if (res.ok) {
        setCalendarMsg("Udalosť vytvorená");
        setQuery("");
        setResults([]);
        setTimeout(() => setCalendarMsg(""), 3000);
      } else {
        const err = await res.json();
        if (err.error === "not_connected") {
          setCalendarMsg("Najprv pripoj Google účet v Nastaveniach");
        } else {
          setCalendarMsg("Nepodarilo sa vytvoriť udalosť");
        }
        setTimeout(() => setCalendarMsg(""), 4000);
      }
    } catch {
      setCalendarMsg("Chyba pri vytváraní");
      setTimeout(() => setCalendarMsg(""), 3000);
    }
    setCalendarCreating(false);
  }

  const showDropdown = focused && (results.length > 0 || (query.trim().length >= 2 && !searching));

  function getIcon(r: SearchResult) {
    if (r.icon) return r.icon;
    if (r.type === "klient") return "👤";
    return "🏠";
  }

  function getBg(r: SearchResult) {
    if (r.type === "calendar") return "#FEF3C7";
    if (r.type === "system") return "#F3F4F6";
    if (r.type === "klient") return "#EFF6FF";
    return "#F0FDF4";
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", color: "var(--text-muted)", pointerEvents: "none" }}>&#x1F50D;</span>
        <input
          value={query} onChange={e => { setQuery(e.target.value); setCalendarMsg(""); }}
          onFocus={() => setFocused(true)}
          placeholder="Hľadaj alebo vytvor udalosť (napr. stretnutie 18:00 Robotnícka)"
          style={{
            width: "100%", padding: "11px 14px 11px 36px", background: "var(--bg-elevated)",
            border: "1px solid var(--border)", borderRadius: "10px", fontSize: "13px",
            color: "var(--text-primary)", outline: "none",
          }}
        />
        {searching && <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "12px", color: "var(--text-muted)" }}>...</span>}
      </div>

      {calendarMsg && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, marginTop: "6px", zIndex: 21,
          padding: "10px 14px", borderRadius: "10px", fontSize: "13px", fontWeight: "600",
          background: calendarMsg.includes("vytvorená") ? "#F0FDF4" : "#FEF2F2",
          color: calendarMsg.includes("vytvorená") ? "#065F46" : "#991B1B",
          border: `1px solid ${calendarMsg.includes("vytvorená") ? "#BBF7D0" : "#FECACA"}`,
        }}>
          {calendarMsg}
        </div>
      )}

      {showDropdown && !calendarMsg && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, marginTop: "6px", zIndex: 20,
          background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.1)", overflow: "hidden", maxHeight: "380px", overflowY: "auto",
        }}>
          {results.length === 0 && !searching && (
            <div style={{ padding: "16px", textAlign: "center", fontSize: "13px", color: "var(--text-muted)" }}>
              Žiadne výsledky
            </div>
          )}
          {results.map((r, i) => (
            <a
              key={r.id}
              href={r.type === "calendar" ? undefined : r.href}
              onClick={r.type === "calendar" ? (e) => { e.preventDefault(); handleCreateCalendarEvent(); } : undefined}
              style={{
                display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px",
                borderBottom: i < results.length - 1 ? "1px solid var(--border)" : "none",
                textDecoration: "none", cursor: "pointer",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-elevated)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{
                width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
                background: getBg(r),
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "12px",
              }}>
                {getIcon(r)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.detail}</div>
              </div>
              {r.type === "system" && (
                <span style={{ fontSize: "10px", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: "4px", flexShrink: 0 }}>Funkcia</span>
              )}
              {r.type === "calendar" && (
                <span style={{ fontSize: "10px", color: "#92400E", background: "#FEF3C7", padding: "2px 8px", borderRadius: "4px", flexShrink: 0, fontWeight: "600" }}>
                  {calendarCreating ? "..." : "+ Kalendár"}
                </span>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
