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
  "nehnutelnosti.sk": "#007AFF",
  "reality.sk": "#34C759",
  "topreality.sk": "#AF52DE",
};

/* ── Štýly ── */
const S = {
  card: { background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" },
  label: { fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.04em", display: "block", marginBottom: "6px" },
  input: { width: "100%", height: "38px", background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "0 12px", fontSize: "14px", color: "var(--text-primary)", outline: "none", transition: "all 0.15s" },
  select: { width: "100%", height: "38px", background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "0 12px", fontSize: "14px", color: "var(--text-primary)", outline: "none", cursor: "pointer" },
  btnPrimary: { height: "38px", padding: "0 18px", background: "var(--text-primary)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", fontSize: "14px", fontWeight: 600, cursor: "pointer", transition: "all 0.15s" },
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
export default function MonitorPage() {
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
  const [lenSukromni, setLenSukromni] = useState(false);

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
    const res = await fetch("/api/monitor/filtre");
    const d = await res.json();
    setFiltre(d.filtre || []);
  };

  useEffect(() => {
    Promise.all([loadInzeraty(), loadFiltre()]).finally(() => setLoading(false));
  }, [loadInzeraty]);

  const today = new Date().toISOString().split("T")[0];
  const noveDnes = inzeraty.filter(i => i.first_seen_at?.startsWith(today)).length;
  const sukromniCount = inzeraty.filter(i => i.predajca_typ === "sukromny").length;
  const aktivneFiltre = filtre.filter(f => f.is_active).length;

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
      if (sort === "price_asc") return (a.cena || 9e9) - (b.cena || 9e9);
      if (sort === "price_desc") return (b.cena || 0) - (a.cena || 0);
      return new Date(b.first_seen_at).getTime() - new Date(a.first_seen_at).getTime();
    });

  const [nf, setNf] = useState({
    nazov: "", portal: "reality.sk", typ: "byt", lokalita: "",
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
      setNf({ nazov: "", portal: "reality.sk", typ: "byt", lokalita: "", cena_od: "", cena_do: "", search_url: "", notify_email: true, notify_telegram: false });
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
          color: "#fff", padding: "12px 18px", borderRadius: "var(--radius-md)",
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Celkom inzerátov", value: total, color: "var(--text-primary)" },
          { label: "Nové dnes", value: noveDnes, color: noveDnes > 0 ? "var(--accent)" : "var(--text-primary)" },
          { label: "Súkromní", value: sukromniCount, color: sukromniCount > 0 ? "var(--warning)" : "var(--text-primary)" },
          { label: "Aktívne filtre", value: aktivneFiltre, color: aktivneFiltre > 0 ? "var(--success)" : "var(--text-muted)" },
        ].map((s, i) => (
          <div key={i} style={{ ...S.card, padding: "16px 18px" }}>
            <div style={{ fontSize: "28px", fontWeight: 700, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", fontWeight: 500 }}>{s.label}</div>
          </div>
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

          <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px" }}>
            {filtered.length === total ? `${total} inzerátov` : `${filtered.length} z ${total}`}
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
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"; }}
                >
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
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{timeAgo(i.first_seen_at)}</span>
                      {i.predajca_typ === "sukromny" && (
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--warning)", background: "var(--warning-light)", padding: "2px 8px", borderRadius: "6px" }}>
                          👤 Súkromný
                        </span>
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
                    placeholder="Bratislava - Petržalka..."
                  />
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
                      {f.notify_email && <span style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 500 }}>📧 Email</span>}
                      {f.notify_telegram && <span style={{ fontSize: "12px", color: "var(--purple)", fontWeight: 500 }}>✈️ Telegram</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
                      style={{
                        width: "30px", height: "30px", borderRadius: "6px",
                        border: "none", background: "transparent", color: "var(--text-muted)",
                        cursor: "pointer", fontSize: "14px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--danger-light)"; (e.currentTarget as HTMLElement).style.color = "var(--danger)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
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
        @keyframes spin { to { transform: rotate(360deg); } }
        select:focus, input:focus { border-color: var(--accent) !important; box-shadow: 0 0 0 3px var(--accent-light) !important; }
      `}</style>
    </div>
  );
}
