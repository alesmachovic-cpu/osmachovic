"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { filterLokality, type LokalitaEntry } from "@/lib/lokality-db";
import { useAuth } from "@/components/AuthProvider";
import PreCallBriefModal from "@/components/PreCallBriefModal";
import PriceSparkline from "@/components/PriceSparkline";

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
  motivation_score?: number;
  listed_on_n_portals?: number;
  predajca_typ_confidence?: number;
  predajca_typ_method?: string;
  canonical_id?: string | null;
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
  len_sukromni: boolean;
}

/* ── Konštanty ── */
const PORTALS = [
  { value: "vsetky", label: "Všetky portály" },
  { value: "reality.sk", label: "Reality.sk" },
  { value: "bazos.sk", label: "Bazos.sk (najviac súkromných)" },
  { value: "nehnutelnosti.sk", label: "Nehnuteľnosti.sk (⚡ ScrapingBee)" },
  { value: "byty.sk", label: "Byty.sk (⚡ ScrapingBee)" },
  { value: "topreality.sk", label: "TopReality.sk (⚡ ScrapingBee)" },
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
  "nehnutelnosti.sk": "#007AFF",
  "reality.sk": "#34C759",
  "bazos.sk": "#FF9500",
  "byty.sk": "#5AC8FA",
  "topreality.sk": "#AF52DE",
};

/* ── Štýly ── */
const S = {
  card: { background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" },
  label: { fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.04em", display: "block", marginBottom: "6px" },
  input: { width: "100%", height: "38px", background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "0 12px", fontSize: "14px", color: "var(--text-primary)", outline: "none", transition: "all 0.15s" },
  select: { width: "100%", height: "38px", background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "0 12px", fontSize: "14px", color: "var(--text-primary)", outline: "none", cursor: "pointer" },
  btnPrimary: { height: "38px", padding: "0 18px", background: "var(--text-primary)", color: "var(--bg-base)", border: "none", borderRadius: "var(--radius-sm)", fontSize: "14px", fontWeight: 600, cursor: "pointer", transition: "all 0.15s" },
  btnSecondary: { height: "38px", padding: "0 14px", background: "var(--bg-base)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", fontSize: "13px", fontWeight: 500, cursor: "pointer" },
};

/* ── Helpers ── */
const fmt = (n: number) => n.toLocaleString("sk-SK");
const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "práve teraz";
  if (mins < 60) return `pred ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `pred ${hours} hod`;
  const days = Math.floor(hours / 24);
  return `pred ${days} ${days === 1 ? "dňom" : "dňami"}`;
};

/* ── Lokalita Autocomplete ── */
function LokalitaInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [input, setInput] = useState(value);
  const [suggestions, setSuggestions] = useState<LokalitaEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setInput(value); }, [value]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleInput = (v: string) => {
    setInput(v);
    setActiveIdx(-1);
    const res = filterLokality(v, 8);
    setSuggestions(res);
    setOpen(res.length > 0);
    onChange(v);
  };
  const select = (it: LokalitaEntry) => { setInput(it.display); onChange(it.display); setOpen(false); };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        type="text"
        placeholder={placeholder}
        value={input}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => { if (suggestions.length) setOpen(true); }}
        onKeyDown={e => {
          if (!open) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
          else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); select(suggestions[activeIdx]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        style={S.input}
      />
      {open && suggestions.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          maxHeight: "260px", overflowY: "auto",
        }}>
          {suggestions.map((s, i) => (
            <button
              key={s.display + i}
              onClick={() => select(s)}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                display: "flex", alignItems: "center", gap: "10px", width: "100%",
                padding: "10px 12px", border: "none", cursor: "pointer", textAlign: "left",
                fontSize: "14px", color: "var(--text-primary)",
                background: i === activeIdx ? "var(--bg-hover)" : "transparent",
              }}
            >
              <span style={{ color: "var(--text-muted)" }}>📍</span>
              <span style={{ flex: 1 }}>{s.display}</span>
              {s.lokalita !== s.display && (
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{s.lokalita}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Hlavná stránka ── */
function MonitorContent() {
  const router = useRouter();
  const [briefFor, setBriefFor] = useState<{ id: string; url?: string } | null>(null);
  const [inzeraty, setInzeraty] = useState<Inzerat[]>([]);
  const [filtre, setFiltre] = useState<Filter[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"inzeraty" | "filtre">("inzeraty");
  const [showNewFilter, setShowNewFilter] = useState(false);

  const [viewPortal, setViewPortal] = useState("");
  const [viewTyp, setViewTyp] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [lenSukromni, setLenSukromni] = useState(true);  // Default: zobraz len súkromných
  const [onlyToday, setOnlyToday] = useState(false);
  const [onlyMotivated, setOnlyMotivated] = useState(false);
  const [hideDuplicates, setHideDuplicates] = useState(true); // Default: skry dupy z viacerých portálov
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { user } = useAuth();
  const SUPER_ADMIN_EMAILS = [
    "ales.machovic@gmail.com",
    "ales.machovic@vianema.eu",
    "ales@vianema.eu",
  ];
  const userEmails = [user?.email, user?.login_email]
    .filter((e): e is string => typeof e === "string")
    .map((e) => e.toLowerCase());
  const isSuperAdmin = userEmails.some((e) => SUPER_ADMIN_EMAILS.includes(e));

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };

  const loadInzeraty = useCallback(async () => {
    const p = new URLSearchParams();
    if (viewPortal) p.set("portal", viewPortal);
    if (viewTyp) p.set("typ", viewTyp);
    p.set("limit", "200");
    const res = await fetch(`/api/monitor?${p.toString()}`);
    const d = await res.json();
    setInzeraty(d.inzeraty || []);
    setTotal(d.total || 0);
  }, [viewPortal, viewTyp]);

  const loadFiltre = async () => {
    const res = await fetch("/api/monitor/filtre", { credentials: "include" });
    const d = await res.json();
    setFiltre(d.filtre || []);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = (ids: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...ids]);
    });
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!confirm(`Naozaj zmazať ${count} inzerátov? Táto akcia sa nedá vrátiť.`)) return;

    const res = await fetch("/api/monitor/inzeraty", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: Array.from(selectedIds),
        actorEmail: user?.email || "",
        actorLoginEmail: user?.login_email || "",
      }),
    });
    const d = await res.json();
    if (res.ok) {
      showToast(`Zmazaných ${d.deleted} inzerátov`);
      setSelectedIds(new Set());
      await loadInzeraty();
    } else {
      showToast(d.error || "Chyba pri mazaní", "error");
    }
  };

  useEffect(() => {
    Promise.all([loadInzeraty(), loadFiltre()]).finally(() => setLoading(false));
  }, [loadInzeraty]);

  const today = new Date().toISOString().split("T")[0];
  const noveDnes = inzeraty.filter(i => i.first_seen_at?.startsWith(today)).length;
  const sukromniCount = inzeraty.filter(i => i.predajca_typ === "sukromny").length;
  const motivovaniCount = inzeraty.filter(i => (i.motivation_score ?? 0) >= 30).length;
  const aktivneFiltre = filtre.filter(f => f.is_active).length;

  const filtered = inzeraty
    .filter(i => {
      if (lenSukromni && i.predajca_typ !== "sukromny") return false;
      if (onlyToday && !(i.first_seen_at || "").startsWith(today)) return false;
      if (onlyMotivated && (i.motivation_score ?? 0) < 30) return false;
      if (hideDuplicates && i.canonical_id) return false; // skry duplikáty (canonical_id ≠ null = sekundárny)
      if (search) {
        const q = search.toLowerCase();
        if (!(i.nazov || "").toLowerCase().includes(q) && !(i.lokalita || "").toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === "price_asc") return (a.cena || 9e9) - (b.cena || 9e9);
      if (sort === "price_desc") return (b.cena || 0) - (a.cena || 0);
      return new Date(b.first_seen_at).getTime() - new Date(a.first_seen_at).getTime();
    });

  const defaultForm = {
    nazov: "", portal: "reality.sk", typ: "byt", lokalita: "",
    cena_od: "", cena_do: "", search_url: "",
    notify_email: true, notify_telegram: false,
    len_sukromni: true,
  };
  const [nf, setNf] = useState(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ef, setEf] = useState(defaultForm);

  const startEdit = (f: Filter) => {
    setEditingId(f.id);
    setEf({
      nazov: f.nazov || "",
      portal: f.portal || "reality.sk",
      typ: f.typ || "",
      lokalita: f.lokalita || "",
      cena_od: f.cena_od ? String(f.cena_od) : "",
      cena_do: f.cena_do ? String(f.cena_do) : "",
      search_url: f.search_url || "",
      notify_email: f.notify_email,
      notify_telegram: f.notify_telegram,
      len_sukromni: f.len_sukromni ?? true,
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const body = {
      id: editingId,
      ...ef,
      cena_od: ef.cena_od ? parseFloat(ef.cena_od) : null,
      cena_do: ef.cena_do ? parseFloat(ef.cena_do) : null,
      typ: ef.typ || null,
      lokalita: ef.lokalita || null,
      search_url: ef.search_url || null,
    };
    const res = await fetch("/api/monitor/filtre", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setEditingId(null);
      loadFiltre();
      showToast("Filter aktualizovaný");
    } else {
      showToast("Chyba pri ukladaní", "error");
    }
  };

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
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setShowNewFilter(false);
      setNf({ nazov: "", portal: "reality.sk", typ: "byt", lokalita: "", cena_od: "", cena_do: "", search_url: "", notify_email: true, notify_telegram: false, len_sukromni: true });
      loadFiltre();
      showToast("Filter vytvorený");
    } else {
      showToast("Chyba pri vytváraní filtra", "error");
    }
  };

  const toggleFilter = async (f: Filter) => {
    await fetch("/api/monitor/filtre", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
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

  const [scraping, setScraping] = useState(false);
  const runScrape = async () => {
    setScraping(true);
    try {
      const res = await fetch("/api/cron/scrape?key=__internal__");
      const d = await res.json();
      if (res.ok) {
        showToast(d.message || "Scrape dokončený");
        await loadInzeraty();
      } else {
        showToast(d.error || "Chyba pri scrape", "error");
      }
    } catch {
      showToast("Chyba pri scrape", "error");
    } finally {
      setScraping(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "120px 0" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "32px", height: "32px", border: "2px solid var(--border)", borderTopColor: "var(--text-primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Načítavam monitor...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: "16px", right: "16px", zIndex: 100,
          background: toast.type === "error" ? "var(--danger)" : "var(--text-primary)",
          color: "var(--bg-base)", padding: "12px 18px", borderRadius: "var(--radius-md)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          fontSize: "13px", fontWeight: 500, animation: "slideIn 0.25s ease",
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: toast.type === "error" ? "#fca5a5" : "var(--success)" }} />
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>Monitor</h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: "4px 0 0" }}>
            Sledovanie nových inzerátov na slovenských portáloch
          </p>
        </div>
        <button
          onClick={runScrape}
          disabled={scraping || aktivneFiltre === 0}
          style={{
            ...S.btnPrimary,
            opacity: (scraping || aktivneFiltre === 0) ? 0.4 : 1,
            cursor: (scraping || aktivneFiltre === 0) ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: "8px",
          }}
        >
          {scraping ? (
            <>
              <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
              Scrapujem...
            </>
          ) : aktivneFiltre === 0 ? "Pridaj filter" : "Spustiť scrape"}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          {
            label: "Celkom inzerátov", value: total, color: "var(--text-primary)",
            onClick: () => { setTab("inzeraty"); setSearch(""); setViewPortal(""); setViewTyp(""); setLenSukromni(false); setOnlyToday(false); setOnlyMotivated(false); },
            active: tab === "inzeraty" && !lenSukromni && !onlyToday && !onlyMotivated && !search && !viewPortal && !viewTyp,
          },
          {
            label: "Nové dnes", value: noveDnes, color: noveDnes > 0 ? "var(--accent)" : "var(--text-primary)",
            onClick: () => { setTab("inzeraty"); setOnlyToday(true); setOnlyMotivated(false); },
            active: tab === "inzeraty" && onlyToday,
          },
          {
            label: "Súkromní", value: sukromniCount, color: sukromniCount > 0 ? "var(--warning)" : "var(--text-primary)",
            onClick: () => { setTab("inzeraty"); setLenSukromni(true); setOnlyMotivated(false); },
            active: tab === "inzeraty" && lenSukromni && !onlyMotivated,
          },
          {
            label: "🔥 Motivovaní", value: motivovaniCount, color: motivovaniCount > 0 ? "#dc2626" : "var(--text-primary)",
            onClick: () => { setTab("inzeraty"); setOnlyMotivated(true); setLenSukromni(false); },
            active: tab === "inzeraty" && onlyMotivated,
          },
          {
            label: "Aktívne filtre", value: aktivneFiltre, color: aktivneFiltre > 0 ? "var(--success)" : "var(--text-muted)",
            onClick: () => setTab("filtre"),
            active: tab === "filtre",
          },
        ].map((s, i) => (
          <button
            key={i}
            onClick={s.onClick}
            style={{
              ...S.card, padding: "16px 18px",
              textAlign: "left" as const, cursor: "pointer",
              transition: "all 0.15s",
              borderColor: s.active ? "var(--text-primary)" : "var(--border-subtle)",
              boxShadow: s.active ? "0 0 0 2px var(--text-primary)20" : "none",
            }}
            onMouseEnter={e => { if (!s.active) (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
            onMouseLeave={e => { if (!s.active) (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"; }}
          >
            <div style={{ fontSize: "28px", fontWeight: 700, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", fontWeight: 500 }}>{s.label}</div>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "1px solid var(--border-subtle)" }}>
        {(["inzeraty", "filtre"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "12px 18px", fontSize: "14px", fontWeight: 500,
              border: "none", background: "transparent", cursor: "pointer",
              borderBottom: tab === t ? "2px solid var(--text-primary)" : "2px solid transparent",
              color: tab === t ? "var(--text-primary)" : "var(--text-muted)",
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
            <div style={{ position: "relative", flex: "1 1 240px", maxWidth: "320px" }}>
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: "14px" }}>🔍</span>
              <input
                type="text"
                placeholder="Hľadať názov, lokalitu..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...S.input, paddingLeft: "38px" }}
              />
            </div>
            <select value={viewPortal} onChange={e => setViewPortal(e.target.value)} style={{ ...S.select, width: "auto", minWidth: "160px" }}>
              <option value="">Všetky portály</option>
              {PORTALS.filter(p => p.value !== "vsetky").map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <select value={viewTyp} onChange={e => setViewTyp(e.target.value)} style={{ ...S.select, width: "auto", minWidth: "140px" }}>
              {TYPY.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={sort} onChange={e => setSort(e.target.value)} style={{ ...S.select, width: "auto", minWidth: "140px" }}>
              {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button
              onClick={() => setLenSukromni(!lenSukromni)}
              style={{
                ...S.btnSecondary,
                background: lenSukromni ? "var(--warning-light)" : "var(--bg-base)",
                color: lenSukromni ? "var(--warning)" : "var(--text-secondary)",
                borderColor: lenSukromni ? "var(--warning)" : "var(--border-subtle)",
                fontWeight: 600,
              }}
            >
              👤 Len súkromní
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              {filtered.length === total ? `${total} inzerátov` : `${filtered.length} z ${total}`}
              {isSuperAdmin && filtered.length > 0 && (
                <>
                  {" · "}
                  <button
                    onClick={() => selectAllVisible(filtered.map((f) => f.id))}
                    style={{ background: "none", border: "none", color: "var(--text-link, #007AFF)", cursor: "pointer", fontSize: "13px", padding: 0 }}
                  >
                    {filtered.every((f) => selectedIds.has(f.id)) ? "Zrušiť výber" : "Vybrať všetky"}
                  </button>
                </>
              )}
            </div>
            {isSuperAdmin && selectedIds.size > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                  Vybrané: {selectedIds.size}
                </span>
                <button
                  onClick={deleteSelected}
                  style={{ ...S.btnSecondary, background: "#FEE2E2", color: "#B91C1C", borderColor: "#FCA5A5", fontWeight: 600 }}
                >
                  🗑️ Zmazať vybrané
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  style={S.btnSecondary}
                >
                  Zrušiť
                </button>
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <div style={{ ...S.card, padding: "80px 32px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏠</div>
              <h3 style={{ fontSize: "17px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 6px" }}>
                {total === 0 ? "Zatiaľ žiadne inzeráty" : "Nič nenájdené"}
              </h3>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: "0 0 20px", maxWidth: "400px" }}>
                {total === 0
                  ? "Pridaj filter v záložke Filtre a spusti prvý scrape. Inzeráty z reality.sk sa objavia tu."
                  : "Skús zmeniť filtre alebo vyhľadávanie."}
              </p>
              {total === 0 && (
                <button onClick={() => { setTab("filtre"); setShowNewFilter(true); }} style={S.btnPrimary}>
                  Pridať filter
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {filtered.map(i => (
                <a
                  key={i.id}
                  href={i.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    ...S.card, padding: "16px",
                    display: "flex", gap: "16px",
                    textDecoration: "none", color: "inherit",
                    transition: "all 0.15s",
                    background: selectedIds.has(i.id) ? "var(--warning-light, #FEF3C7)" : S.card.background,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"; }}
                >
                  {isSuperAdmin && (
                    <div
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelect(i.id); }}
                      style={{ display: "flex", alignItems: "center", paddingRight: "4px", cursor: "pointer" }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(i.id)}
                        onChange={() => {}}
                        style={{ width: "18px", height: "18px", cursor: "pointer" }}
                      />
                    </div>
                  )}
                  <div style={{ width: "120px", height: "90px", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", overflow: "hidden", flexShrink: 0 }}>
                    {i.foto_url ? (
                      <img src={i.foto_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", color: "var(--text-muted)" }}>🏠</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
                      <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {i.nazov || "Bez názvu"}
                      </h3>
                      <span style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                        {i.cena ? `${fmt(i.cena)} €` : "—"}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: PORTAL_DOT[i.portal] || "var(--text-muted)" }} />
                        {i.portal}
                      </span>
                      {i.typ && <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{i.typ}</span>}
                      {i.plocha > 0 && <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>{i.plocha} m²</span>}
                      {i.izby > 0 && <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>{i.izby}-izb</span>}
                      {i.lokalita && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>📍 {i.lokalita}</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{timeAgo(i.first_seen_at)}</span>
                      {i.predajca_typ === "sukromny" && (
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--warning)", background: "var(--warning-light)", padding: "2px 8px", borderRadius: "6px" }}>
                          👤 Súkromný
                        </span>
                      )}
                      {(i.motivation_score ?? 0) >= 60 && (
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#fff", background: "#dc2626", padding: "2px 8px", borderRadius: "6px" }}
                          title="Vysoko motivovaný predajca">
                          🔥🔥🔥 {i.motivation_score}
                        </span>
                      )}
                      {(i.motivation_score ?? 0) >= 30 && (i.motivation_score ?? 0) < 60 && (
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#fff", background: "#ea580c", padding: "2px 8px", borderRadius: "6px" }}
                          title="Motivovaný predajca">
                          🔥 {i.motivation_score}
                        </span>
                      )}
                      {(i.listed_on_n_portals ?? 1) >= 3 && (
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "#1e40af", background: "#dbeafe", padding: "2px 8px", borderRadius: "6px" }}
                          title="Inzerát je listovaný na viacerých portáloch">
                          📡 {i.listed_on_n_portals} portálov
                        </span>
                      )}
                      <PriceSparkline inzeratId={i.id} currentPrice={i.cena} />
                      <button onClick={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        setBriefFor({ id: i.id, url: i.url });
                      }} style={{
                        marginLeft: "auto",
                        fontSize: "11px", fontWeight: 600, color: "#7c2d12",
                        background: "#fed7aa", border: "none",
                        padding: "3px 10px", borderRadius: "6px", cursor: "pointer",
                      }} title="Pre-call brief — čo povedať predajcovi pred zavolaním">
                        📞 Brief
                      </button>
                      <button onClick={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        router.push(`/analyzy?analyze=${encodeURIComponent(i.url)}`);
                      }} style={{
                        fontSize: "11px", fontWeight: 600, color: "#1e3a8a",
                        background: "#dbeafe", border: "none",
                        padding: "3px 10px", borderRadius: "6px", cursor: "pointer",
                      }} title="Analyzovať tento inzerát — porovnanie s trhom + AI verdikt + PDF">
                        🔍 Analyzovať
                      </button>
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
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0 }}>Filtre určujú, ktoré inzeráty sa sledujú a scrapujú.</p>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "4px 0 0" }}>
                Funguje: <strong style={{ color: "var(--success)" }}>Reality.sk</strong>
                <span style={{ margin: "0 6px" }}>·</span>
                Nehnuteľnosti.sk a TopReality.sk vyžadujú ScrapingBee API
              </p>
            </div>
            <button onClick={() => setShowNewFilter(!showNewFilter)} style={S.btnPrimary}>
              + Nový filter
            </button>
          </div>

          {showNewFilter && (
            <div style={{ ...S.card, padding: "24px", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 18px" }}>Nový filter</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={S.label}>Názov</label>
                  <input
                    type="text"
                    placeholder='napr. "Byty Petržalka do 150k"'
                    value={nf.nazov}
                    onChange={e => setNf({ ...nf, nazov: e.target.value })}
                    style={S.input}
                  />
                </div>
                <div>
                  <label style={S.label}>Portál</label>
                  <select value={nf.portal} onChange={e => setNf({ ...nf, portal: e.target.value })} style={S.select}>
                    {PORTALS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Typ</label>
                  <select value={nf.typ} onChange={e => setNf({ ...nf, typ: e.target.value })} style={S.select}>
                    {TYPY.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Lokalita</label>
                  <LokalitaInput
                    value={nf.lokalita}
                    onChange={v => setNf({ ...nf, lokalita: v })}
                    placeholder="Bratislava - Petržalka (alebo viac, oddel čiarkou)"
                  />
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                    💡 Pre menšie obce zadaj viacero oddelených čiarkou — napr. <code>Bernolákovo, Ivanka pri Dunaji, Senec</code>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={S.label}>Cena od</label>
                    <input
                      type="number"
                      placeholder="50 000"
                      value={nf.cena_od}
                      onChange={e => setNf({ ...nf, cena_od: e.target.value })}
                      style={S.input}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={S.label}>Cena do</label>
                    <input
                      type="number"
                      placeholder="200 000"
                      value={nf.cena_do}
                      onChange={e => setNf({ ...nf, cena_do: e.target.value })}
                      style={S.input}
                    />
                  </div>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={S.label}>Priamy URL na výsledky <span style={{ fontWeight: 400, textTransform: "none", color: "var(--text-muted)" }}>(voliteľné, prepíše vyššie nastavenia)</span></label>
                  <input
                    type="url"
                    placeholder="https://www.reality.sk/byty/predaj/"
                    value={nf.search_url}
                    onChange={e => setNf({ ...nf, search_url: e.target.value })}
                    style={S.input}
                  />
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "6px 0 0" }}>
                    💡 Tip: nastav si filter na portáli a skopíruj URL z prehliadača
                  </p>
                </div>
                {/* Len súkromní — highlight keďže je default */}
                <div style={{ gridColumn: "1 / -1", padding: "12px", background: "var(--warning-light)", border: "1px solid var(--warning)", borderRadius: "var(--radius-sm)" }}>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "14px", color: "var(--warning)", cursor: "pointer", fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={nf.len_sukromni}
                      onChange={e => setNf({ ...nf, len_sukromni: e.target.checked })}
                      style={{ width: "18px", height: "18px", marginTop: "2px", cursor: "pointer" }}
                    />
                    <div>
                      👤 Len súkromní predajcovia
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 400, marginTop: "2px" }}>
                        Zapnuté = potenciálne leady (notifikácie, kupujúci pre teba).<br/>
                        Vypnuté = uložia sa aj RK inzeráty pre <strong>analýzy cien</strong> (bez notifikácií).
                      </div>
                    </div>
                  </label>
                </div>

                <div style={{ gridColumn: "1 / -1", display: "flex", gap: "24px", paddingTop: "4px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--text-secondary)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={nf.notify_email}
                      onChange={e => setNf({ ...nf, notify_email: e.target.checked })}
                      style={{ width: "16px", height: "16px" }}
                    />
                    Email notifikácia
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--text-secondary)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={nf.notify_telegram}
                      onChange={e => setNf({ ...nf, notify_telegram: e.target.checked })}
                      style={{ width: "16px", height: "16px" }}
                    />
                    Telegram
                  </label>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border-subtle)" }}>
                <button
                  onClick={createFilter}
                  disabled={!nf.nazov}
                  style={{ ...S.btnPrimary, opacity: nf.nazov ? 1 : 0.4, cursor: nf.nazov ? "pointer" : "not-allowed" }}
                >
                  Vytvoriť filter
                </button>
                <button onClick={() => setShowNewFilter(false)} style={{ ...S.btnSecondary, border: "none", background: "transparent" }}>
                  Zrušiť
                </button>
              </div>
            </div>
          )}

          {/* Filter list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filtre.length === 0 && !showNewFilter && (
              <div style={{ ...S.card, padding: "64px 24px", textAlign: "center" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔍</div>
                <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0 }}>Zatiaľ žiadne filtre</p>
              </div>
            )}
            {filtre.map(f => (
              <div key={f.id} style={{ ...S.card, padding: "18px", opacity: f.is_active ? 1 : 0.5 }}>
                {editingId === f.id ? (
                  /* ── EDIT FORM ── */
                  <div>
                    <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 14px" }}>Upraviť filter</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={S.label}>Názov</label>
                        <input type="text" value={ef.nazov} onChange={e => setEf({ ...ef, nazov: e.target.value })} style={S.input} />
                      </div>
                      <div>
                        <label style={S.label}>Portál</label>
                        <select value={ef.portal} onChange={e => setEf({ ...ef, portal: e.target.value })} style={S.select}>
                          {PORTALS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={S.label}>Typ</label>
                        <select value={ef.typ} onChange={e => setEf({ ...ef, typ: e.target.value })} style={S.select}>
                          {TYPY.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={S.label}>Lokalita</label>
                        <LokalitaInput value={ef.lokalita} onChange={v => setEf({ ...ef, lokalita: v })} placeholder="Bratislava - Petržalka" />
                      </div>
                      <div>
                        <label style={S.label}>Cena od</label>
                        <input type="number" placeholder="50 000" value={ef.cena_od} onChange={e => setEf({ ...ef, cena_od: e.target.value })} style={S.input} />
                      </div>
                      <div>
                        <label style={S.label}>Cena do</label>
                        <input type="number" placeholder="200 000" value={ef.cena_do} onChange={e => setEf({ ...ef, cena_do: e.target.value })} style={S.input} />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={S.label}>Priamy URL <span style={{ fontWeight: 400, textTransform: "none" }}>(voliteľné)</span></label>
                        <input type="url" value={ef.search_url} onChange={e => setEf({ ...ef, search_url: e.target.value })} style={S.input} placeholder="https://www.reality.sk/..." />
                      </div>
                      <div style={{ gridColumn: "1 / -1", padding: "10px", background: ef.len_sukromni ? "var(--warning-light)" : "var(--accent-light)", border: `1px solid ${ef.len_sukromni ? "var(--warning)" : "var(--accent)"}`, borderRadius: "var(--radius-sm)" }}>
                        <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13px", cursor: "pointer", color: ef.len_sukromni ? "var(--warning)" : "var(--accent)", fontWeight: 600 }}>
                          <input type="checkbox" checked={ef.len_sukromni} onChange={e => setEf({ ...ef, len_sukromni: e.target.checked })} style={{ width: "16px", height: "16px", marginTop: "2px" }} />
                          <div>
                            {ef.len_sukromni ? "👤 Len súkromní predajcovia (leady + notifikácie)" : "📊 Vrátane RK — pre prehľad cien a analýzy"}
                            <div style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 400, marginTop: "2px" }}>
                              {ef.len_sukromni
                                ? "Vypni ak chceš aj RK inzeráty na sledovanie trhových cien"
                                : "RK inzeráty sa ukladajú ale neposielajú notifikácie — slúžia len pre cenové analýzy"}
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border-subtle)" }}>
                      <button onClick={saveEdit} disabled={!ef.nazov} style={{ ...S.btnPrimary, opacity: ef.nazov ? 1 : 0.4 }}>Uložiť</button>
                      <button onClick={() => setEditingId(null)} style={{ ...S.btnSecondary, border: "none", background: "transparent" }}>Zrušiť</button>
                    </div>
                  </div>
                ) : (
                  /* ── DISPLAY ROW ── */
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 8px" }}>{f.nazov}</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        <span style={{
                          fontSize: "12px", padding: "3px 10px", borderRadius: "6px", fontWeight: 500,
                          background: f.portal === "vsetky" ? "var(--bg-hover)" : f.portal === "reality.sk" ? "var(--success-light)" : f.portal === "nehnutelnosti.sk" ? "var(--accent-light)" : "var(--purple-light)",
                          color: f.portal === "vsetky" ? "var(--text-secondary)" : f.portal === "reality.sk" ? "var(--success)" : f.portal === "nehnutelnosti.sk" ? "var(--accent)" : "var(--purple)",
                        }}>
                          {f.portal === "vsetky" ? "Všetky" : f.portal}
                        </span>
                        {f.typ && <span style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "6px", background: "var(--bg-hover)", color: "var(--text-secondary)" }}>{f.typ}</span>}
                        {f.lokalita && <span style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "6px", background: "var(--bg-hover)", color: "var(--text-secondary)" }}>📍 {f.lokalita}</span>}
                        {(f.cena_od || f.cena_do) && (
                          <span style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "6px", background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                            {f.cena_od ? `${fmt(Number(f.cena_od))} €` : "0 €"} – {f.cena_do ? `${fmt(Number(f.cena_do))} €` : "∞"}
                          </span>
                        )}
                        {f.len_sukromni === false
                          ? <span style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "6px", background: "var(--accent-light)", color: "var(--accent)", fontWeight: 600 }}>📊 Vrátane RK</span>
                          : <span style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "6px", background: "var(--warning-light)", color: "var(--warning)", fontWeight: 600 }}>👤 Len súkromní</span>
                        }
                        {f.notify_email && <span style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 500 }}>📧 Email</span>}
                        {f.notify_telegram && <span style={{ fontSize: "12px", color: "var(--purple)", fontWeight: 500 }}>✈️ Telegram</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button
                        onClick={() => startEdit(f)}
                        style={{ width: "30px", height: "30px", borderRadius: "6px", border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
                        title="Upraviť filter"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => toggleFilter(f)}
                        style={{
                          height: "30px", padding: "0 12px", borderRadius: "6px",
                          fontSize: "12px", fontWeight: 600, border: "none", cursor: "pointer",
                          background: f.is_active ? "var(--success-light)" : "var(--bg-hover)",
                          color: f.is_active ? "var(--success)" : "var(--text-muted)",
                        }}
                      >
                        {f.is_active ? "Aktívny" : "Pauznutý"}
                      </button>
                      <button
                        onClick={() => deleteFilter(f.id)}
                        style={{ width: "30px", height: "30px", borderRadius: "6px", border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--danger-light)"; (e.currentTarget as HTMLElement).style.color = "var(--danger)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        select:focus, input:focus { border-color: var(--accent) !important; box-shadow: 0 0 0 3px var(--accent-light) !important; }
      `}</style>

      {briefFor && (
        <PreCallBriefModal
          inzeratId={briefFor.id}
          sourceUrl={briefFor.url}
          onClose={() => setBriefFor(null)}
        />
      )}
    </div>
  );
}

// ── Market Analýza (len trhové dáta, bez portfólio widgetov) ──
import { Suspense } from "react";

interface MarketSentiment {
  lokalita: string; typ: string; izby: number | null;
  active_count: number; median_eur_per_m2: number | null;
  median_dom: number | null; demand_index: number; price_change_30d_pct: number | null;
}
interface MktDisapRow {
  id: string; disappeared_on: string; estimated_sale_price: number | null;
  total_days_on_market: number; estimated_discount_pct: number | null;
  monitor_inzeraty: { lokalita: string | null; typ: string | null; izby: number | null; nazov: string | null } | null;
}

function MonitorAnalyzaContent() {
  const [loading, setLoading] = useState(true);
  const [sentiments, setSentiments] = useState<MarketSentiment[]>([]);
  const [disappearances, setDisappearances] = useState<MktDisapRow[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("market_sentiments")
        .select("lokalita,typ,izby,active_count,median_eur_per_m2,median_dom,demand_index,price_change_30d_pct,sentiment_date")
        .order("sentiment_date", { ascending: false })
        .order("demand_index", { ascending: false })
        .limit(50),
      supabase.from("monitor_inzeraty_disappearances")
        .select("id,disappeared_on,estimated_sale_price,total_days_on_market,estimated_discount_pct,monitor_inzeraty(lokalita,typ,izby,nazov)")
        .eq("classification", "likely_sold")
        .gte("confidence_score", 0.6)
        .order("disappeared_on", { ascending: false })
        .limit(20),
    ]).then(([{ data: s }, { data: d }]) => {
      const all = (s ?? []) as Array<MarketSentiment & { sentiment_date: string }>;
      const latestDate = all[0]?.sentiment_date;
      setSentiments(latestDate ? all.filter(x => x.sentiment_date === latestDate) : []);
      setDisappearances((d ?? []) as unknown as MktDisapRow[]);
      setLoading(false);
    });
  }, []);

  const hotSegments = [...sentiments].sort((a, b) => b.demand_index - a.demand_index).slice(0, 5);
  const coldSegments = [...sentiments].sort((a, b) => a.demand_index - b.demand_index).slice(0, 5);

  if (loading) return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Načítavam...</div>;
  if (!sentiments.length && !disappearances.length) return (
    <div style={{ padding: "60px 40px", textAlign: "center", color: "var(--text-muted)" }}>
      <div style={{ fontSize: "32px", marginBottom: "12px" }}>📡</div>
      <div style={{ fontWeight: 600, marginBottom: "6px" }}>Žiadne dáta</div>
      <div style={{ fontSize: "13px" }}>Spusti scraping vo záložke Scraping — dáta sa objavia automaticky.</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "1000px" }}>
      <div>
        <h2 style={{ fontSize: "18px", fontWeight: "700", margin: "0 0 4px", color: "var(--text-primary)" }}>AI Analýza trhu</h2>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>Segmentová analýza, cenová heatmap a detegované predaje z monitoringu</p>
      </div>

      {(hotSegments.length > 0 || coldSegments.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {hotSegments.length > 0 && (
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", borderLeft: "4px solid #dc2626" }}>
              <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)", marginBottom: "12px" }}>🔥 Najhorúcejšie segmenty</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {hotSegments.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "8px", background: "var(--bg-elevated)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{s.lokalita}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {s.typ}{s.izby != null ? ` · ${s.izby} izb.` : ""} · {s.active_count} ponúk{s.median_eur_per_m2 ? ` · ${Math.round(s.median_eur_per_m2).toLocaleString("sk")} €/m²` : ""}
                      </div>
                    </div>
                    <div style={{ padding: "6px 12px", borderRadius: "8px", background: "#fee2e2", color: "#991b1b", fontSize: "13px", fontWeight: 800 }}>{s.demand_index}/10</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {coldSegments.length > 0 && (
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", borderLeft: "4px solid #3b82f6" }}>
              <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)", marginBottom: "12px" }}>❄️ Pomalé segmenty</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {coldSegments.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "8px", background: "var(--bg-elevated)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{s.lokalita}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {s.typ}{s.izby != null ? ` · ${s.izby} izb.` : ""} · {s.active_count} ponúk{s.median_dom != null ? ` · ${s.median_dom} dní na trhu` : ""}
                      </div>
                    </div>
                    <div style={{ padding: "6px 12px", borderRadius: "8px", background: "#dbeafe", color: "#1e40af", fontSize: "13px", fontWeight: 800 }}>{s.demand_index}/10</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {sentiments.length > 0 && (() => {
        const byDistrict = new Map<string, { lokalita: string; segments: number; medians: number[]; demands: number[] }>();
        for (const s of sentiments) {
          if (!s.median_eur_per_m2) continue;
          const key = s.lokalita.replace(/^Reality\s+/i, "");
          if (!byDistrict.has(key)) byDistrict.set(key, { lokalita: key, segments: 0, medians: [], demands: [] });
          const d = byDistrict.get(key)!;
          d.segments++; d.medians.push(Number(s.median_eur_per_m2)); d.demands.push(Number(s.demand_index));
        }
        const districts = Array.from(byDistrict.values()).map(d => ({
          lokalita: d.lokalita, segments: d.segments,
          avg_eur_per_m2: Math.round(d.medians.reduce((s, x) => s + x, 0) / d.medians.length),
          avg_demand: Math.round((d.demands.reduce((s, x) => s + x, 0) / d.demands.length) * 10) / 10,
        }));
        if (!districts.length) return null;
        const maxP = Math.max(...districts.map(d => d.avg_eur_per_m2));
        const minP = Math.min(...districts.map(d => d.avg_eur_per_m2));
        const range = maxP - minP || 1;
        return (
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", borderLeft: "4px solid #7c3aed" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>🗺 Cenová heatmap (per lokalita)</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{districts.length} lokalít · {minP.toLocaleString("sk")} – {maxP.toLocaleString("sk")} €/m²</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {districts.sort((a, b) => b.avg_eur_per_m2 - a.avg_eur_per_m2).map(d => {
                const ratio = (d.avg_eur_per_m2 - minP) / range;
                const hue = (1 - ratio) * 120;
                const bg = `hsl(${hue},70%,92%)`; const txt = `hsl(${hue},60%,30%)`;
                return (
                  <div key={d.lokalita} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderRadius: "8px", background: bg }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: txt }}>{d.lokalita}</div>
                      <div style={{ fontSize: "11px", color: txt, opacity: 0.75 }}>{d.segments} segmentov · demand {d.avg_demand}/10</div>
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: txt }}>{d.avg_eur_per_m2.toLocaleString("sk")} €/m²</div>
                    <div style={{ width: "60px", height: "6px", borderRadius: "3px", background: "rgba(0,0,0,0.08)", overflow: "hidden" }}>
                      <div style={{ width: `${ratio * 100}%`, height: "100%", background: txt, opacity: 0.7 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {disappearances.length > 0 && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", borderLeft: "4px solid #16a34a" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>✅ Detegované predaje (z monitoringu)</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Posledných {disappearances.length} · odhad realizačnej ceny</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {disappearances.slice(0, 8).map(d => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: "8px", background: "var(--bg-elevated)", fontSize: "12px" }}>
                <div style={{ flex: 1, minWidth: 0, marginRight: "10px" }}>
                  <div style={{ color: "var(--text-primary)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {d.monitor_inzeraty?.lokalita || "—"} · {d.monitor_inzeraty?.typ || "—"}{d.monitor_inzeraty?.izby != null ? ` · ${d.monitor_inzeraty.izby} izb.` : ""}
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "1px" }}>
                    {new Date(d.disappeared_on).toLocaleDateString("sk")} · {d.total_days_on_market} dní na trhu
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#15803d", fontWeight: 700 }}>{d.estimated_sale_price != null ? `${Math.round(d.estimated_sale_price).toLocaleString("sk")} €` : "—"}</div>
                  <div style={{ color: "var(--text-muted)", fontSize: "10px" }}>{d.estimated_discount_pct != null ? `−${d.estimated_discount_pct}% od pôvodnej` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const MONITOR_TABS = [
  { key: "scraping", label: "Scraping", icon: "📡" },
  { key: "analyza",  label: "AI Analýza", icon: "📈" },
] as const;

function MonitorWrapper() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = sp.get("tab");
  const tab = (MONITOR_TABS.find(t => t.key === raw)?.key) || "scraping";

  return (
    <div>
      <div style={{
        display: "flex", gap: "6px", marginBottom: "20px",
        borderBottom: "1px solid var(--border)",
      }}>
        {MONITOR_TABS.map(t => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => router.push(`${pathname}?tab=${t.key}`)}
              style={{
                padding: "10px 18px", borderRadius: "10px 10px 0 0",
                border: "none", background: active ? "var(--bg-elevated)" : "transparent",
                color: active ? "var(--text-primary)" : "var(--text-muted)",
                fontSize: "13px", fontWeight: active ? 700 : 500, cursor: "pointer",
                borderBottom: active ? "2px solid var(--accent, #3B82F6)" : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >
              <span style={{ marginRight: "6px" }}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "scraping" && <MonitorContent />}
      {tab === "analyza" && <MonitorAnalyzaContent />}
    </div>
  );
}

export default function MonitorPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Načítavam...</div>}>
      <MonitorWrapper />
    </Suspense>
  );
}
