"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { filterLokality, type LokalitaEntry } from "@/lib/lokality-db";

/* ── Typy ── */
interface Inzerat {
  id: string;
  portal: string;
  external_id: string;
  url: string;
  nazov: string;
  typ: string;
  lokalita: string;
  cena: number;
  plocha: number;
  izby: number;
  foto_url: string;
  predajca_meno: string;
  predajca_telefon: string;
  predajca_typ: string;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
}

interface Filter {
  id: string;
  nazov: string;
  portal: string;
  typ: string | null;
  lokalita: string | null;
  cena_od: number | null;
  cena_do: number | null;
  plocha_od: number | null;
  plocha_do: number | null;
  izby_od: number | null;
  izby_do: number | null;
  search_url: string | null;
  notify_email: boolean;
  notify_telegram: boolean;
  is_active: boolean;
}

/* ── Konštanty ── */
const PORTALS = [
  { value: "vsetky", label: "Všetky portály" },
  { value: "reality.sk", label: "Reality.sk" },
  { value: "nehnutelnosti.sk", label: "Nehnuteľnosti.sk" },
  { value: "topreality.sk", label: "TopReality.sk" },
];

const TYPY = [
  { value: "", label: "Všetky typy" },
  { value: "byt", label: "Byt" },
  { value: "dom", label: "Dom" },
  { value: "pozemok", label: "Pozemok" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Najnovšie" },
  { value: "price_asc", label: "Najlacnejšie" },
  { value: "price_desc", label: "Najdrahšie" },
];

const PORTAL_DOT: Record<string, string> = {
  "nehnutelnosti.sk": "#3b82f6",
  "reality.sk": "#10b981",
  "topreality.sk": "#8b5cf6",
};

/* ── Helpers ── */
const fmt = (n: number) => n.toLocaleString("sk-SK");
const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "práve teraz";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hod`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "deň" : days < 5 ? "dni" : "dní"}`;
};

/* ── Lokalita Autocomplete Component ── */
function LokalitaInput({
  value,
  onChange,
  placeholder = "Bratislava - Petržalka...",
}: {
  value: string;
  onChange: (display: string, dbValue: string) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState(value);
  const [suggestions, setSuggestions] = useState<LokalitaEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setInput(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInput = (val: string) => {
    setInput(val);
    setActiveIdx(-1);
    const results = filterLokality(val, 8);
    setSuggestions(results);
    setOpen(results.length > 0);
    // Allow free text too
    onChange(val, val);
  };

  const selectItem = (item: LokalitaEntry) => {
    setInput(item.display);
    onChange(item.display, item.lokalita);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      selectItem(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        type="text"
        placeholder={placeholder}
        value={input}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        onKeyDown={handleKeyDown}
        className="w-full h-10 bg-gray-50 border-0 rounded-lg px-3 text-sm focus:ring-2 focus:ring-gray-200 focus:bg-white transition placeholder:text-gray-300"
      />
      {open && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute", top: "100%", left: 0, right: 0,
            zIndex: 50, marginTop: "4px",
            background: "#fff", borderRadius: "10px",
            border: "1px solid #e5e7eb",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            maxHeight: "240px", overflowY: "auto",
          }}
        >
          {suggestions.map((s, i) => (
            <button
              key={s.display + i}
              onClick={() => selectItem(s)}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                width: "100%", padding: "8px 12px", border: "none",
                background: i === activeIdx ? "#f3f4f6" : "transparent",
                cursor: "pointer", textAlign: "left",
                fontSize: "13px", color: "#111827",
                transition: "background 0.1s",
              }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span style={{ fontSize: "12px", color: "#9ca3af" }}>📍</span>
              <span>{s.display}</span>
              {s.lokalita !== s.display && (
                <span style={{ marginLeft: "auto", fontSize: "11px", color: "#9ca3af" }}>
                  {s.lokalita}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Hlavná stránka ── */
export default function MonitorPage() {
  const [inzeraty, setInzeraty] = useState<Inzerat[]>([]);
  const [filtre, setFiltre] = useState<Filter[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"inzeraty" | "filtre">("inzeraty");
  const [showNewFilter, setShowNewFilter] = useState(false);

  // View filters
  const [viewPortal, setViewPortal] = useState("");
  const [viewTyp, setViewTyp] = useState("");
  const [viewCenaOd, setViewCenaOd] = useState("");
  const [viewCenaDo, setViewCenaDo] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [lenSukromni, setLenSukromni] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const showToast = (msg: string, type: "success" | "error" | "info" = "success") => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };

  const loadInzeraty = useCallback(async () => {
    const params = new URLSearchParams();
    if (viewPortal) params.set("portal", viewPortal);
    if (viewTyp) params.set("typ", viewTyp);
    if (viewCenaOd) params.set("cena_od", viewCenaOd);
    if (viewCenaDo) params.set("cena_do", viewCenaDo);
    params.set("limit", "100");

    const res = await fetch(`/api/monitor?${params.toString()}`);
    const data = await res.json();
    setInzeraty(data.inzeraty || []);
    setTotal(data.total || 0);
  }, [viewPortal, viewTyp, viewCenaOd, viewCenaDo]);

  const loadFiltre = async () => {
    const res = await fetch("/api/monitor/filtre");
    const data = await res.json();
    setFiltre(data.filtre || []);
  };

  useEffect(() => {
    Promise.all([loadInzeraty(), loadFiltre()]).finally(() => setLoading(false));
  }, [loadInzeraty]);

  // Derived data
  const today = new Date().toISOString().split("T")[0];
  const noveDnes = inzeraty.filter(i => i.first_seen_at?.startsWith(today)).length;
  const sukromniCount = inzeraty.filter(i => i.predajca_typ === "sukromny").length;
  const aktivneFiltre = filtre.filter(f => f.is_active).length;

  // Client-side filtering + sorting
  const filtered = inzeraty
    .filter(i => {
      if (lenSukromni && i.predajca_typ !== "sukromny") return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(i.nazov || "").toLowerCase().includes(q) && !(i.lokalita || "").toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === "price_asc") return (a.cena || 999999999) - (b.cena || 999999999);
      if (sort === "price_desc") return (b.cena || 0) - (a.cena || 0);
      return new Date(b.first_seen_at).getTime() - new Date(a.first_seen_at).getTime();
    });

  // New filter form
  const [nf, setNf] = useState({
    nazov: "", portal: "vsetky", typ: "", lokalita: "",
    cena_od: "", cena_do: "", search_url: "",
    notify_email: true, notify_telegram: false,
  });

  const createFilter = async () => {
    const body = {
      ...nf,
      cena_od: nf.cena_od ? parseFloat(nf.cena_od) : null,
      cena_do: nf.cena_do ? parseFloat(nf.cena_do) : null,
      typ: nf.typ || null,
      lokalita: nf.lokalita || null,
      search_url: nf.search_url || null,
    };
    const res = await fetch("/api/monitor/filtre", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setShowNewFilter(false);
      setNf({ nazov: "", portal: "vsetky", typ: "", lokalita: "", cena_od: "", cena_do: "", search_url: "", notify_email: true, notify_telegram: false });
      loadFiltre();
      showToast("Filter vytvorený");
    }
  };

  const toggleFilter = async (f: Filter) => {
    await fetch("/api/monitor/filtre", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: f.id, is_active: !f.is_active }),
    });
    loadFiltre();
  };

  const deleteFilter = async (id: string) => {
    if (!confirm("Vymazať filter?")) return;
    await fetch(`/api/monitor/filtre?id=${id}`, { method: "DELETE" });
    loadFiltre();
    showToast("Filter vymazaný");
  };

  // Scrape
  const [scraping, setScraping] = useState(false);
  const [lastScrapeResult, setLastScrapeResult] = useState<string | null>(null);
  const runScrape = async () => {
    setScraping(true);
    setLastScrapeResult(null);
    try {
      const res = await fetch("/api/cron/scrape?key=" + encodeURIComponent("__internal__"));
      const data = await res.json();
      if (res.ok) {
        const msg = data.message || "Scrape dokončený";
        setLastScrapeResult(msg);
        showToast(msg);
      } else {
        showToast(data.error || "Chyba pri scrapovaní", "error");
      }
      await loadInzeraty();
    } catch {
      showToast("Chyba pri scrapovaní", "error");
    } finally {
      setScraping(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Načítavam monitor...</span>
        </div>
      </div>
    );
  }

  const toastColors = {
    success: { bg: "#111827", dot: "#4ade80" },
    error: { bg: "#7f1d1d", dot: "#fca5a5" },
    info: { bg: "#1e3a5f", dot: "#93c5fd" },
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Toast */}
      {toast && (
        <div
          style={{
            animation: "slideIn 0.3s ease",
            position: "fixed", top: "16px", right: "16px", zIndex: 50,
            background: toastColors[toast.type].bg,
            color: "#fff", padding: "10px 16px", borderRadius: "12px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            fontSize: "13px", fontWeight: 500,
            display: "flex", alignItems: "center", gap: "8px",
            maxWidth: "400px",
          }}
        >
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: toastColors[toast.type].dot, flexShrink: 0 }} />
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>Monitor</h1>
          <p style={{ fontSize: "13px", color: "#9ca3af", marginTop: "2px" }}>Sledovanie nových inzerátov na slovenských portáloch</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {aktivneFiltre === 0 && (
            <span style={{ fontSize: "12px", color: "#f59e0b", background: "#fffbeb", padding: "4px 10px", borderRadius: "8px", fontWeight: 500 }}>
              Pridaj filter pre spustenie
            </span>
          )}
          <button
            onClick={runScrape}
            disabled={scraping || aktivneFiltre === 0}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              height: "36px", padding: "0 16px", borderRadius: "10px",
              fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer",
              background: scraping ? "#d1d5db" : "#111827",
              color: "#fff", transition: "all 0.15s",
              opacity: aktivneFiltre === 0 ? 0.4 : 1,
            }}
          >
            {scraping ? (
              <>
                <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.6s linear infinite", display: "inline-block" }} />
                Scrapujem...
              </>
            ) : (
              "Spustiť scrape"
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Celkom inzerátov", value: total, icon: "🏠" },
          { label: "Nové dnes", value: noveDnes, icon: "✨", highlight: noveDnes > 0 },
          { label: "Súkromní", value: sukromniCount, icon: "👤", highlight: sukromniCount > 0, color: "#f97316" },
          { label: "Aktívne filtre", value: aktivneFiltre, icon: "📡" },
        ].map((s, i) => (
          <div key={i} style={{
            background: "#fff", borderRadius: "14px", border: "1px solid #f3f4f6",
            padding: "16px 18px", transition: "box-shadow 0.2s",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "28px", fontWeight: 700, color: s.color || "#111827", letterSpacing: "-0.02em" }}>{s.value}</span>
              <span style={{ fontSize: "18px" }}>{s.icon}</span>
            </div>
            <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px", fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "20px", borderBottom: "1px solid #f3f4f6" }}>
        {(["inzeraty", "filtre"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 16px", fontSize: "13px", fontWeight: 500,
              border: "none", background: "none", cursor: "pointer",
              borderBottom: tab === t ? "2px solid #111827" : "2px solid transparent",
              color: tab === t ? "#111827" : "#9ca3af",
              marginBottom: "-1px", transition: "all 0.15s",
            }}
          >
            {t === "inzeraty" ? `Inzeráty (${total})` : `Filtre (${filtre.length})`}
          </button>
        ))}
      </div>

      {/* ═══ TAB: INZERÁTY ═══ */}
      {tab === "inzeraty" && (
        <>
          {/* Filter bar */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <div style={{ position: "relative", flex: "1 1 200px", maxWidth: "280px" }}>
              <svg style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "#d1d5db" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" placeholder="Hľadať názov, lokalitu..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: "100%", height: "36px", paddingLeft: "36px", paddingRight: "12px", background: "#f9fafb", border: "none", borderRadius: "10px", fontSize: "13px", outline: "none" }} />
            </div>
            <select value={viewPortal} onChange={e => { setViewPortal(e.target.value); }}
              style={{ height: "36px", background: "#f9fafb", border: "none", borderRadius: "10px", padding: "0 12px", fontSize: "13px", color: "#4b5563", outline: "none" }}>
              <option value="">Všetky portály</option>
              {PORTALS.filter(p => p.value !== "vsetky").map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <select value={viewTyp} onChange={e => { setViewTyp(e.target.value); }}
              style={{ height: "36px", background: "#f9fafb", border: "none", borderRadius: "10px", padding: "0 12px", fontSize: "13px", color: "#4b5563", outline: "none" }}>
              {TYPY.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={sort} onChange={e => setSort(e.target.value)}
              style={{ height: "36px", background: "#f9fafb", border: "none", borderRadius: "10px", padding: "0 12px", fontSize: "13px", color: "#4b5563", outline: "none" }}>
              {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button onClick={() => setLenSukromni(!lenSukromni)}
              style={{
                height: "36px", padding: "0 14px", borderRadius: "10px",
                fontSize: "13px", fontWeight: 500, border: "none", cursor: "pointer",
                background: lenSukromni ? "#fff7ed" : "#f9fafb",
                color: lenSukromni ? "#c2410c" : "#6b7280",
                boxShadow: lenSukromni ? "inset 0 0 0 1px #fed7aa" : "none",
                transition: "all 0.15s",
              }}>
              {lenSukromni ? "👤 Len súkromní" : "Len súkromní"}
            </button>
          </div>

          <div style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "12px" }}>
            {filtered.length === total ? `${total} inzerátov` : `${filtered.length} z ${total} inzerátov`}
          </div>

          {/* Listings */}
          {filtered.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 0" }}>
              <div style={{
                width: "64px", height: "64px", background: "#f9fafb", borderRadius: "16px",
                display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", fontSize: "28px",
              }}>
                🏠
              </div>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#111827", margin: "0 0 4px" }}>
                {total === 0 ? "Zatiaľ žiadne inzeráty" : "Nič nenájdené"}
              </h3>
              <p style={{ fontSize: "13px", color: "#9ca3af", margin: "0 0 16px", textAlign: "center", maxWidth: "320px" }}>
                {total === 0
                  ? "Pridaj filter a spusti scrape — inzeráty z reality.sk sa zobrazia tu."
                  : "Skús zmeniť filtre alebo vyhľadávanie."}
              </p>
              {total === 0 && (
                <button onClick={() => { setTab("filtre"); setShowNewFilter(true); }}
                  style={{ height: "36px", padding: "0 20px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer", background: "#111827", color: "#fff" }}>
                  Pridať filter
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filtered.map(i => (
                <a key={i.id} href={i.url} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "flex", gap: "14px", padding: "14px",
                    background: "#fff", borderRadius: "14px", border: "1px solid #f3f4f6",
                    textDecoration: "none", color: "inherit",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)"; (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.borderColor = "#f3f4f6"; }}
                >
                  {/* Photo */}
                  <div style={{ width: "112px", height: "80px", background: "#f9fafb", borderRadius: "10px", overflow: "hidden", flexShrink: 0 }}>
                    {i.foto_url ? (
                      <img src={i.foto_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", color: "#d1d5db" }}>🏠</div>
                    )}
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                      <h3 style={{ fontSize: "14px", fontWeight: 500, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {i.nazov || "Bez názvu"}
                      </h3>
                      <span style={{ fontSize: "16px", fontWeight: 700, color: "#111827", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                        {i.cena ? `${fmt(i.cena)} €` : "—"}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#9ca3af" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: PORTAL_DOT[i.portal] || "#d1d5db" }} />
                        {i.portal}
                      </span>
                      {i.typ && <><span style={{ fontSize: "11px", color: "#d1d5db" }}>·</span><span style={{ fontSize: "11px", color: "#9ca3af" }}>{i.typ}</span></>}
                      {i.plocha > 0 && <><span style={{ fontSize: "11px", color: "#d1d5db" }}>·</span><span style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}>{i.plocha} m²</span></>}
                      {i.izby > 0 && <><span style={{ fontSize: "11px", color: "#d1d5db" }}>·</span><span style={{ fontSize: "11px", color: "#6b7280", fontWeight: 500 }}>{i.izby}-izb</span></>}
                      {i.lokalita && <><span style={{ fontSize: "11px", color: "#d1d5db" }}>·</span><span style={{ fontSize: "11px", color: "#9ca3af" }}>{i.lokalita}</span></>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                      <span style={{ fontSize: "11px", color: "#d1d5db" }}>{timeAgo(i.first_seen_at)}</span>
                      {i.predajca_typ === "sukromny" && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: "4px",
                          fontSize: "11px", fontWeight: 600, color: "#c2410c",
                          background: "#fff7ed", padding: "2px 8px", borderRadius: "6px",
                        }}>
                          👤 Súkromný
                        </span>
                      )}
                      {i.predajca_typ && i.predajca_typ !== "sukromny" && (
                        <span style={{ fontSize: "11px", color: "#d1d5db" }}>Realitka</span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ TAB: FILTRE ═══ */}
      {tab === "filtre" && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <p style={{ fontSize: "13px", color: "#9ca3af", margin: 0 }}>Filtre určujú, ktoré inzeráty sa sledujú a scrapujú.</p>
              <p style={{ fontSize: "11px", color: "#d1d5db", margin: "4px 0 0" }}>
                Momentálne funguje: <strong style={{ color: "#10b981" }}>Reality.sk</strong>
                <span style={{ color: "#d1d5db" }}> · </span>
                <span style={{ color: "#9ca3af" }}>Nehnuteľnosti.sk a TopReality.sk vyžadujú ScrapingBee</span>
              </p>
            </div>
            <button onClick={() => setShowNewFilter(!showNewFilter)}
              style={{ height: "36px", padding: "0 16px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer", background: "#111827", color: "#fff" }}>
              + Nový filter
            </button>
          </div>

          {/* New filter form */}
          {showNewFilter && (
            <div style={{
              animation: "slideDown 0.2s ease",
              background: "#fff", borderRadius: "14px", border: "1px solid #f3f4f6",
              padding: "20px", marginBottom: "16px",
            }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#111827", margin: "0 0 16px" }}>Nový filter</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.02em", display: "block", marginBottom: "6px" }}>Názov</label>
                  <input type="text" placeholder='napr. "Byty Petržalka do 150k"' value={nf.nazov}
                    onChange={e => setNf({ ...nf, nazov: e.target.value })}
                    className="w-full h-10 bg-gray-50 border-0 rounded-lg px-3 text-sm focus:ring-2 focus:ring-gray-200 focus:bg-white transition placeholder:text-gray-300" />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.02em", display: "block", marginBottom: "6px" }}>Portál</label>
                  <select value={nf.portal} onChange={e => setNf({ ...nf, portal: e.target.value })}
                    className="w-full h-10 bg-gray-50 border-0 rounded-lg px-3 text-sm focus:ring-2 focus:ring-gray-200">
                    {PORTALS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.02em", display: "block", marginBottom: "6px" }}>Typ</label>
                  <select value={nf.typ} onChange={e => setNf({ ...nf, typ: e.target.value })}
                    className="w-full h-10 bg-gray-50 border-0 rounded-lg px-3 text-sm focus:ring-2 focus:ring-gray-200">
                    {TYPY.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.02em", display: "block", marginBottom: "6px" }}>Lokalita</label>
                  <LokalitaInput
                    value={nf.lokalita}
                    onChange={(display) => setNf({ ...nf, lokalita: display })}
                    placeholder="Bratislava - Petržalka..."
                  />
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.02em", display: "block", marginBottom: "6px" }}>Cena od</label>
                    <input type="number" placeholder="50 000" value={nf.cena_od}
                      onChange={e => setNf({ ...nf, cena_od: e.target.value })}
                      className="w-full h-10 bg-gray-50 border-0 rounded-lg px-3 text-sm focus:ring-2 focus:ring-gray-200 focus:bg-white transition placeholder:text-gray-300" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.02em", display: "block", marginBottom: "6px" }}>Cena do</label>
                    <input type="number" placeholder="200 000" value={nf.cena_do}
                      onChange={e => setNf({ ...nf, cena_do: e.target.value })}
                      className="w-full h-10 bg-gray-50 border-0 rounded-lg px-3 text-sm focus:ring-2 focus:ring-gray-200 focus:bg-white transition placeholder:text-gray-300" />
                  </div>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.02em", display: "block", marginBottom: "6px" }}>
                    Priamy URL na výsledky <span style={{ fontWeight: 400, textTransform: "none" }}>(voliteľné)</span>
                  </label>
                  <input type="url" placeholder="https://www.reality.sk/byty/bratislava-petrzalka/predaj/" value={nf.search_url}
                    onChange={e => setNf({ ...nf, search_url: e.target.value })}
                    className="w-full h-10 bg-gray-50 border-0 rounded-lg px-3 text-sm focus:ring-2 focus:ring-gray-200 focus:bg-white transition placeholder:text-gray-300" />
                  <p style={{ fontSize: "11px", color: "#d1d5db", margin: "4px 0 0" }}>Tip: nastav si filter na portáli a skopíruj URL z prehliadača</p>
                </div>
                <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "20px", paddingTop: "4px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#4b5563", cursor: "pointer" }}>
                    <input type="checkbox" checked={nf.notify_email} onChange={e => setNf({ ...nf, notify_email: e.target.checked })}
                      style={{ borderRadius: "4px" }} />
                    Email notifikácia
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#4b5563", cursor: "pointer" }}>
                    <input type="checkbox" checked={nf.notify_telegram} onChange={e => setNf({ ...nf, notify_telegram: e.target.checked })}
                      style={{ borderRadius: "4px" }} />
                    Telegram
                  </label>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #f9fafb" }}>
                <button onClick={createFilter} disabled={!nf.nazov}
                  style={{
                    height: "36px", padding: "0 20px", borderRadius: "10px",
                    fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer",
                    background: "#111827", color: "#fff",
                    opacity: nf.nazov ? 1 : 0.3,
                  }}>
                  Vytvoriť filter
                </button>
                <button onClick={() => setShowNewFilter(false)}
                  style={{ height: "36px", padding: "0 16px", borderRadius: "10px", fontSize: "13px", color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}>
                  Zrušiť
                </button>
              </div>
            </div>
          )}

          {/* Filter list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {filtre.length === 0 && !showNewFilter && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "64px 0" }}>
                <div style={{ width: "48px", height: "48px", background: "#f9fafb", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px", fontSize: "22px" }}>🔍</div>
                <p style={{ fontSize: "13px", color: "#9ca3af", margin: 0 }}>Zatiaľ žiadne filtre</p>
              </div>
            )}
            {filtre.map(f => (
              <div key={f.id}
                style={{
                  background: "#fff", borderRadius: "14px", border: "1px solid #f3f4f6",
                  padding: "16px", transition: "all 0.2s",
                  opacity: f.is_active ? 1 : 0.4,
                }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#111827", margin: "0 0 8px" }}>{f.nazov}</h3>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: "4px",
                        fontSize: "11px", padding: "2px 8px", borderRadius: "6px", fontWeight: 500,
                        background: f.portal === "vsetky" ? "#f3f4f6" : f.portal === "reality.sk" ? "#ecfdf5" : f.portal === "nehnutelnosti.sk" ? "#eff6ff" : "#f5f3ff",
                        color: f.portal === "vsetky" ? "#6b7280" : f.portal === "reality.sk" ? "#059669" : f.portal === "nehnutelnosti.sk" ? "#2563eb" : "#7c3aed",
                      }}>
                        {f.portal === "vsetky" ? "Všetky" : f.portal}
                      </span>
                      {f.typ && <span style={{ fontSize: "11px", background: "#f9fafb", color: "#6b7280", padding: "2px 8px", borderRadius: "6px" }}>{f.typ}</span>}
                      {f.lokalita && <span style={{ fontSize: "11px", background: "#f9fafb", color: "#6b7280", padding: "2px 8px", borderRadius: "6px" }}>📍 {f.lokalita}</span>}
                      {(f.cena_od || f.cena_do) && (
                        <span style={{ fontSize: "11px", background: "#f9fafb", color: "#6b7280", padding: "2px 8px", borderRadius: "6px" }}>
                          {f.cena_od ? `${fmt(Number(f.cena_od))} €` : "0 €"} – {f.cena_do ? `${fmt(Number(f.cena_do))} €` : "∞"}
                        </span>
                      )}
                      {f.notify_email && <span style={{ fontSize: "11px", color: "#3b82f6" }}>Email</span>}
                      {f.notify_telegram && <span style={{ fontSize: "11px", color: "#06b6d4" }}>Telegram</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "12px" }}>
                    <button onClick={() => toggleFilter(f)}
                      style={{
                        height: "28px", padding: "0 10px", borderRadius: "6px",
                        fontSize: "11px", fontWeight: 500, border: "none", cursor: "pointer",
                        background: f.is_active ? "#ecfdf5" : "#f9fafb",
                        color: f.is_active ? "#059669" : "#9ca3af",
                        transition: "all 0.15s",
                      }}>
                      {f.is_active ? "Aktívny" : "Pauznutý"}
                    </button>
                    <button onClick={() => deleteFilter(f.id)}
                      style={{
                        width: "28px", height: "28px", borderRadius: "6px",
                        border: "none", cursor: "pointer", background: "transparent",
                        color: "#d1d5db", fontSize: "14px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ef4444"; (e.currentTarget as HTMLElement).style.background = "#fef2f2"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#d1d5db"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
