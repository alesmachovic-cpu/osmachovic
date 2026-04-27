"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { getMaklerUuid } from "@/lib/maklerMap";

/* ── Typy podľa skutočnej DB schémy ── */
interface DBNehnutelnost {
  id: string;
  nazov: string;
  lokalita: string;
  ulica: string;
  // Staré polia (legacy portfolio záznamy)
  typ_transakcie: string;
  typ_nehnutelnosti: string;
  stav_inzeratu: string;
  status_kolizie: string | null;
  kolizia_poznamka: string | null;
  balkon: boolean;
  garaz: boolean;
  vytah: boolean;
  url: string;
  // Nové polia (InzeratForm záznamy)
  typ: string | null;
  kategoria: string | null;
  text_popis: string | null;
  updated_at: string;
  fotky_urls: string[] | null;
  fotky_thumbs: string[] | null;
  // Spoločné
  cena: number | null;
  plocha: number | null;
  izby: number | null;
  poschodie: number | null;
  stav: string | null;
  makler_id: string | null;
  makler_email: string | null;
  klient_id: string | null;
  status: "koncept" | "aktivny" | "predany" | "archivovany" | null;
  created_at: string;
}

type SortKey = "created_at" | "nazov" | "cena";
type ViewMode = "cards" | "list";

const TYP_LABELS: Record<string, string> = {
  "byt": "Byt", "dom": "Dom", "pozemok": "Pozemok",
  "garsonka": "Garsónka", "1-izbovy": "1i byt", "2-izbovy": "2i byt",
  "3-izbovy": "3i byt", "4-izbovy": "4i byt", "rodinny-dom": "Rodinný dom",
  "chata": "Chata", "komercny": "Komerčný",
};

const STAV_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  "aktívny": { bg: "#E5E7EB", text: "#374151", label: "Aktívny" },
  "aktivna": { bg: "#E5E7EB", text: "#374151", label: "Aktívna" },
  "pripravujeme": { bg: "#F3F4F6", text: "#374151", label: "Pripravujeme" },
  "pozastaveny": { bg: "#F3F4F6", text: "#6B7280", label: "Pozastavený" },
  "predany": { bg: "#F9FAFB", text: "#6B7280", label: "Predaný" },
  "archiv": { bg: "#F9FAFB", text: "#9CA3AF", label: "Archív" },
};

function formatCena(cena: number | null): string {
  if (!cena) return "Cena na vyžiadanie";
  return cena.toLocaleString("sk") + " €";
}

function typLabel(typ: string): string {
  return TYP_LABELS[typ] || typ || "—";
}

export default function Portfolio() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.id === "ales";
  const [myMaklerUuid, setMyMaklerUuid] = useState<string | null>(null);
  // "mine" = moje inzeráty, "all" = všetky, inak meno makléra
  // Default "all" aby užívateľ po otvorení portfolia videl všetky záznamy
  // (vrátane legacy bez makler_id). Môže si potom prefiltrovať.
  const [filterMakler, setFilterMakler] = useState<string>("all");
  const [makleriList, setMakleriList] = useState<{ meno: string; email: string; id: string }[]>([]);
  const [items, setItems] = useState<DBNehnutelnost[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [view, setView] = useState<ViewMode>("cards");
  const [search, setSearch] = useState("");
  const [filterTyp, setFilterTyp] = useState("");
  const [filterStatus, setFilterStatus] = useState("aktivny");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Record<string, { stav: string; eurM2: number; benchmark: number; odchylka: number; komentar: string }>>({});
  // AI analýzy z /api/analyzy (najnovšia quick per nehnutelnost) — prepojenie s /analyzy page
  const [aiAnalyzy, setAiAnalyzy] = useState<Record<string, { id: string; odhadovana_cena_eur: number | null; odporucany_cas_topovania_dni: number | null; analyza_text: string | null; created_at: string }>>({});
  const [deepDive, setDeepDive] = useState<DBNehnutelnost | null>(null);
  const [deepResult, setDeepResult] = useState<Record<string, unknown> | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [singleAnalyzing, setSingleAnalyzing] = useState<Record<string, boolean>>({});
  const [statusMenuFor, setStatusMenuFor] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user?.id) getMaklerUuid(user.id).then(uuid => setMyMaklerUuid(uuid ?? null));
  }, [user?.id]);

  useEffect(() => {
    supabase.from("makleri").select("id, meno, email").then(({ data }) => {
      if (data) setMakleriList(data as { meno: string; email: string; id: string }[]);
    });
  }, []);

  useEffect(() => { loadItems(); }, [sort, sortDir]);

  async function loadItems() {
    setLoading(true);
    const { data } = await supabase.from("nehnutelnosti").select("*").order(sort, { ascending: sortDir === "asc" });
    setItems((data as DBNehnutelnost[]) ?? []);
    setLoading(false);
    loadAiAnalyzy(); // background fetch — neblokuje render
  }

  // Load najnovšie quick AI analýzy (z /api/analyzy weekly cron) per nehnutelnost
  async function loadAiAnalyzy() {
    const { data } = await supabase
      .from("analyzy_nehnutelnosti")
      .select("id, nehnutelnost_id, typ, odhadovana_cena_eur, odporucany_cas_topovania_dni, analyza_text, created_at")
      .eq("typ", "quick_weekly")
      .order("created_at", { ascending: false })
      .limit(500);
    const map: typeof aiAnalyzy = {};
    for (const a of (data || []) as Array<{ id: string; nehnutelnost_id: string; odhadovana_cena_eur: number | null; odporucany_cas_topovania_dni: number | null; analyza_text: string | null; created_at: string }>) {
      const nid = a.nehnutelnost_id;
      if (nid && !map[nid]) {
        map[nid] = {
          id: a.id,
          odhadovana_cena_eur: a.odhadovana_cena_eur,
          odporucany_cas_topovania_dni: a.odporucany_cas_topovania_dni,
          analyza_text: a.analyza_text,
          created_at: a.created_at,
        };
      }
    }
    setAiAnalyzy(map);
  }

  function toggleSort(key: SortKey) {
    if (sort === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSort(key); setSortDir("desc"); }
  }

  async function runBatchAnalysis() {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "batch", items }),
      });
      const data = await res.json();
      if (data.results) {
        const map: typeof analysis = {};
        data.results.forEach((r: { id?: string; idx?: number; stav: string; eurM2: number; benchmark: number; odchylka: number; komentar: string }) => {
          const id = r.id || items[r.idx ?? -1]?.id;
          if (id) map[id] = r;
        });
        setAnalysis(map);
      }
    } catch { /* silent */ }
    setAnalyzing(false);
  }

  async function runSingleAnalysis(item: DBNehnutelnost) {
    setSingleAnalyzing(prev => ({ ...prev, [item.id]: true }));
    try {
      // Použijeme nový /api/analyzy endpoint (mode=quick) — uloží sa aj do DB
      // a Analýza trhu page zobrazí ten istý výsledok.
      const res = await fetch("/api/analyzy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "quick", nehnutelnost_id: item.id }),
      });
      const data = await res.json();
      if (res.ok && data.result) {
        // Refresh AI analyzy state
        await loadAiAnalyzy();
      }
    } catch { /* silent */ }
    setSingleAnalyzing(prev => ({ ...prev, [item.id]: false }));
  }

  async function changeStatus(itemId: string, newStatus: "aktivny" | "koncept" | "predany" | "archivovany") {
    setStatusUpdating(prev => ({ ...prev, [itemId]: true }));
    setStatusMenuFor(null);
    try {
      const res = await fetch("/api/inzerat/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editId: itemId, payload: { status: newStatus } }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert("⚠️ Zmena statusu zlyhala: " + (out.error || `HTTP ${res.status}`));
        return;
      }
      // Update locally without full reload
      setItems(prev => prev.map(it => it.id === itemId ? { ...it, status: newStatus } : it));
    } catch (e) {
      alert("⚠️ Chyba: " + (e as Error).message);
    } finally {
      setStatusUpdating(prev => ({ ...prev, [itemId]: false }));
    }
  }

  // Štatistiky pre stav-boxy
  const stats = {
    aktivne: items.filter(x => (x.status || "aktivny") === "aktivny").length,
    koncepty: items.filter(x => x.status === "koncept").length,
    predane: items.filter(x => x.status === "predany").length,
    archiv: items.filter(x => x.status === "archivovany").length,
    celkovo: items.length,
  };

  async function runDeepDive(item: DBNehnutelnost) {
    setDeepDive(item);
    setDeepLoading(true);
    setDeepResult(null);
    try {
      // Detailná AI analýza cez nový endpoint — výsledok sa zachová aj v
      // analyzy_nehnutelnosti tabuľke (zobrazí sa aj v /analyzy detail tabe)
      const res = await fetch("/api/analyzy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "detailed", nehnutelnost_id: item.id }),
      });
      const data = await res.json();
      if (res.ok && data.result) {
        setDeepResult(data.result);
      } else {
        setDeepResult({ error: data.error || "Chyba pri analýze" });
      }
    } catch (e) { setDeepResult({ error: String(e).slice(0, 200) }); }
    setDeepLoading(false);
  }

  const filtered = items.filter(n => {
    if (search) {
      const q = search.toLowerCase();
      const hay = `${n.nazov} ${n.lokalita} ${n.ulica} ${n.typ_nehnutelnosti || ""} ${n.typ || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filterTyp && n.typ_transakcie !== filterTyp && n.kategoria !== filterTyp) return false;
    if (filterStatus && (n.status || "aktivny") !== filterStatus) return false;
    // Makler filter
    if (filterMakler === "all") {
      // ukáž všetky — žiadny filter
    } else if (filterMakler === "mine") {
      const meno = user?.name?.toLowerCase() || "";
      const email = user?.email?.toLowerCase() || "";
      const nMakler = (n as unknown as { makler?: string }).makler?.toLowerCase() || "";
      const nMaklerEmail = (n.makler_email || "").toLowerCase();
      const nMaklerId = n.makler_id || "";
      const matchesId = myMaklerUuid && nMaklerId === myMaklerUuid;
      const matchesUidFallback = user?.id && nMaklerId === user.id;
      const matchesEmail = email && nMaklerEmail === email;
      const matchesMeno = meno && nMakler === meno;
      if (!matchesId && !matchesUidFallback && !matchesEmail && !matchesMeno) {
        // Neseadí mi — skry len ak patrí konkrétnemu inému maklérovi z DB.
        const otherMakler = makleriList.find(m =>
          m.id === nMaklerId ||
          (m.email && nMaklerEmail && m.email.toLowerCase() === nMaklerEmail) ||
          (m.meno && nMakler && m.meno.toLowerCase() === nMakler)
        );
        const belongsToSomeoneElse = !!otherMakler && (
          (myMaklerUuid ? otherMakler.id !== myMaklerUuid : true) &&
          (email ? (otherMakler.email || "").toLowerCase() !== email : true) &&
          (meno ? otherMakler.meno.toLowerCase() !== meno : true)
        );
        if (belongsToSomeoneElse) return false;
        // Legacy / orphan → necháme vidieť.
      }
    } else {
      // Konkrétny makler (meno alebo UUID)
      const sel = makleriList.find(m => m.meno === filterMakler);
      if (sel) {
        if (n.makler_id !== sel.id && (n.makler_email || "").toLowerCase() !== (sel.email || "").toLowerCase() && (n as unknown as { makler?: string }).makler !== sel.meno) return false;
      }
    }
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>Portfólio</h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" }}>
            {filtered.length} {filtered.length === 1 ? "nehnuteľnosť" : filtered.length < 5 ? "nehnuteľnosti" : "nehnuteľností"} v ponuke
          </p>
        </div>
      </div>

      {/* Stats boxy — klik = filter */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "20px" }} className="cards-grid">
        {([
          { key: "", label: "Celkovo", value: stats.celkovo, color: "#374151" },
          { key: "aktivny", label: "Aktívne", value: stats.aktivne, color: "#16A34A" },
          { key: "koncept", label: "Koncepty", value: stats.koncepty, color: "#D97706" },
          { key: "predany", label: "Predané", value: stats.predane, color: "#6B7280" },
          { key: "archivovany", label: "Archív", value: stats.archiv, color: "#9CA3AF" },
        ] as const).map(s => {
          const active = filterStatus === s.key;
          return (
            <button key={s.label} onClick={() => setFilterStatus(s.key)} style={{
              padding: "16px 18px", borderRadius: "14px",
              background: "var(--bg-surface)",
              border: active ? `2px solid ${s.color}` : "1px solid var(--border)",
              textAlign: "left", cursor: "pointer", transition: "all 0.15s",
            }}>
              <div style={{ fontSize: "26px", fontWeight: "700", color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", marginTop: "6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "200px", maxWidth: "360px" }}>
          <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", color: "var(--text-muted)", pointerEvents: "none" }}>&#x1F50D;</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Hľadať podľa názvu, lokality..."
            style={{ width: "100%", padding: "9px 14px 9px 36px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px", color: "var(--text-primary)", outline: "none" }} />
        </div>
        <select value={filterTyp} onChange={e => setFilterTyp(e.target.value)} style={{
          padding: "9px 30px 9px 12px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px", color: "var(--text-primary)", cursor: "pointer", outline: "none",
          appearance: "none" as const, backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
        }}>
          <option value="">Všetky typy</option>
          <option value="predaj">Na predaj</option>
          <option value="prenajom">Na prenájom</option>
        </select>

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{
          padding: "9px 30px 9px 12px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px", color: "var(--text-primary)", cursor: "pointer", outline: "none",
          appearance: "none" as const, backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
        }}>
          <option value="">Všetky stavy</option>
          <option value="aktivny">Aktívny</option>
          <option value="koncept">Koncept</option>
          <option value="predany">Predaný</option>
          <option value="archivovany">Archív</option>
        </select>

        <select value={filterMakler} onChange={e => setFilterMakler(e.target.value)} style={{
          padding: "9px 30px 9px 12px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px", color: "var(--text-primary)", cursor: "pointer", outline: "none",
          appearance: "none" as const, backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
        }}>
          <option value="mine">Moje inzeráty</option>
          <option value="all">Všetky inzeráty</option>
          {makleriList.length > 0 && <option disabled>──────────</option>}
          {makleriList.map(m => (
            <option key={m.id} value={m.meno}>{m.meno}</option>
          ))}
        </select>

        <button onClick={runBatchAnalysis} disabled={analyzing || items.length === 0} style={{
          padding: "8px 16px", fontSize: "12px", fontWeight: "600", borderRadius: "8px", cursor: analyzing ? "wait" : "pointer",
          background: Object.keys(analysis).length > 0 ? "#E5E7EB" : "#374151",
          color: Object.keys(analysis).length > 0 ? "#374151" : "#fff",
          border: "none", display: "flex", alignItems: "center", gap: "6px", opacity: analyzing ? 0.6 : 1, whiteSpace: "nowrap",
        }}>
          {analyzing ? "⏳ Analyzujem..." : Object.keys(analysis).length > 0 ? "✅ Preanalyzované" : "🤖 Analyzovať"}
        </button>

        <div style={{ display: "flex", gap: "4px", marginLeft: "auto" }}>
          {([["created_at", "Najnovšie"], ["cena", "Cena"], ["nazov", "Názov"]] as [SortKey, string][]).map(([key, label]) => (
            <button key={key} onClick={() => toggleSort(key)} style={{
              padding: "7px 14px", fontSize: "12px", fontWeight: sort === key ? "600" : "400",
              color: sort === key ? "#fff" : "var(--text-secondary)",
              background: sort === key ? "#374151" : "var(--bg-surface)",
              border: sort === key ? "none" : "1px solid var(--border)", borderRadius: "7px", cursor: "pointer",
            }}>{label} {sort === key && (sortDir === "desc" ? "↓" : "↑")}</button>
          ))}
          <div style={{ display: "flex", marginLeft: "8px", border: "1px solid var(--border)", borderRadius: "7px", overflow: "hidden" }}>
            <button onClick={() => setView("cards")} style={{ padding: "7px 10px", fontSize: "14px", border: "none", cursor: "pointer", background: view === "cards" ? "#374151" : "var(--bg-surface)", color: view === "cards" ? "#fff" : "var(--text-muted)" }}>▦</button>
            <button onClick={() => setView("list")} style={{ padding: "7px 10px", fontSize: "14px", border: "none", cursor: "pointer", background: view === "list" ? "#374151" : "var(--bg-surface)", color: view === "list" ? "#fff" : "var(--text-muted)" }}>☰</button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: "14px" }}>Načítavam...</div>}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 20px", background: "var(--bg-surface)", borderRadius: "16px", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏠</div>
          <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>
            {search ? "Žiadne výsledky" : "Portfólio je prázdne"}
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
            {search ? "Skús zmeniť vyhľadávanie" : "Zatiaľ žiadne inzeráty v portfóliu"}
          </div>
        </div>
      )}

      {/* Cards view */}
      {!loading && filtered.length > 0 && view === "cards" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {filtered.map(n => {
            const statusNew = n.status === "koncept" ? { bg: "#FEF3C7", text: "#D97706", label: "Koncept" } : n.status === "predany" ? { bg: "#F0FDF4", text: "#16A34A", label: "Predaný" } : n.status === "archivovany" ? { bg: "#F9FAFB", text: "#9CA3AF", label: "Archív" } : null;
            const stavInfo = statusNew || STAV_COLORS[n.stav_inzeratu] || STAV_COLORS[n.status_kolizie || ""] || { bg: "#E5E7EB", text: "#374151", label: "Aktívny" };
            const thumbUrl = n.fotky_thumbs?.[0] || n.fotky_urls?.[0] || null;
            // Určí či ide o predaj alebo prenájom — podľa `kategoria` (nové pole "na-predaj"/"na-najom")
            // alebo legacy `typ_transakcie` ("predaj"/"prenajom").
            const rawKat = (n.kategoria || n.typ_transakcie || "").toLowerCase();
            const isPredaj = rawKat.includes("predaj");
            return (
              <div key={n.id} onClick={() => router.push(`/inzerat?id=${n.id}`)}
                style={{ background: "var(--bg-surface)", borderRadius: "14px", border: "1px solid var(--border)", overflow: "hidden", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
                {/* Photo */}
                <div style={{ height: "180px", background: thumbUrl ? `url(${thumbUrl}) center/cover no-repeat` : "linear-gradient(135deg, #F3F4F6, #E5E7EB)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  {!thumbUrl && <span style={{ fontSize: "40px", opacity: 0.3 }}>🏠</span>}
                  {/* Typ transakcie badge */}
                  {rawKat && (
                    <span style={{ position: "absolute", top: "10px", left: "10px", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", background: "#374151", color: "#fff" }}>
                      {isPredaj ? "NA PREDAJ" : "PRENÁJOM"}
                    </span>
                  )}
                  {/* Stav badge — klik otvorí menu na zmenu statusu */}
                  <div style={{ position: "absolute", top: "10px", right: "10px" }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setStatusMenuFor(statusMenuFor === n.id ? null : n.id)} style={{
                      padding: "4px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: "600",
                      background: stavInfo.bg, color: stavInfo.text, border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "4px",
                      opacity: statusUpdating[n.id] ? 0.5 : 1,
                    }}>
                      {statusUpdating[n.id] ? "⏳" : stavInfo.label}
                      <span style={{ fontSize: "8px", opacity: 0.6 }}>▾</span>
                    </button>
                    {statusMenuFor === n.id && (
                      <div style={{
                        position: "absolute", top: "28px", right: 0, zIndex: 100,
                        background: "var(--bg-surface)", border: "1px solid var(--border)",
                        borderRadius: "10px", minWidth: "150px",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                        overflow: "hidden",
                      }}>
                        {([
                          ["aktivny", "✓ Aktívny", "#16A34A"],
                          ["koncept", "📝 Koncept", "#D97706"],
                          ["predany", "🏁 Predaný", "#6B7280"],
                          ["archivovany", "📦 Archív", "#9CA3AF"],
                        ] as const).map(([key, label, color]) => (
                          <button key={key} onClick={() => changeStatus(n.id, key)} style={{
                            display: "block", width: "100%", padding: "9px 14px", textAlign: "left",
                            fontSize: "12px", fontWeight: "500", color: n.status === key ? color : "var(--text-primary)",
                            background: n.status === key ? "rgba(0,0,0,0.04)" : "transparent",
                            border: "none", cursor: "pointer",
                          }}
                            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-elevated)")}
                            onMouseLeave={e => (e.currentTarget.style.background = n.status === key ? "rgba(0,0,0,0.04)" : "transparent")}>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: "16px" }}>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>
                    {formatCena(n.cena)}
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "4px", lineHeight: 1.3 }}>
                    {n.nazov || `${typLabel(n.typ || n.typ_nehnutelnosti || "")}${n.lokalita ? ` — ${n.lokalita}` : ""}`}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
                    {[n.lokalita, n.ulica].filter(Boolean).join(" · ") || "—"}
                  </div>

                  {/* Parametre */}
                  <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "14px" }}>
                    {n.typ_nehnutelnosti && (
                      <span style={{ padding: "3px 8px", background: "#F3F4F6", borderRadius: "5px", fontWeight: "500" }}>
                        {typLabel(n.typ_nehnutelnosti)}
                      </span>
                    )}
                    {n.plocha && <span>{n.plocha} m²</span>}
                    {n.izby && <span>{n.izby}i</span>}
                    {n.poschodie != null && <span>{n.poschodie}. p.</span>}
                  </div>

                  {/* Vlastnosti */}
                  <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                    {n.balkon && <span style={{ fontSize: "11px", padding: "2px 8px", background: "#F3F4F6", color: "#374151", borderRadius: "4px" }}>Balkón</span>}
                    {n.garaz && <span style={{ fontSize: "11px", padding: "2px 8px", background: "#F3F4F6", color: "#374151", borderRadius: "4px" }}>Garáž</span>}
                    {n.vytah && <span style={{ fontSize: "11px", padding: "2px 8px", background: "#F3F4F6", color: "#374151", borderRadius: "4px" }}>Výťah</span>}
                    {n.stav && <span style={{ fontSize: "11px", padding: "2px 8px", background: "#F3F4F6", color: "#374151", borderRadius: "4px" }}>{n.stav}</span>}
                  </div>

                  {/* AI Analýza section — používa /api/analyzy + tabuľku analyzy_nehnutelnosti
                      (rovnaký dataset ako /analyzy page → konzistentné dáta naprieč CRM) */}
                  {aiAnalyzy[n.id] ? (() => {
                    const a = aiAnalyzy[n.id];
                    const aktualnaCena = Number(n.cena || 0);
                    const odhad = a.odhadovana_cena_eur || 0;
                    const odchylka = aktualnaCena > 0 && odhad > 0 ? Math.round(((aktualnaCena - odhad) / odhad) * 100) : 0;
                    const stav = odchylka > 5 ? "nadhodnotene" : odchylka < -5 ? "podhodnotene" : "trhova";
                    const cfg = stav === "podhodnotene" ? { icon: "✅", bg: "#ECFDF5", text: "#059669", label: "Podhodnotené" }
                      : stav === "nadhodnotene" ? { icon: "⚠️", bg: "#FEF3C7", text: "#92400E", label: "Nadhodnotené" }
                      : { icon: "📊", bg: "#EFF6FF", text: "#1D4ED8", label: "Trhová cena" };
                    return (
                      <div style={{ padding: "10px 12px", background: cfg.bg, borderRadius: "10px", marginBottom: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <span style={{ fontSize: "12px", fontWeight: "600", color: cfg.text }}>{cfg.icon} {cfg.label}</span>
                          {odchylka !== 0 && (
                            <span style={{ fontSize: "11px", color: cfg.text, fontWeight: "500" }}>{odchylka > 0 ? "+" : ""}{odchylka}%</span>
                          )}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: cfg.text, opacity: 0.85 }}>
                          <span>AI odhad: {formatCena(odhad)}</span>
                          {a.odporucany_cas_topovania_dni && <span>Topovať za {a.odporucany_cas_topovania_dni} dní</span>}
                        </div>
                        {a.analyza_text && <div style={{ fontSize: "11px", color: cfg.text, marginTop: "4px", opacity: 0.75, lineHeight: 1.4 }}>💡 {a.analyza_text}</div>}
                        <button onClick={(e) => { e.stopPropagation(); runDeepDive(n); }} style={{
                          marginTop: "8px", width: "100%", padding: "6px", fontSize: "11px", fontWeight: "600",
                          background: "rgba(255,255,255,0.6)", border: "none", borderRadius: "6px", cursor: "pointer", color: cfg.text,
                        }}>🔍 Hĺbková analýza</button>
                      </div>
                    );
                  })() : (
                    <button onClick={(e) => { e.stopPropagation(); runSingleAnalysis(n); }} disabled={singleAnalyzing[n.id]} style={{
                      width: "100%", padding: "8px", fontSize: "12px", fontWeight: "600", marginBottom: "12px",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)", borderRadius: "8px", cursor: singleAnalyzing[n.id] ? "wait" : "pointer",
                      color: singleAnalyzing[n.id] ? "var(--text-muted)" : "var(--text-primary)",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                    }}>
                      {singleAnalyzing[n.id] ? "⏳ Analyzujem..." : "🤖 Analyzovať nehnuteľnosť"}
                    </button>
                  )}

                  {/* Footer — maklér inzerátu (z n.makler / makler_id lookup) */}
                  {(() => {
                    const nFoo = n as unknown as { makler?: string };
                    const fromList = n.makler_id ? makleriList.find(m => m.id === n.makler_id) : null;
                    const maklerMeno = fromList?.meno || nFoo.makler || "—";
                    const maklerInit = maklerMeno.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "—";
                    return (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#374151", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: "700", color: "#fff" }}>{maklerInit}</div>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{maklerMeno}</span>
                        </div>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{new Date(n.created_at).toLocaleDateString("sk")}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {!loading && filtered.length > 0 && view === "list" && (
        <div style={{ background: "var(--bg-surface)", borderRadius: "14px", border: "1px solid var(--border)", overflow: "hidden" }}>
          {/* Header */}
          <div className="portfolio-list-header" style={{ display: "grid", gridTemplateColumns: `2fr 1fr 80px 80px 140px ${Object.keys(analysis).length > 0 ? "120px " : ""}90px`, padding: "12px 20px", fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            <span>Nehnuteľnosť</span>
            <span>Lokácia</span>
            <span>Výmera</span>
            <span>Izby</span>
            <span style={{ textAlign: "right" }}>Cena</span>
            {Object.keys(analysis).length > 0 && <span style={{ textAlign: "center" }}>Analýza</span>}
            <span style={{ textAlign: "right" }}>Stav</span>
          </div>
          {filtered.map((n, i) => {
            const statusNew = n.status === "koncept" ? { bg: "#FEF3C7", text: "#D97706", label: "Koncept" } : n.status === "predany" ? { bg: "#F0FDF4", text: "#16A34A", label: "Predaný" } : n.status === "archivovany" ? { bg: "#F9FAFB", text: "#9CA3AF", label: "Archív" } : null;
            const stavInfo = statusNew || STAV_COLORS[n.stav_inzeratu] || STAV_COLORS[n.status_kolizie || ""] || { bg: "#E5E7EB", text: "#374151", label: "Aktívny" };
            return (
              <div key={n.id} className="portfolio-list-row" onClick={() => analysis[n.id] ? runDeepDive(n) : undefined} style={{ display: "grid", gridTemplateColumns: `2fr 1fr 80px 80px 140px ${Object.keys(analysis).length > 0 ? "120px " : ""}90px`, padding: "14px 20px", alignItems: "center", borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", fontSize: "13px", cursor: "pointer", transition: "background 0.1s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-elevated)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "linear-gradient(135deg, #F3F4F6, #E5E7EB)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>🏠</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: "500", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {n.nazov || `${typLabel(n.typ || n.typ_nehnutelnosti || "")}${n.lokalita ? ` — ${n.lokalita}` : ""}`}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {typLabel(n.typ || n.typ_nehnutelnosti || "")} · {(n.kategoria || n.typ_transakcie) === "predaj" ? "Predaj" : "Prenájom"} · {new Date(n.created_at).toLocaleDateString("sk")}
                    </div>
                  </div>
                </div>
                <div className="list-hide" style={{ color: "var(--text-secondary)", fontSize: "12px" }}>{n.lokalita || "—"}</div>
                <div className="list-hide" style={{ color: "var(--text-secondary)" }}>{n.plocha ? `${n.plocha} m²` : "—"}</div>
                <div className="list-hide" style={{ color: "var(--text-secondary)" }}>{n.izby ? `${n.izby}i` : "—"}</div>
                <div style={{ textAlign: "right", fontWeight: "600", color: "var(--text-primary)" }}>{formatCena(n.cena)}</div>
                {Object.keys(analysis).length > 0 && (
                  <div className="list-hide" style={{ textAlign: "center" }}>
                    {analysis[n.id] ? (() => {
                      const a = analysis[n.id];
                      const icon = a.stav === "podhodnotene" ? "✅" : a.stav === "nadhodnotene" ? "⚠️" : "📊";
                      const bg = "#F3F4F6";
                      const color = "#374151";
                      return <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "5px", fontWeight: "500", background: bg, color }}>{icon} {a.odchylka > 0 ? "+" : ""}{a.odchylka}%</span>;
                    })() : <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>—</span>}
                  </div>
                )}
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "5px", fontWeight: "500", background: stavInfo.bg, color: stavInfo.text }}>{stavInfo.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deep Dive Modal */}
      {deepDive && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => { setDeepDive(null); setDeepResult(null); }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: "relative", width: "95%", maxWidth: "640px", maxHeight: "85vh", overflowY: "auto",
            background: "var(--bg-surface)", borderRadius: "20px", border: "1px solid var(--border)",
            boxShadow: "0 25px 60px rgba(0,0,0,0.2)", padding: "28px",
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                  🔍 Hĺbková analýza
                </h2>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" }}>
                  {deepDive.nazov || `${typLabel(deepDive.typ_nehnutelnosti)} — ${deepDive.lokalita}`}
                </p>
              </div>
              <button onClick={() => { setDeepDive(null); setDeepResult(null); }} style={{
                width: "32px", height: "32px", borderRadius: "50%", border: "none",
                background: "var(--bg-elevated)", cursor: "pointer", fontSize: "16px", color: "var(--text-muted)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>×</button>
            </div>

            {deepLoading && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: "14px" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px", animation: "pulse 1.5s infinite" }}>🤖</div>
                AI analyzuje nehnuteľnosť...
              </div>
            )}

            {deepResult && (() => {
              type DeepFmt = {
                error?: string;
                odhadovana_cena_eur?: number;
                cena_min?: number;
                cena_max?: number;
                analyza_text?: string;
                zdovodnenie?: string;
                postup?: string[];
                konkurencia?: Array<{ popis?: string; cena_eur?: number; lokalita?: string; plocha_m2?: number }>;
              };
              const d = deepResult as DeepFmt;
              if (d.error) {
                return <div style={{ padding: "20px", textAlign: "center", color: "#DC2626" }}>⚠️ {d.error}</div>;
              }
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Odhadovaná cena — hero */}
                  <div style={{ padding: "20px", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "14px", textAlign: "center" }}>
                    <div style={{ fontSize: "11px", color: "#065F46", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em" }}>Odhadovaná trhová cena</div>
                    <div style={{ fontSize: "32px", fontWeight: 700, color: "#10B981", marginTop: "4px", lineHeight: 1 }}>
                      {d.odhadovana_cena_eur ? formatCena(d.odhadovana_cena_eur) : "—"}
                    </div>
                    {(d.cena_min || d.cena_max) && (
                      <div style={{ fontSize: "12px", color: "#065F46", marginTop: "6px" }}>
                        Rozsah: {formatCena(d.cena_min || 0)} – {formatCena(d.cena_max || 0)}
                      </div>
                    )}
                  </div>

                  {/* Analýza trhu */}
                  {d.analyza_text && (
                    <div style={{ padding: "16px", background: "var(--bg-elevated)", borderRadius: "14px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>Analýza trhu</div>
                      <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{d.analyza_text}</div>
                    </div>
                  )}

                  {/* Zdôvodnenie ceny */}
                  {d.zdovodnenie && (
                    <div style={{ padding: "16px", background: "var(--bg-elevated)", borderRadius: "14px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>Prečo táto cena</div>
                      <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{d.zdovodnenie}</div>
                    </div>
                  )}

                  {/* Postup predaja */}
                  {d.postup && d.postup.length > 0 && (
                    <div style={{ padding: "16px", background: "var(--bg-elevated)", borderRadius: "14px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>Odporučený postup predaja</div>
                      <ol style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.7, paddingLeft: "20px", margin: 0 }}>
                        {d.postup.map((s, i) => <li key={i}>{s}</li>)}
                      </ol>
                    </div>
                  )}

                  {/* Konkurencia */}
                  {d.konkurencia && d.konkurencia.length > 0 && (
                    <div style={{ padding: "16px", background: "var(--bg-elevated)", borderRadius: "14px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>Konkurencia na trhu</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {d.konkurencia.map((k, i) => (
                          <div key={i} style={{ padding: "10px 12px", background: "var(--bg-surface)", borderRadius: "8px", fontSize: "12px" }}>
                            <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>{k.popis}</div>
                            <div style={{ color: "var(--text-muted)", marginTop: "2px" }}>
                              {k.lokalita && <>📍 {k.lokalita}</>}
                              {k.plocha_m2 && <> · {k.plocha_m2} m²</>}
                              {k.cena_eur && <> · 💰 {formatCena(k.cena_eur)}</>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
