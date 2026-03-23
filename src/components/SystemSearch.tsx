"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface SearchResult {
  id: string;
  type: "klient" | "nehnutelnost" | "system";
  title: string;
  detail: string;
  href: string;
  icon?: string;
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

export default function SystemSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
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

      const items: SearchResult[] = [
        // System pages first
        ...systemResults,
        // Then DB results
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
      ];
      setResults(items);
      setSearching(false);
    }, 400);
  }, [query]);

  const showDropdown = focused && (results.length > 0 || (query.trim().length >= 2 && !searching));

  function getIcon(r: SearchResult) {
    if (r.icon) return r.icon;
    if (r.type === "klient") return "👤";
    return "🏠";
  }

  function getBg(r: SearchResult) {
    if (r.type === "system") return "#F3F4F6";
    if (r.type === "klient") return "#EFF6FF";
    return "#F0FDF4";
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", color: "var(--text-muted)", pointerEvents: "none" }}>&#x1F50D;</span>
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Hľadaj klientov, nehnuteľnosti, funkcie..."
          style={{
            width: "100%", padding: "11px 14px 11px 36px", background: "var(--bg-elevated)",
            border: "1px solid var(--border)", borderRadius: "10px", fontSize: "13px",
            color: "var(--text-primary)", outline: "none",
          }}
        />
        {searching && <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "12px", color: "var(--text-muted)" }}>...</span>}
      </div>

      {showDropdown && (
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
            <a key={r.id} href={r.href} style={{
              display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px",
              borderBottom: i < results.length - 1 ? "1px solid var(--border)" : "none",
              textDecoration: "none", cursor: "pointer",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-elevated)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
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
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
