"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import SlaPoruseni from "@/components/SlaPoruseni";

// ─── Shared typy ─────────────────────────────────────────────────────────────

type Period = "month" | "quarter" | "year";

interface TeamStat {
  id: string;
  name: string;
  role: string;
  klienti: number;
  nabery: number;
  nehnutelnosti: number;
  konverzia: string;
  napomenutia: number;
  sla_critical: number;
}

interface MonthlyData {
  month: string;
  label: string;
  klienti: number;
  nabery: number;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  klientCount: number;
  naberCount: number;
}

type ClenTimu = {
  id: string;
  osoba: string;
  rola: "fotograf" | "pravnik" | "technik";
  stav: "volny" | "pracuje" | "dovolenka";
  aktualnaZakazka?: string;
  kapacitaDenne: number;
  obsadene: number;
};

type Makler = { id: string; meno: string; percento: number };
type Faktura = {
  id: string;
  cislo_faktury: string;
  datum_vystavenia: string;
  suma_celkom: number;
  zaplatene: boolean;
  poznamka: string | null;
  odberatel_snapshot: { nazov?: string } | null;
};

// ─── Konštanty ───────────────────────────────────────────────────────────────

const STAV_CONFIG: Record<ClenTimu["stav"], { label: string; color: string; bg: string }> = {
  volny:     { label: "Voľný",     color: "#34C759", bg: "#34C75918" },
  pracuje:   { label: "Pracuje",   color: "#FF9500", bg: "#FF950018" },
  dovolenka: { label: "Dovolenka", color: "#8E8E93", bg: "#8E8E9318" },
};
const ROLA_LABELS: Record<ClenTimu["rola"], string> = { fotograf: "Fotograf", pravnik: "Právnik", technik: "Technik" };
const DEFAULT_TEAM: ClenTimu[] = [
  { id: "1", osoba: "Marek",         rola: "fotograf", stav: "volny", kapacitaDenne: 4, obsadene: 0 },
  { id: "2", osoba: "JUDr. Horváth", rola: "pravnik",  stav: "volny", kapacitaDenne: 3, obsadene: 0 },
  { id: "3", osoba: "Peter",         rola: "technik",  stav: "volny", kapacitaDenne: 5, obsadene: 0 },
];
const LS_KEY = "os_machovic_vytazenost";
const DNI = ["Po", "Ut", "St", "Št", "Pi"];

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
  padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "10px",
  background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "14px", width: "100%",
  boxSizing: "border-box",
};
const labelSt: React.CSSProperties = {
  fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "5px",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function periodStart(p: Period): Date {
  const now = new Date();
  if (p === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (p === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return new Date(now.getFullYear(), q * 3, 1);
  }
  return new Date(now.getFullYear(), 0, 1);
}

function isDeal(stav: string | null) {
  return ["predany", "predaný", "archiv"].includes((stav ?? "").toLowerCase());
}

// ─── Root page ────────────────────────────────────────────────────────────────

export default function ManazerPage() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const isManagerOrAbove = role === "super_admin" || role === "majitel" || role === "manazer";
  const isMakler = role === "makler";

  // Makler sees only Štatistiky; manager+ sees all tabs
  type TabKey = "prehlad" | "statistiky" | "tim" | "vytazenost" | "provizie";
  const [tab, setTab] = useState<TabKey>(isManagerOrAbove ? "prehlad" : "statistiky");

  const tabs: { id: TabKey; label: string }[] = [
    ...(isManagerOrAbove ? [{ id: "prehlad" as TabKey, label: "📊 Prehľad" }] : []),
    { id: "statistiky" as TabKey, label: "📉 Štatistiky" },
    ...(isManagerOrAbove ? [
      { id: "tim" as TabKey, label: "👥 Tím" },
      { id: "vytazenost" as TabKey, label: "👷 Vyťaženosť" },
      { id: "provizie" as TabKey, label: "💼 Provízie" },
    ] : []),
  ];

  if (user && !isManagerOrAbove && !isMakler) {
    return (
      <div style={{ maxWidth: "480px", margin: "80px auto", textAlign: "center", padding: "0 24px" }}>
        <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>Nemáš prístup</div>
        <div style={{ fontSize: "14px", color: "var(--text-muted)" }}>Táto sekcia je dostupná len pre maklérov a manažérov.</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
          {isManagerOrAbove ? "Manažérsky pohľad" : "Moje štatistiky"}
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
          {user?.name} · {role}
        </p>
      </div>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--bg-elevated)", borderRadius: 12, padding: 4, width: "fit-content", flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.15s",
              background: tab === t.id ? "var(--bg-surface)" : "transparent",
              color: tab === t.id ? "var(--text-primary)" : "var(--text-muted)",
              boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === "prehlad"    && <TabPrehlad />}
      {tab === "statistiky" && <TabStatistiky isManagerOrAbove={isManagerOrAbove} userEmail={user?.email ?? ""} />}
      {tab === "tim"        && <TabTim />}
      {tab === "vytazenost" && <TabVytazenost />}
      {tab === "provizie"   && <TabProvizie />}
    </div>
  );
}

// ─── Tab: Prehľad (manažér) ──────────────────────────────────────────────────

function TabPrehlad() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ klienti: 0, nehnutelnosti: 0, nabery: 0, objednavky: 0 });
  const [team, setTeam] = useState<TeamStat[]>([]);
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [criticalCount, setCriticalCount] = useState(0);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const [
      klientiData, nehnutelnostiData, naberyData,
      objednavkyData, usersData, makleriData,
      historyData, slaRes,
    ] = await Promise.all([
      fetch("/api/klienti").then(r => r.json()),
      fetch("/api/nehnutelnosti").then(r => r.json()),
      fetch("/api/nabery").then(r => r.json()),
      fetch("/api/objednavky").then(r => r.json()),
      fetch("/api/users").then(r => r.json()),
      fetch("/api/makleri").then(r => r.json()),
      fetch(`/api/klienti-history?from=${ninetyDaysAgo}`).then(r => r.json()),
      fetch("/api/manazer/sla").then(r => r.json()).catch(() => ({ critical: [] })),
    ]);

    const kl = klientiData ?? [];
    const nh = nehnutelnostiData ?? [];
    const nb = naberyData ?? [];
    const ob = objednavkyData ?? [];
    const us = (usersData.users ?? []) as Array<{ id: string; name: string; email: string; role: string }>;
    const ms = (Array.isArray(makleriData) ? makleriData : []) as Array<{ id: string; email: string }>;
    const hs = (historyData ?? []) as Array<{ from_makler_id: string | null; action: string }>;
    setCriticalCount((slaRes.critical || []).length);

    setTotals({ klienti: kl.length, nehnutelnosti: nh.length, nabery: nb.length, objednavky: ob.length });

    const userToMaklerId: Record<string, string | null> = {};
    for (const u of us) {
      const m = ms.find(x => x.email === u.email);
      userToMaklerId[u.id] = m?.id || null;
    }

    const teamStats: TeamStat[] = us.map((u) => {
      const maklerUuid = userToMaklerId[u.id];
      const uk = maklerUuid ? kl.filter((k: { makler_id: string }) => k.makler_id === maklerUuid).length : 0;
      const un = maklerUuid ? nb.filter((n: { makler_id: string }) => n.makler_id === maklerUuid).length : 0;
      const unh = maklerUuid ? nh.filter((n: { makler: string }) => n.makler === maklerUuid).length : 0;
      const napomenutia = maklerUuid ? hs.filter(h => h.from_makler_id === maklerUuid && h.action === "napomenuty").length : 0;
      const slaCritical = maklerUuid ? hs.filter(h => h.from_makler_id === maklerUuid && h.action === "sla_critical").length : 0;
      return {
        id: u.id, name: u.name, role: u.role || "makler",
        klienti: uk, nabery: un, nehnutelnosti: unh,
        konverzia: uk > 0 ? `${Math.round((un / uk) * 100)}%` : "0%",
        napomenutia, sla_critical: slaCritical,
      };
    });
    teamStats.sort((a, b) => b.klienti - a.klienti);
    setTeam(teamStats);

    const months: MonthlyData[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        month: key,
        label: d.toLocaleDateString("sk", { month: "short" }),
        klienti: kl.filter((k: { created_at: string }) => k.created_at?.startsWith(key)).length,
        nabery: nb.filter((n: { created_at: string }) => n.created_at?.startsWith(key)).length,
      });
    }
    setMonthly(months);
    setLoading(false);
  }

  const konverznyPomer = totals.klienti > 0 ? Math.round((totals.nabery / totals.klienti) * 100) : 0;
  const maxMonthly = Math.max(...monthly.map(m => Math.max(m.klienti, m.nabery)), 1);

  if (loading) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: 14 }}>
      Načítavam štatistiky…
    </div>
  );

  return (
    <div>
      {criticalCount > 0 && (
        <div style={{
          marginBottom: 20, padding: "14px 16px",
          background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ fontSize: 13, color: "#991B1B" }}>
            <strong>{criticalCount}</strong> {criticalCount === 1 ? "klient prekročil" : "klientov prekročilo"} 72h SLA bez vytvoreného inzerátu — treba rozhodnúť.
          </div>
          <a href="#sla-poruseni" style={{ padding: "6px 14px", background: "#991B1B", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
            Otvoriť zoznam ↓
          </a>
        </div>
      )}

      <SlaPoruseni byUserId={user?.id || null} onUpdated={fetchData} />

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Celkom klientov",  value: totals.klienti,      sub: "v databáze" },
          { label: "Nehnuteľnosti",    value: totals.nehnutelnosti, sub: "aktívne" },
          { label: "Konverzný pomer",  value: `${konverznyPomer}%`, sub: "nábery / klienti" },
          { label: "Objednávky",       value: totals.objednavky,    sub: "od kupujúcich" },
        ].map(kpi => (
          <div key={kpi.label} style={{ padding: 20, background: "var(--bg-surface)", borderRadius: 14, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, fontWeight: 500 }}>{kpi.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#374151", marginBottom: 4 }}>{kpi.value}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Celkom náberov",         value: totals.nabery },
          { label: "Maklérov v tíme",         value: team.length },
          { label: "Priem. klientov/maklér",  value: team.length > 0 ? Math.round(totals.klienti / team.length) : 0 },
        ].map(s => (
          <div key={s.label} style={{ padding: 16, background: "var(--bg-surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, fontWeight: 500 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#374151" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Monthly chart */}
      <div style={{ padding: 24, background: "var(--bg-surface)", borderRadius: 14, border: "1px solid var(--border)", marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>Mesačný trend</h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 20px" }}>Noví klienti a nábery za posledných 6 mesiacov</p>
        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          {[{ color: "#374151", label: "Klienti" }, { color: "#9CA3AF", label: "Nábery" }].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-secondary)" }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 140 }}>
          {monthly.map(m => (
            <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}>
              <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 4, width: "100%" }}>
                {[{ val: m.klienti, color: "#374151" }, { val: m.nabery, color: "#9CA3AF" }].map((bar, bi) => (
                  <div key={bi} style={{ flex: 1, background: bar.color, borderRadius: "4px 4px 0 0", height: `${Math.max((bar.val / maxMonthly) * 100, 4)}%`, minHeight: 4, position: "relative" }}>
                    {bar.val > 0 && (
                      <div style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)", fontSize: 10, fontWeight: 600, color: "var(--text-secondary)" }}>
                        {bar.val}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, fontWeight: 500, textTransform: "capitalize" }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Team performance table */}
      {team.length > 0 && (
        <div style={{ background: "var(--bg-surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Výkonnosť tímu</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr", padding: "12px 20px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            <span>Maklér</span>
            <span style={{ textAlign: "center" }}>Klienti</span>
            <span style={{ textAlign: "center" }}>Nábery</span>
            <span style={{ textAlign: "center" }}>Nehnuteľnosti</span>
            <span style={{ textAlign: "center" }}>Konverzia</span>
            <span style={{ textAlign: "center" }} title="SLA porušenia za 90 dní">SLA 72h+</span>
            <span style={{ textAlign: "right" }} title="Napomenutia za 90 dní">Napomenutí</span>
          </div>
          {team.map((m, i) => (
            <div key={m.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr", padding: "14px 20px", alignItems: "center", borderBottom: i < team.length - 1 ? "1px solid var(--border)" : "none", fontSize: 13 }}>
              <div>
                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{m.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {m.role === "admin" ? "Administrátor" : m.role === "manager" ? "Manažér" : "Maklér"}
                </div>
              </div>
              <div style={{ textAlign: "center", fontWeight: 600, color: "var(--text-primary)" }}>{m.klienti}</div>
              <div style={{ textAlign: "center", fontWeight: 600, color: "var(--text-primary)" }}>{m.nabery}</div>
              <div style={{ textAlign: "center", fontWeight: 600, color: "var(--text-primary)" }}>{m.nehnutelnosti}</div>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: parseInt(m.konverzia) >= 50 ? "#059669" : parseInt(m.konverzia) >= 25 ? "#D97706" : "#374151" }}>{m.konverzia}</span>
              </div>
              <div style={{ textAlign: "center", fontWeight: 600, color: m.sla_critical > 0 ? "#DC2626" : "var(--text-muted)" }}>{m.sla_critical}</div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: m.napomenutia > 0 ? "#DC2626" : "var(--text-muted)" }}>{m.napomenutia}{m.napomenutia > 0 ? "×" : ""}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Štatistiky ─────────────────────────────────────────────────────────

function TabStatistiky({ isManagerOrAbove, userEmail }: { isManagerOrAbove: boolean; userEmail: string }) {
  const [period, setPeriod] = useState<Period>("month");
  const [loading, setLoading] = useState(true);
  const [myMaklerUuid, setMyMaklerUuid] = useState<string | null>(null);

  interface NehRow { id: string; stav_inzeratu: string | null; cena: number | null; created_at: string; updated_at: string | null; makler_id: string | null; makler: string | null; provizia_hodnota: number | null; }
  interface KlientRow { id: string; created_at: string; makler_id: string | null; }
  interface NaberRow { id: string; created_at: string; makler_id: string | null; }
  interface MaklerRow { id: string; meno: string; email: string; }

  const [nehnutelnosti, setNehnutelnosti] = useState<NehRow[]>([]);
  const [klienti, setKlienti] = useState<KlientRow[]>([]);
  const [nabery, setNabery] = useState<NaberRow[]>([]);
  const [makleriList, setMakleriList] = useState<MaklerRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [nehData, klData, nbData, mkData] = await Promise.all([
        fetch("/api/nehnutelnosti").then(r => r.json()),
        fetch("/api/klienti").then(r => r.json()),
        fetch("/api/nabery").then(r => r.json()),
        fetch("/api/makleri").then(r => r.json()),
      ]);
      const mks: MaklerRow[] = Array.isArray(mkData) ? mkData : [];
      setNehnutelnosti(nehData ?? []);
      setKlienti(klData ?? []);
      setNabery(nbData ?? []);
      setMakleriList(mks);

      if (!isManagerOrAbove && userEmail) {
        const me = mks.find((m: MaklerRow) => m.email === userEmail);
        setMyMaklerUuid(me?.id ?? null);
      }
      setLoading(false);
    }
    load();
  }, [isManagerOrAbove, userEmail]);

  const from = periodStart(period);

  const filteredNeh = isManagerOrAbove
    ? nehnutelnosti
    : nehnutelnosti.filter(n => n.makler_id === myMaklerUuid || n.makler === myMaklerUuid);

  const filteredKlienti = isManagerOrAbove
    ? klienti
    : klienti.filter(k => k.makler_id === myMaklerUuid);

  const filteredNabery = isManagerOrAbove
    ? nabery
    : nabery.filter(n => n.makler_id === myMaklerUuid);

  const aktiveNeh = filteredNeh.filter(n => !isDeal(n.stav_inzeratu));
  const deals = filteredNeh.filter(n => isDeal(n.stav_inzeratu));
  const dealsInPeriod = deals.filter(n => new Date(n.updated_at ?? n.created_at) >= from);
  const klientiInPeriod = filteredKlienti.filter(k => new Date(k.created_at) >= from);
  const naberyInPeriod = filteredNabery.filter(n => new Date(n.created_at) >= from);
  const obrat = dealsInPeriod.reduce((s, n) => s + (n.cena ?? 0), 0);
  const konverzia = klientiInPeriod.length > 0 ? Math.round((naberyInPeriod.length / klientiInPeriod.length) * 100) : 0;

  // Top 5 makléri (manager+ only)
  interface MaklerStat { id: string; meno: string; deals: number; obrat: number; }
  const topMakleri: MaklerStat[] = isManagerOrAbove
    ? makleriList.map(m => ({
        id: m.id,
        meno: m.meno,
        deals: dealsInPeriod.filter(n => n.makler_id === m.id || n.makler === m.id).length,
        obrat: dealsInPeriod.filter(n => n.makler_id === m.id || n.makler === m.id).reduce((s, n) => s + (n.cena ?? 0), 0),
      }))
        .filter(m => m.deals > 0)
        .sort((a, b) => b.deals - a.deals)
        .slice(0, 5)
    : [];

  const periodLabel = period === "month" ? "tento mesiac" : period === "quarter" ? "tento kvartál" : "tento rok";

  if (loading) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: 14 }}>
      Načítavam štatistiky…
    </div>
  );

  return (
    <div>
      {/* Period switcher */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 4, background: "var(--bg-elevated)", borderRadius: 8, padding: 3 }}>
          {([["month", "Mesiac"], ["quarter", "Kvartál"], ["year", "Rok"]] as [Period, string][]).map(([p, l]) => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: "5px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: period === p ? 700 : 500,
              background: period === p ? "var(--bg-surface)" : "transparent",
              color: period === p ? "var(--text-primary)" : "var(--text-muted)", cursor: "pointer",
              boxShadow: period === p ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Aktívne nehnuteľnosti", value: aktiveNeh.length, sub: "celkovo" },
          { label: "Klienti spolu",         value: filteredKlienti.length, sub: "v databáze" },
          { label: `Nábery (${periodLabel})`, value: naberyInPeriod.length, sub: "za obdobie" },
          { label: `Uzavreté obchody`,      value: dealsInPeriod.length, sub: periodLabel },
          { label: `Obrat`,                 value: obrat > 0 ? `${obrat.toLocaleString("sk")} €` : "0 €", sub: periodLabel },
          { label: "Konverzný pomer",        value: `${konverzia}%`, sub: "nábery / noví klienti" },
        ].map(kpi => (
          <div key={kpi.label} style={{ padding: "18px 16px", background: "var(--bg-surface)", borderRadius: 14, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, fontWeight: 500 }}>{kpi.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{kpi.value}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Top 5 makléri (manager+ only) */}
      {isManagerOrAbove && topMakleri.length > 0 && (
        <div style={{ background: "var(--bg-surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Top makléri — {periodLabel}
            </h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "10px 20px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            <span>Maklér</span>
            <span style={{ textAlign: "center" }}>Uzavreté obchody</span>
            <span style={{ textAlign: "right" }}>Obrat</span>
          </div>
          {topMakleri.map((m, i) => (
            <div key={m.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "13px 20px", alignItems: "center", borderBottom: i < topMakleri.length - 1 ? "1px solid var(--border)" : "none", fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{m.meno}</div>
              <div style={{ textAlign: "center", fontWeight: 700, color: "#374151" }}>{m.deals}</div>
              <div style={{ textAlign: "right", fontWeight: 600, color: "var(--text-secondary)" }}>
                {m.obrat > 0 ? `${m.obrat.toLocaleString("sk")} €` : "—"}
              </div>
            </div>
          ))}
        </div>
      )}

      {isManagerOrAbove && topMakleri.length === 0 && (
        <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)", fontSize: 13 }}>
          Žiadne uzavreté obchody za {periodLabel}.
        </div>
      )}
    </div>
  );
}

// ─── Tab: Tím ─────────────────────────────────────────────────────────────────

function TabTim() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName]   = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole]   = useState("makler");
  const [saving, setSaving]       = useState(false);
  const [inviteSending, setInviteSending] = useState<string | null>(null);
  const [inviteSentFor, setInviteSentFor] = useState<string | null>(null);

  useEffect(() => { fetchTeam(); }, []);

  async function fetchTeam() {
    setLoading(true);
    const [usersData, klienti, nabery] = await Promise.all([
      fetch("/api/users").then(r => r.json()),
      fetch("/api/klienti").then(r => r.json()),
      fetch("/api/nabery").then(r => r.json()),
    ]);
    const users = usersData.users ?? [];
    setMembers(users.map((u: { id: string; name: string; email: string; role: string }) => ({
      id: u.id, name: u.name, email: u.email, role: u.role || "makler",
      klientCount: (klienti ?? []).filter((k: { makler_id: string }) => k.makler_id === u.id).length,
      naberCount:  (nabery  ?? []).filter((n: { makler_id: string }) => n.makler_id === u.id).length,
    })));
    setLoading(false);
  }

  async function handleCreate() {
    if (!formName.trim() || !formEmail.trim()) return;
    setSaving(true);
    const id = formName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const parts = formName.trim().split(" ");
    const initials = `${(parts[0] || "")[0] || ""}${(parts[1] || "")[0] || ""}`.toUpperCase();
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: formName.trim(), initials, email: formEmail.trim(), role: formRole, password: "" }),
    });
    if (res.ok) {
      setFormName(""); setFormEmail(""); setFormRole("makler"); setShowForm(false);
      fetchTeam();
    }
    setSaving(false);
  }

  async function sendInvite(memberId: string) {
    if (inviteSending) return;
    setInviteSending(memberId);
    const res = await fetch("/api/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: memberId }),
    });
    setInviteSending(null);
    if (res.ok) {
      setInviteSentFor(memberId);
      setTimeout(() => setInviteSentFor(null), 5000);
    } else {
      alert("Pozvánku sa nepodarilo odoslať.");
    }
  }

  const roleLabel = (r: string) => {
    if (r === "super_admin") return "Admin";
    if (r === "majitel")    return "Majiteľ";
    if (r === "manazer")    return "Manažér";
    return "Maklér";
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Členov tímu",   value: members.length },
          { label: "Klienti spolu", value: members.reduce((s, m) => s + m.klientCount, 0) },
          { label: "Nábery spolu",  value: members.reduce((s, m) => s + m.naberCount, 0) },
        ].map(s => (
          <div key={s.label} style={{ padding: 16, background: "var(--bg-surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: "9px 18px", background: "#374151", color: "#fff", borderRadius: 10, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>
          + Nový účet
        </button>
      </div>

      {showForm && (
        <div style={{ padding: 20, background: "var(--bg-surface)", borderRadius: 14, border: "1px solid var(--border)", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>Nový účet</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelSt}>Meno a priezvisko</label>
              <input style={inputSt} value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ján Novák" />
            </div>
            <div>
              <label style={labelSt}>Email</label>
              <input type="email" style={inputSt} value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="jan@vianema.eu" />
            </div>
            <div>
              <label style={labelSt}>Rola</label>
              <select style={inputSt} value={formRole} onChange={e => setFormRole(e.target.value)}>
                <option value="makler">Maklér</option>
                <option value="manazer">Manažér</option>
                <option value="majitel">Majiteľ</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowForm(false)} style={{ padding: "8px 16px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
              Zrušiť
            </button>
            <button onClick={handleCreate} disabled={saving || !formName.trim() || !formEmail.trim()} style={{ padding: "8px 16px", background: "#374151", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", opacity: saving || !formName.trim() || !formEmail.trim() ? 0.5 : 1 }}>
              {saving ? "Ukladám…" : "Vytvoriť"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: 14 }}>Načítavam…</div>
      ) : (
        <div style={{ background: "var(--bg-surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 120px 110px", padding: "10px 20px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            <span>Člen tímu</span>
            <span style={{ textAlign: "center" }}>Klienti</span>
            <span style={{ textAlign: "center" }}>Nábery</span>
            <span style={{ textAlign: "center" }}>Rola</span>
            <span style={{ textAlign: "right" }}>Pozvánka</span>
          </div>
          {members.map((m, i) => {
            const initials = m.name.split(" ").map(w => w[0] || "").join("").toUpperCase().slice(0, 2);
            const isMe = user?.id === m.id;
            const sent = inviteSentFor === m.id;
            return (
              <div key={m.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 120px 110px", padding: "13px 20px", alignItems: "center", borderBottom: i < members.length - 1 ? "1px solid var(--border)" : "none", fontSize: 13, background: isMe ? "rgba(55,65,81,0.03)" : "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: isMe ? "#374151" : "#6B7280", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                    {initials}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      {m.name} {isMe && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>(vy)</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.email}</div>
                  </div>
                </div>
                <div style={{ textAlign: "center", fontWeight: 600 }}>{m.klientCount}</div>
                <div style={{ textAlign: "center", fontWeight: 600 }}>{m.naberCount}</div>
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 600, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                    {roleLabel(m.role)}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <button
                    onClick={() => sendInvite(m.id)}
                    disabled={!!inviteSending || sent}
                    style={{
                      padding: "5px 12px", fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: inviteSending || sent ? "default" : "pointer",
                      background: sent ? "#D1FAE5" : "var(--bg-elevated)",
                      border: `1px solid ${sent ? "#6EE7B7" : "var(--border)"}`,
                      color: sent ? "#065F46" : "var(--text-secondary)",
                      opacity: inviteSending === m.id ? 0.6 : 1,
                    }}
                  >
                    {inviteSending === m.id ? "…" : sent ? "✓ Odoslané" : "✉ Pozvánka"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Vyťaženosť ─────────────────────────────────────────────────────────

function TabVytazenost() {
  const [tim, setTim] = useState<ClenTimu[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ stav: "volny" as ClenTimu["stav"], aktualnaZakazka: "", obsadene: 0 });

  useEffect(() => {
    const data = localStorage.getItem(LS_KEY);
    setTim(data ? JSON.parse(data) : DEFAULT_TEAM);
    if (!data) localStorage.setItem(LS_KEY, JSON.stringify(DEFAULT_TEAM));
  }, []);

  const save = (items: ClenTimu[]) => { setTim(items); localStorage.setItem(LS_KEY, JSON.stringify(items)); };
  const startEdit = (c: ClenTimu) => { setEditId(c.id); setEditForm({ stav: c.stav, aktualnaZakazka: c.aktualnaZakazka || "", obsadene: c.obsadene }); };
  const saveEdit = (id: string) => {
    save(tim.map(c => c.id === id ? { ...c, stav: editForm.stav, aktualnaZakazka: editForm.aktualnaZakazka.trim() || undefined, obsadene: editForm.obsadene } : c));
    setEditId(null);
  };

  const celkovaKap = tim.reduce((s, c) => s + c.kapacitaDenne, 0);
  const celkoveObs = tim.reduce((s, c) => s + c.obsadene, 0);
  const pct        = celkovaKap > 0 ? Math.round((celkoveObs / celkovaKap) * 100) : 0;
  const today      = new Date();
  const dayOfWeek  = today.getDay();
  const monday     = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Celková kapacita", value: String(celkovaKap), sub: "zákaziek/deň", color: "var(--text-primary)" },
          { label: "Obsadené",         value: String(celkoveObs), sub: "aktuálne",     color: "#FF9500" },
          { label: "Vyťaženosť",       value: `${pct}%`,          sub: "využitie",     color: pct > 80 ? "#FF3B30" : pct > 50 ? "#FF9500" : "#34C759" },
        ].map(s => (
          <div key={s.label} style={{ padding: 18, background: "var(--bg-surface)", borderRadius: 14, border: "1px solid var(--border)", textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {tim.map(c => {
          const p = c.kapacitaDenne > 0 ? Math.round((c.obsadene / c.kapacitaDenne) * 100) : 0;
          const barColor = p > 80 ? "#FF3B30" : p > 50 ? "#FF9500" : "#34C759";
          const sc = STAV_CONFIG[c.stav];
          const isEditing = editId === c.id;
          return (
            <div key={c.id} style={{ background: "var(--bg-surface)", borderRadius: 14, padding: 18, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: `${sc.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, color: sc.color }}>
                    {c.osoba[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{c.osoba}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{ROLA_LABELS[c.rola]}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: sc.color, background: sc.bg, padding: "4px 10px", borderRadius: 8 }}>{sc.label}</span>
                  <button onClick={() => isEditing ? saveEdit(c.id) : startEdit(c)} style={{ background: isEditing ? "#34C759" : "var(--bg-elevated)", color: isEditing ? "#fff" : "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {isEditing ? "Uložiť" : "Upraviť"}
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12, color: "var(--text-secondary)" }}>
                  <span>Kapacita: {c.obsadene}/{c.kapacitaDenne}</span>
                  <span style={{ fontWeight: 600, color: barColor }}>{p}%</span>
                </div>
                <div style={{ height: 7, background: "var(--bg-elevated)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(p, 100)}%`, background: barColor, borderRadius: 4, transition: "width 0.3s" }} />
                </div>
              </div>
              {c.aktualnaZakazka && !isEditing && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, fontStyle: "italic" }}>Aktuálne: {c.aktualnaZakazka}</div>}
              {isEditing && (
                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <label style={labelSt}>Stav</label>
                    <select value={editForm.stav} onChange={e => setEditForm({ ...editForm, stav: e.target.value as ClenTimu["stav"] })} style={{ ...inputSt, width: "auto" }}>
                      <option value="volny">Voľný</option>
                      <option value="pracuje">Pracuje</option>
                      <option value="dovolenka">Dovolenka</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelSt}>Obsadené</label>
                    <input type="number" min={0} max={c.kapacitaDenne} value={editForm.obsadene} onChange={e => setEditForm({ ...editForm, obsadene: Number(e.target.value) })} style={{ ...inputSt, width: 70 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <label style={labelSt}>Aktuálna zákazka</label>
                    <input value={editForm.aktualnaZakazka} onChange={e => setEditForm({ ...editForm, aktualnaZakazka: e.target.value })} placeholder="Názov zákazky…" style={inputSt} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ background: "var(--bg-surface)", borderRadius: 14, padding: 20, border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Týždenný prehľad</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>Týždeň od {monday.toLocaleDateString("sk-SK")}</div>
        <div style={{ display: "grid", gridTemplateColumns: `130px repeat(${DNI.length}, 1fr)`, gap: 2 }}>
          <div />
          {DNI.map(d => <div key={d} style={{ padding: 8, textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{d}</div>)}
          {tim.map(c => {
            const sc = STAV_CONFIG[c.stav];
            return (
              <div key={c.id} style={{ display: "contents" }}>
                <div style={{ padding: "8px 10px", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", display: "flex", alignItems: "center" }}>{c.osoba}</div>
                {DNI.map((d, i) => {
                  const isDovolenka = c.stav === "dovolenka";
                  const cellBg = isDovolenka ? "var(--bg-elevated)" : c.obsadene >= c.kapacitaDenne ? "#FF3B3015" : c.obsadene > 0 ? "#FF950015" : "#34C75915";
                  const isToday = (dayOfWeek + 6) % 7 === i;
                  return (
                    <div key={d} style={{ padding: 8, textAlign: "center", background: cellBg, borderRadius: 7, fontSize: 12, color: "var(--text-secondary)", border: isToday ? "2px solid #007AFF" : "2px solid transparent" }}>
                      {isDovolenka ? "—" : `${c.obsadene}/${c.kapacitaDenne}`}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Provízie ────────────────────────────────────────────────────────────

function StatCard({ title, value, sub, color }: { title: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || "var(--text-primary)", marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function TabProvizie() {
  const { user } = useAuth();
  const [maklery, setMaklery]   = useState<Makler[]>([]);
  const [faktury, setFaktury]   = useState<Faktura[]>([]);
  const [novyMeno, setNovyMeno] = useState("");
  const [novyPct, setNovyPct]   = useState("");
  const [selectedMakler, setSelectedMakler] = useState("");
  const [mesiac, setMesiac]     = useState(new Date().toISOString().slice(0, 7));

  async function loadMaklery() { const r = await fetch("/api/maklerske-provizie"); setMaklery(await r.json()); }
  async function loadFaktury(uid: string) { const r = await fetch(`/api/faktury?user_id=${uid}`); const d = await r.json(); setFaktury(Array.isArray(d) ? d : []); }

  useEffect(() => { loadMaklery(); if (user?.id) loadFaktury(user.id); }, [user?.id]);

  async function addMakler() {
    if (!novyMeno.trim()) return;
    await fetch("/api/maklerske-provizie", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meno: novyMeno, percento: parseFloat(novyPct.replace(",", ".")) || 0 }) });
    setNovyMeno(""); setNovyPct(""); loadMaklery();
  }
  async function updatePct(m: Makler, value: string) {
    await fetch("/api/maklerske-provizie", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: m.id, percento: parseFloat(value.replace(",", ".")) || 0 }) });
    loadMaklery();
  }
  async function removeMakler(id: string) {
    if (!confirm("Zmazať makléra?")) return;
    await fetch(`/api/maklerske-provizie?id=${id}`, { method: "DELETE" }); loadMaklery();
  }

  const selectedM    = maklery.find(m => m.id === selectedMakler);
  const monthFaktury = faktury.filter(f => f.datum_vystavenia.startsWith(mesiac));
  const maklerFakt   = selectedM ? monthFaktury.filter(f => (f.poznamka || "").toLowerCase().includes(selectedM.meno.toLowerCase())) : [];
  const sumaFakt     = maklerFakt.reduce((s, f) => s + Number(f.suma_celkom), 0);
  const sumaZapl     = maklerFakt.filter(f => f.zaplatene).reduce((s, f) => s + Number(f.suma_celkom), 0);
  const provizia     = selectedM ? sumaZapl * (selectedM.percento / 100) : 0;

  return (
    <div>
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.04em" }}>Makléri a percentá</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {maklery.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "4px 0" }}>Žiadni makléri.</div>}
          {maklery.map(m => (
            <div key={m.id} style={{ display: "grid", gridTemplateColumns: "1fr 140px auto", gap: 8, alignItems: "center" }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{m.meno}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input style={inputSt} defaultValue={m.percento} onBlur={e => updatePct(m, e.target.value)} />
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>%</span>
              </div>
              <button onClick={() => removeMakler(m.id)} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", color: "var(--danger)", fontSize: 12 }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 140px auto", gap: 8, alignItems: "center", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          <input style={inputSt} placeholder="Meno makléra" value={novyMeno} onChange={e => setNovyMeno(e.target.value)} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input style={inputSt} placeholder="0" value={novyPct} onChange={e => setNovyPct(e.target.value)} />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>%</span>
          </div>
          <button onClick={addMakler} style={{ background: "#374151", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>+ Pridať</button>
        </div>
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.04em" }}>Výpočet provízie</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 16 }}>
          <select style={inputSt} value={selectedMakler} onChange={e => setSelectedMakler(e.target.value)}>
            <option value="">— vyber makléra —</option>
            {maklery.map(m => <option key={m.id} value={m.id}>{m.meno} ({m.percento} %)</option>)}
          </select>
          <input type="month" style={inputSt} value={mesiac} onChange={e => setMesiac(e.target.value)} />
        </div>
        {selectedM && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
              <StatCard title="Faktúry celkom" value={`${sumaFakt.toFixed(2)} €`} sub={`${maklerFakt.length} ks`} />
              <StatCard title="Zaplatené" value={`${sumaZapl.toFixed(2)} €`} color="var(--success)" />
              <StatCard title={`Provízia (${selectedM.percento} %)`} value={`${provizia.toFixed(2)} €`} color="#374151" />
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr 100px", gap: 12, padding: "10px 14px", background: "var(--bg-elevated)", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                <div>Číslo</div><div>Odberateľ</div><div>Dátum</div><div style={{ textAlign: "right" }}>Suma</div><div>Stav</div>
              </div>
              {maklerFakt.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Žiadne faktúry za tento mesiac.</div>
              ) : maklerFakt.map(f => (
                <div key={f.id} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr 100px", gap: 12, padding: "12px 14px", borderTop: "1px solid var(--border)", fontSize: 13, alignItems: "center" }}>
                  <div style={{ fontWeight: 600 }}>{f.cislo_faktury}</div>
                  <div>{f.odberatel_snapshot?.nazov || "—"}</div>
                  <div style={{ color: "var(--text-muted)" }}>{f.datum_vystavenia}</div>
                  <div style={{ textAlign: "right", fontWeight: 600 }}>{Number(f.suma_celkom).toFixed(2)} €</div>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, background: f.zaplatene ? "var(--success-light)" : "var(--warning-light)", color: f.zaplatene ? "var(--success)" : "var(--warning)", padding: "3px 8px", borderRadius: 999 }}>
                      {f.zaplatene ? "✓" : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
