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
  const [filterStatus, setFilterStatus] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Record<string, { stav: string; eurM2: number; benchmark: number; odchylka: number; komentar: string }>>({});
  const [deepDive, setDeepDive] = useState<DBNehnutelnost | null>(null);
  const [deepResult, setDeepResult] = useState<Record<string, unknown> | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [singleAnalyzing, setSingleAnalyzing] = useState<Record<string, boolean>>({});

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
      const res = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "batch", items: [item] }),
      });
      const data = await res.json();
      if (data.results?.[0]) {
        const r = data.results[0];
        setAnalysis(prev => ({ ...prev, [item.id]: r }));
      }
    } catch { /* silent */ }
    setSingleAnalyzing(prev => ({ ...prev, [item.id]: false }));
  }

  async function runDeepDive(item: DBNehnutelnost) {
    setDeepDive(item);
    setDeepLoading(true);
    setDeepResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deep", item }),
      });
      const data = await res.json();
      setDeepResult(data);
    } catch { /* silent */ }
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
        <button onClick={() => router.push("/inzerat")} style={{
          padding: "10px 20px", background: "#374151", color: "#fff", borderRadius: "10px",
          fontSize: "13px", fontWeight: "600", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: "6px",
        }}>+ Nový inzerát</button>
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
            {search ? "Skús zmeniť vyhľadávanie" : "Vytvor prvý inzerát a začni budovať ponuku"}
          </div>
          {!search && <button onClick={() => router.push("/inzerat")} style={{ display: "inline-flex", padding: "10px 24px", background: "#374151", color: "#fff", borderRadius: "10px", fontSize: "13px", fontWeight: "600", border: "none", cursor: "pointer" }}>+ Nový inzerát</button>}
        </div>
      )}

      {/* Cards view */}
      {!loading && filtered.length > 0 && view === "cards" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {filtered.map(n => {
            const statusNew = n.status === "koncept" ? { bg: "#FEF3C7", text: "#D97706", label: "Koncept" } : n.status === "predany" ? { bg: "#F0FDF4", text: "#16A34A", label: "Predaný" } : n.status === "archivovany" ? { bg: "#F9FAFB", text: "#9CA3AF", label: "Archív" } : null;
            const stavInfo = statusNew || STAV_COLORS[n.stav_inzeratu] || STAV_COLORS[n.status_kolizie || ""] || { bg: "#E5E7EB", text: "#374151", label: "Aktívny" };
            return (
              <div key={n.id} style={{ background: "var(--bg-surface)", borderRadius: "14px", border: "1px solid var(--border)", overflow: "hidden" }}>
                {/* Photo placeholder */}
                <div style={{ height: "180px", background: "linear-gradient(135deg, #F3F4F6, #E5E7EB)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  <span style={{ fontSize: "40px", opacity: 0.3 }}>🏠</span>
                  {/* Typ transakcie badge */}
                  {n.typ_transakcie && (
                    <span style={{ position: "absolute", top: "10px", left: "10px", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", background: "#374151", color: "#fff" }}>
                      {n.typ_transakcie === "predaj" ? "NA PREDAJ" : "PRENÁJOM"}
                    </span>
                  )}
                  {/* Stav badge */}
                  <span style={{ position: "absolute", top: "10px", right: "10px", padding: "4px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: "600", background: stavInfo.bg, color: stavInfo.text }}>
                    {stavInfo.label}
                  </span>
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

                  {/* Analysis section */}
                  {analysis[n.id] ? (() => {
                    const a = analysis[n.id];
                    const cfg = a.stav === "podhodnotene" ? { icon: "✅", bg: "#F3F4F6", text: "#374151", label: "Podhodnotené" }
                      : a.stav === "nadhodnotene" ? { icon: "⚠️", bg: "#F3F4F6", text: "#374151", label: "Nadhodnotené" }
                      : { icon: "📊", bg: "#F3F4F6", text: "#374151", label: "Trhová cena" };
                    return (
                      <div style={{ padding: "10px 12px", background: cfg.bg, borderRadius: "10px", marginBottom: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <span style={{ fontSize: "12px", fontWeight: "600", color: cfg.text }}>{cfg.icon} {cfg.label}</span>
                          <span style={{ fontSize: "11px", color: cfg.text, fontWeight: "500" }}>{a.odchylka > 0 ? "+" : ""}{a.odchylka}%</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: cfg.text, opacity: 0.8 }}>
                          <span>{a.eurM2} €/m²</span>
                          <span>benchmark {a.benchmark} €/m²</span>
                        </div>
                        {a.komentar && <div style={{ fontSize: "11px", color: cfg.text, marginTop: "4px", opacity: 0.7 }}>{a.komentar}</div>}
                        <button onClick={(e) => { e.stopPropagation(); runDeepDive(n); }} style={{
                          marginTop: "8px", width: "100%", padding: "6px", fontSize: "11px", fontWeight: "600",
                          background: "rgba(255,255,255,0.6)", border: "none", borderRadius: "6px", cursor: "pointer", color: cfg.text,
                        }}>🔍 Hĺbková analýza</button>
                      </div>
                    );
                  })() : (
                    <button onClick={(e) => { e.stopPropagation(); runSingleAnalysis(n); }} disabled={singleAnalyzing[n.id]} style={{
                      width: "100%", padding: "8px", fontSize: "12px", fontWeight: "600", marginBottom: "12px",
                      background: singleAnalyzing[n.id] ? "var(--bg-elevated)" : "var(--bg-elevated)",
                      border: "1px solid var(--border)", borderRadius: "8px", cursor: singleAnalyzing[n.id] ? "wait" : "pointer",
                      color: singleAnalyzing[n.id] ? "var(--text-muted)" : "var(--text-primary)",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                    }}>
                      {singleAnalyzing[n.id] ? "⏳ Analyzujem..." : "🤖 Analyzovať nehnuteľnosť"}
                    </button>
                  )}

                  {/* Footer */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#374151", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: "700", color: "#fff" }}>AM</div>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Aleš Machovič</span>
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{new Date(n.created_at).toLocaleDateString("sk")}</span>
                  </div>
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
              const z = (deepResult as { zaklad?: { cena?: number; plocha?: number; eurM2?: number; benchmark?: number; odchylka?: number; stav?: string } }).zaklad;
              const h = (deepResult as { hypoteka?: { istina?: number; mesacnaSplatka?: number; celkovaNakup?: number; hotovost?: number; potrebnyPrijem?: number; ltv?: string; urok?: string; roky?: number } }).hypoteka;
              const ai = (deepResult as { ai?: { verdikt?: string; silne_stranky?: string[]; slabe_stranky?: string[]; odporucanie?: string; cielova_skupina?: string; cas_predaja?: string } }).ai;

              const verdiktCfg = z?.stav === "podhodnotene" ? { icon: "✅", bg: "#F3F4F6", text: "#374151", label: "Podhodnotené" }
                : z?.stav === "nadhodnotene" ? { icon: "⚠️", bg: "#F3F4F6", text: "#374151", label: "Nadhodnotené" }
                : { icon: "📊", bg: "#F3F4F6", text: "#374151", label: "Trhová cena" };

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Verdikt */}
                  <div style={{ padding: "16px", background: verdiktCfg.bg, borderRadius: "14px", textAlign: "center" }}>
                    <div style={{ fontSize: "28px", marginBottom: "4px" }}>{verdiktCfg.icon}</div>
                    <div style={{ fontSize: "16px", fontWeight: "700", color: verdiktCfg.text }}>{verdiktCfg.label}</div>
                    <div style={{ fontSize: "13px", color: verdiktCfg.text, marginTop: "4px" }}>
                      {z?.eurM2?.toLocaleString("sk")} €/m² vs benchmark {z?.benchmark?.toLocaleString("sk")} €/m² ({z?.odchylka != null && z.odchylka > 0 ? "+" : ""}{z?.odchylka}%)
                    </div>
                  </div>

                  {/* Základné čísla */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                    {[
                      { label: "Cena", value: z?.cena ? z.cena.toLocaleString("sk") + " €" : "—" },
                      { label: "Plocha", value: z?.plocha ? z.plocha + " m²" : "—" },
                      { label: "€/m²", value: z?.eurM2 ? z.eurM2.toLocaleString("sk") + " €" : "—" },
                    ].map(item => (
                      <div key={item.label} style={{ padding: "12px", background: "var(--bg-elevated)", borderRadius: "10px", textAlign: "center" }}>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>{item.label}</div>
                        <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)" }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Hypotéka */}
                  {h && (
                    <div style={{ padding: "16px", background: "var(--bg-elevated)", borderRadius: "14px" }}>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "12px" }}>🏦 Hypotekárny model</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "13px" }}>
                        <div>
                          <span style={{ color: "var(--text-muted)" }}>Mesačná splátka</span>
                          <div style={{ fontWeight: "700", fontSize: "18px", color: "var(--text-primary)", marginTop: "2px" }}>{h.mesacnaSplatka?.toLocaleString("sk")} €</div>
                        </div>
                        <div>
                          <span style={{ color: "var(--text-muted)" }}>Potrebný príjem</span>
                          <div style={{ fontWeight: "700", fontSize: "18px", color: "var(--text-primary)", marginTop: "2px" }}>{h.potrebnyPrijem?.toLocaleString("sk")} €</div>
                        </div>
                        <div style={{ color: "var(--text-secondary)" }}>
                          <span style={{ color: "var(--text-muted)" }}>Úver (istina)</span>
                          <div style={{ fontWeight: "600", marginTop: "2px" }}>{h.istina?.toLocaleString("sk")} €</div>
                        </div>
                        <div style={{ color: "var(--text-secondary)" }}>
                          <span style={{ color: "var(--text-muted)" }}>Hotovosť potrebná</span>
                          <div style={{ fontWeight: "600", marginTop: "2px" }}>{h.hotovost?.toLocaleString("sk")} €</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "12px", marginTop: "12px", fontSize: "11px", color: "var(--text-muted)" }}>
                        <span>LTV: {h.ltv}</span>
                        <span>Úrok: {h.urok}</span>
                        <span>{h.roky} rokov</span>
                        <span>Celkom: {h.celkovaNakup?.toLocaleString("sk")} €</span>
                      </div>
                    </div>
                  )}

                  {/* AI Komentár */}
                  {ai && (
                    <div style={{ padding: "16px", background: "var(--bg-elevated)", borderRadius: "14px" }}>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "12px" }}>🤖 AI Hodnotenie</div>
                      {ai.silne_stranky && ai.silne_stranky.length > 0 && (
                        <div style={{ marginBottom: "10px" }}>
                          <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "4px" }}>Silné stránky</div>
                          {ai.silne_stranky.map((s, i) => <div key={i} style={{ fontSize: "12px", color: "var(--text-secondary)", paddingLeft: "12px" }}>+ {s}</div>)}
                        </div>
                      )}
                      {ai.slabe_stranky && ai.slabe_stranky.length > 0 && (
                        <div style={{ marginBottom: "10px" }}>
                          <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "4px" }}>Slabé stránky</div>
                          {ai.slabe_stranky.map((s, i) => <div key={i} style={{ fontSize: "12px", color: "var(--text-secondary)", paddingLeft: "12px" }}>− {s}</div>)}
                        </div>
                      )}
                      {ai.odporucanie && (
                        <div style={{ fontSize: "12px", color: "var(--text-primary)", padding: "10px", background: "var(--bg-surface)", borderRadius: "8px", marginBottom: "8px" }}>
                          <strong>Odporúčanie:</strong> {ai.odporucanie}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: "16px", fontSize: "11px", color: "var(--text-muted)", marginTop: "8px" }}>
                        {ai.cielova_skupina && <span>👤 {ai.cielova_skupina}</span>}
                        {ai.cas_predaja && <span>⏱ Predaj: {ai.cas_predaja}</span>}
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
