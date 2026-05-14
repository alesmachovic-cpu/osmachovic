"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { User } from "@/components/AuthProvider";
import SlaPoruseni from "@/components/SlaPoruseni";
import { isSuperAdmin } from "@/lib/auth/requireUser";
import PasswordInput from "@/components/PasswordInput";
import { ALL_FEATURES, loadFeatureToggles, saveFeatureToggles } from "@/lib/featureToggles";
import type { FeatureId, FeatureToggles } from "@/lib/featureToggles";

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

function inPeriod(date: string | null, from: Date) {
  return date ? new Date(date) >= from : false;
}

function fmtEur(n: number) { return n.toLocaleString("sk", { maximumFractionDigits: 0 }) + " €"; }
function avatarInitials(name: string) { return name.split(" ").map(p => p[0] || "").join("").toUpperCase().slice(0, 2); }

const S = {
  card: { background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px 20px" } as React.CSSProperties,
};

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color ?? "var(--text-primary)", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function PeriodSwitch({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div style={{ display: "flex", gap: 4, background: "var(--bg-elevated)", borderRadius: 8, padding: 3 }}>
      {([["month", "Mesiac"], ["quarter", "Kvartál"], ["year", "Rok"]] as [Period, string][]).map(([p, l]) => (
        <button key={p} onClick={() => onChange(p as Period)} style={{
          padding: "5px 12px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: value === p ? 700 : 500,
          background: value === p ? "var(--bg-surface)" : "transparent",
          color: value === p ? "var(--text-primary)" : "var(--text-muted)", cursor: "pointer",
          boxShadow: value === p ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
        }}>{l}</button>
      ))}
    </div>
  );
}

// Typy pre Pobočka tab
interface UserRow { id: string; name: string; email: string; role: string; pobocka_id: string | null; }
interface PobockaRow { id: string; nazov: string; mesto: string; }
interface NehPobRow { id: string; stav_inzeratu: string | null; cena: number | null; created_at: string; updated_at: string | null; makler_id: string | null; provizia_hodnota: number | null; }
interface KlientPobRow { id: string; created_at: string; makler_id: string | null; }

// ─── Root page ────────────────────────────────────────────────────────────────

export default function ManazerPage() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const isManagerOrAbove = role === "super_admin" || role === "majitel" || role === "manazer";
  const isMakler = role === "makler";

  // Makler sees only Štatistiky; manager+ sees all tabs
  type TabKey = "prehlad" | "statistiky" | "pobocka" | "tim" | "vytazenost" | "provizie";
  const [tab, setTab] = useState<TabKey>("statistiky");
  const [tabSet, setTabSet] = useState(false);

  // Po načítaní usera nastavíme správny default tab (+ podpora ?tab= URL parametra)
  useEffect(() => {
    if (user && !tabSet) {
      const urlTab = new URLSearchParams(window.location.search).get("tab") as TabKey | null;
      const validTab = urlTab && (["prehlad", "statistiky", "pobocka", "tim", "vytazenost", "provizie"] as TabKey[]).includes(urlTab);
      setTab(validTab ? urlTab! : (isManagerOrAbove ? "prehlad" : "statistiky"));
      setTabSet(true);
    }
  }, [user, isManagerOrAbove, tabSet]);

  const tabs: { id: TabKey; label: string }[] = [
    ...(isManagerOrAbove ? [{ id: "prehlad" as TabKey, label: "📊 Prehľad" }] : []),
    { id: "statistiky" as TabKey, label: "📉 Štatistiky" },
    ...(isManagerOrAbove ? [
      { id: "pobocka" as TabKey, label: "🏢 Pobočka" },
      { id: "tim" as TabKey, label: "👥 Tím" },
      { id: "vytazenost" as TabKey, label: "👷 Vyťaženosť" },
      { id: "provizie" as TabKey, label: "💼 Provízie" },
    ] : []),
  ];

  if (!user) {
    return <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)", fontSize: 14 }}>Načítavam...</div>;
  }

  if (!isManagerOrAbove && !isMakler) {
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
      {tab === "pobocka"    && <TabPobocka userRole={role} userPobockaId={(user as unknown as { pobocka_id?: string | null })?.pobocka_id ?? null} />}
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
  const [period, setPeriod] = useState<Period>("month");
  const [rawNeh, setRawNeh] = useState<NehPobRow[]>([]);
  const [rawMakleri, setRawMakleri] = useState<Array<{ id: string; email: string; meno: string }>>([]);

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
    setRawNeh(nh as NehPobRow[]);
    setRawMakleri((Array.isArray(makleriData) ? makleriData : []) as Array<{ id: string; email: string; meno: string }>);

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

  const top5From = periodStart(period);
  const top5Deals = rawNeh.filter(n => isDeal(n.stav_inzeratu) && new Date(n.updated_at ?? n.created_at) >= top5From);
  const top5Makleri = rawMakleri.map(m => ({
    id: m.id, meno: m.meno,
    deals: top5Deals.filter(n => n.makler_id === m.id).length,
    obrat: top5Deals.filter(n => n.makler_id === m.id).reduce((s, n) => s + (n.cena ?? 0), 0),
  })).filter(m => m.deals > 0).sort((a, b) => b.deals - a.deals).slice(0, 5);
  const top5Label = period === "month" ? "tento mesiac" : period === "quarter" ? "tento kvartál" : "tento rok";

  const konverznyPomer = totals.klienti > 0 ? Math.round((totals.nabery / totals.klienti) * 100) : 0;
  const maxMonthly = Math.max(...monthly.map(m => Math.max(m.klienti, m.nabery)), 1);

  if (loading) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: 14 }}>
      Načítavam štatistiky…
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <PeriodSwitch value={period} onChange={setPeriod} />
      </div>
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

      {/* Top 5 maklérov */}
      {top5Makleri.length > 0 && (
        <div style={{ background: "var(--bg-surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 24 }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Top 5 maklérov — {top5Label}</h3>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>podľa uzavretých obchodov</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "28px 2fr 1fr 1fr", padding: "10px 20px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            <span>#</span><span>Maklér</span><span style={{ textAlign: "center" }}>Obchody</span><span style={{ textAlign: "right" }}>Obrat</span>
          </div>
          {top5Makleri.map((m, i) => (
            <div key={m.id} style={{ display: "grid", gridTemplateColumns: "28px 2fr 1fr 1fr", padding: "12px 20px", alignItems: "center", borderBottom: i < top5Makleri.length - 1 ? "1px solid var(--border)" : "none", fontSize: 13 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? "#D97706" : "var(--text-muted)" }}>{i + 1}.</div>
              <div style={{ fontWeight: 600 }}>{m.meno}</div>
              <div style={{ textAlign: "center", fontWeight: 700 }}>{m.deals}</div>
              <div style={{ textAlign: "right", color: "var(--text-muted)" }}>{m.obrat > 0 ? `${m.obrat.toLocaleString("sk")} €` : "—"}</div>
            </div>
          ))}
        </div>
      )}

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

  // Top 5 maklérov — viditeľné pre všetkých (makléri vidia súťaž)
  interface MaklerStat { id: string; meno: string; deals: number; obrat: number; }
  const allDealsInPeriod = nehnutelnosti.filter(n => isDeal(n.stav_inzeratu) && new Date(n.updated_at ?? n.created_at) >= from);
  const topMakleri: MaklerStat[] = makleriList.map(m => ({
    id: m.id,
    meno: m.meno,
    deals: allDealsInPeriod.filter(n => n.makler_id === m.id || n.makler === m.id).length,
    obrat: allDealsInPeriod.filter(n => n.makler_id === m.id || n.makler === m.id).reduce((s, n) => s + (n.cena ?? 0), 0),
  }))
    .filter(m => m.deals > 0)
    .sort((a, b) => b.deals - a.deals)
    .slice(0, 5);

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

      {/* Top 5 maklérov — viditeľné pre všetkých */}
      {topMakleri.length > 0 ? (
        <div style={{ background: "var(--bg-surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Top 5 maklérov — {periodLabel}</h3>
            {!isManagerOrAbove && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>súťaž tímu</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isManagerOrAbove ? "28px 2fr 1fr 1fr" : "28px 2fr 1fr", padding: "10px 20px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            <span>#</span>
            <span>Maklér</span>
            <span style={{ textAlign: "center" }}>Obchody</span>
            {isManagerOrAbove && <span style={{ textAlign: "right" }}>Obrat</span>}
          </div>
          {topMakleri.map((m, i) => {
            const isMe = m.id === myMaklerUuid;
            return (
              <div key={m.id} style={{ display: "grid", gridTemplateColumns: isManagerOrAbove ? "28px 2fr 1fr 1fr" : "28px 2fr 1fr", padding: "13px 20px", alignItems: "center", borderBottom: i < topMakleri.length - 1 ? "1px solid var(--border)" : "none", fontSize: 13, background: isMe ? "rgba(55,65,81,0.04)" : "transparent" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? "#D97706" : "var(--text-muted)" }}>{i + 1}.</div>
                <div style={{ fontWeight: isMe ? 700 : 600, color: "var(--text-primary)" }}>
                  {m.meno}{isMe && <span style={{ marginLeft: 6, fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>vy</span>}
                </div>
                <div style={{ textAlign: "center", fontWeight: 700, color: "#374151" }}>{m.deals}</div>
                {isManagerOrAbove && <div style={{ textAlign: "right", fontWeight: 600, color: "var(--text-secondary)" }}>{m.obrat > 0 ? `${m.obrat.toLocaleString("sk")} €` : "—"}</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)", fontSize: 13 }}>
          Žiadne uzavreté obchody za {periodLabel}.
        </div>
      )}
    </div>
  );
}

// ─── Tab: Tím ─────────────────────────────────────────────────────────────────

function TabTim() {
  const { user, accounts, addAccount, updateAccount, deleteAccount } = useAuth();
  const isAdmin = isSuperAdmin(user?.role);

  const [klienti, setKlienti] = useState<Array<{ makler_id: string }>>([]);
  const [nabery,  setNabery]  = useState<Array<{ makler_id: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Nový účet
  const [showForm, setShowForm]               = useState(false);
  const [newUserName, setNewUserName]         = useState("");
  const [newUserEmail, setNewUserEmail]       = useState("");
  const [newUserLoginEmail, setNewUserLoginEmail] = useState("");
  const [newUserRole, setNewUserRole]         = useState("Maklér · Vianema");
  const [newUserPw, setNewUserPw]             = useState("");

  // Editácia účtu
  const [editingUser, setEditingUser]   = useState<User | null>(null);
  const [accountSaved, setAccountSaved] = useState(false);

  // Feature toggles
  const [featureToggles, setFeatureToggles] = useState<FeatureToggles>({});
  const [expandedUser, setExpandedUser]     = useState<string | null>(null);

  // Pozvánky
  const [inviteSending, setInviteSending]   = useState<string | null>(null);
  const [inviteSentFor, setInviteSentFor]   = useState<string | null>(null);
  const [selectedInvites, setSelectedInvites] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending]       = useState(false);
  const [bulkDone, setBulkDone]             = useState<string[]>([]);

  useEffect(() => {
    setFeatureToggles(loadFeatureToggles());
    (async () => {
      setLoading(true);
      const [kl, nb] = await Promise.all([
        fetch("/api/klienti").then(r => r.json()),
        fetch("/api/nabery").then(r => r.json()),
      ]);
      setKlienti(kl ?? []);
      setNabery(nb ?? []);
      setLoading(false);
    })();
  }, []);

  const getKlientCount = (id: string) => klienti.filter(k => k.makler_id === id).length;
  const getNaberCount  = (id: string) => nabery.filter(n => n.makler_id === id).length;

  const roleLabel = (r: string) => {
    if (r === "super_admin" || r === "Admin · Vianema") return "Admin";
    if (r === "majitel"     || r === "Konateľ · Vianema") return "Majiteľ";
    if (r === "manazer") return "Manažér";
    return "Maklér";
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: 14 }}>Načítavam…</div>
  );

  return (
    <div>
      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Členov tímu",   value: accounts.length },
          { label: "Klienti spolu", value: klienti.length },
          { label: "Nábery spolu",  value: nabery.length },
        ].map(s => (
          <div key={s.label} style={{ padding: 16, background: "var(--bg-surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Nový účet — iba admin */}
      {isAdmin && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button onClick={() => setShowForm(!showForm)} style={{
            padding: "9px 18px", background: "#374151", color: "#fff",
            borderRadius: 10, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
          }}>
            + Nový účet
          </button>
        </div>
      )}

      {isAdmin && showForm && (
        <div style={{ padding: "16px", borderRadius: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border)", marginBottom: "16px" }}>
          <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "12px" }}>Nový účet</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }} className="naber-grid">
            <div>
              <div style={labelSt}>Meno a priezvisko</div>
              <input style={inputSt} value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Meno Priezvisko" />
            </div>
            <div>
              <div style={labelSt}>Vianema email</div>
              <input type="email" style={inputSt} value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="meno@vianema.eu" />
            </div>
            <div>
              <div style={labelSt}>Gmail pre prihlásenie (Google OAuth)</div>
              <input type="email" style={inputSt} value={newUserLoginEmail} onChange={e => setNewUserLoginEmail(e.target.value)} placeholder="meno.priezvisko@gmail.com" />
            </div>
            <div>
              <div style={labelSt}>Rola</div>
              <select style={inputSt} value={newUserRole} onChange={e => setNewUserRole(e.target.value)}>
                <option value="Maklér · Vianema">Maklér</option>
                <option value="Konateľ · Vianema">Konateľ</option>
                <option value="Admin · Vianema">Admin</option>
              </select>
            </div>
            <div>
              <div style={labelSt}>Heslo (voliteľné)</div>
              <PasswordInput
                autoComplete="new-password"
                value={newUserPw} onChange={e => setNewUserPw(e.target.value)}
                placeholder="Bez hesla = priamy prístup"
                style={inputSt as React.CSSProperties}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <button onClick={() => {
              if (!newUserName.trim()) return;
              const id = newUserName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
              const parts = newUserName.trim().split(" ");
              const initials = `${(parts[0] || "")[0] || ""}${(parts[1] || "")[0] || ""}`.toUpperCase();
              addAccount({ id, name: newUserName.trim(), initials, role: newUserRole, email: newUserEmail, login_email: newUserLoginEmail || undefined, password: newUserPw || "" });
              setNewUserName(""); setNewUserEmail(""); setNewUserLoginEmail(""); setNewUserPw("");
              setShowForm(false);
            }} style={{
              padding: "8px 18px", background: "#374151", color: "#fff", border: "none",
              borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer",
            }}>Vytvoriť</button>
            <button onClick={() => setShowForm(false)} style={{
              padding: "8px 18px", background: "var(--bg-surface)", color: "var(--text-primary)",
              border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer",
            }}>Zrušiť</button>
          </div>
        </div>
      )}

      {/* Bulk invite toolbar */}
      {isAdmin && selectedInvites.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", marginBottom: "8px", borderRadius: "10px", background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
          <span style={{ fontSize: "13px", color: "#1D4ED8", fontWeight: 600 }}>
            {selectedInvites.size} {selectedInvites.size === 1 ? "maklér vybraný" : "makléri vybraní"}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => setSelectedInvites(new Set())} style={{ padding: "5px 10px", background: "transparent", border: "1px solid #BFDBFE", borderRadius: "6px", fontSize: "11px", cursor: "pointer", color: "#1D4ED8" }}>
              Zrušiť výber
            </button>
            <button disabled={bulkSending} onClick={async () => {
              setBulkSending(true); setBulkDone([]);
              const ids = Array.from(selectedInvites);
              const results = await Promise.all(ids.map(id =>
                fetch("/api/users/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: id }) })
                  .then(r => ({ id, ok: r.ok })).catch(() => ({ id, ok: false }))
              ));
              const sent = results.filter(r => r.ok).map(r => r.id);
              const failed = results.filter(r => !r.ok);
              setBulkDone(sent); setBulkSending(false); setSelectedInvites(new Set());
              if (failed.length > 0) alert(`${failed.length} pozvánok sa nepodarilo odoslať.`);
              setTimeout(() => setBulkDone([]), 5000);
            }} style={{ padding: "5px 14px", background: bulkSending ? "#93C5FD" : "#2563EB", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: bulkSending ? "not-allowed" : "pointer", color: "#fff" }}>
              {bulkSending ? "Odosielam…" : `✉ Poslať ${selectedInvites.size} pozvánok`}
            </button>
          </div>
        </div>
      )}

      {/* Zoznam účtov */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {accounts.map(acc => {
          const isMe = user?.id === acc.id;
          return (
            <div key={acc.id} style={{
              borderRadius: "10px", overflow: "hidden",
              background: bulkDone.includes(acc.id) ? "#F0FDF4" : "var(--bg-elevated)",
              border: `1px solid ${bulkDone.includes(acc.id) ? "#86EFAC" : "var(--border)"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px" }}>
                {isAdmin && acc.id !== "ales" && (
                  <input type="checkbox" checked={selectedInvites.has(acc.id)} onChange={e => {
                    const next = new Set(selectedInvites);
                    e.target.checked ? next.add(acc.id) : next.delete(acc.id);
                    setSelectedInvites(next);
                  }} style={{ width: "15px", height: "15px", accentColor: "#2563EB", flexShrink: 0, cursor: "pointer" }} />
                )}
                <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: isMe ? "#374151" : "#6B7280", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", flexShrink: 0 }}>
                  {acc.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>
                    {acc.name} {acc.password ? "🔒" : ""} {isMe && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>(vy)</span>}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {acc.email} · {roleLabel(acc.role)} · {getKlientCount(acc.id)} klientov · {getNaberCount(acc.id)} náberov
                  </div>
                  {acc.login_email && (
                    <div style={{ fontSize: "11px", color: "#3B82F6", marginTop: "2px" }}>G {acc.login_email}</div>
                  )}
                </div>

                {isAdmin && editingUser?.id === acc.id ? (
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                    <input type="email" placeholder="Gmail pre Google login" value={editingUser.login_email || ""}
                      onChange={e => setEditingUser({ ...editingUser, login_email: e.target.value })}
                      style={{ ...inputSt, width: "200px", padding: "6px 10px", fontSize: "12px" }}
                    />
                    <div style={{ width: "180px" }}>
                      <PasswordInput autoComplete="new-password" placeholder="Nové heslo" value={editingUser.password || ""}
                        onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                        style={{ ...inputSt, padding: "6px 32px 6px 10px", fontSize: "12px" } as React.CSSProperties}
                      />
                    </div>
                    <button onClick={() => {
                      updateAccount(editingUser); setEditingUser(null);
                      setAccountSaved(true); setTimeout(() => setAccountSaved(false), 2000);
                    }} style={{ padding: "6px 12px", background: "#374151", color: "#fff", border: "none", borderRadius: "6px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}>
                      Uložiť
                    </button>
                    <button onClick={() => setEditingUser(null)} style={{ padding: "6px 8px", background: "transparent", color: "var(--text-muted)", border: "none", fontSize: "11px", cursor: "pointer" }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {isAdmin && acc.id !== "ales" && (
                      <button onClick={() => setExpandedUser(expandedUser === acc.id ? null : acc.id)} style={{
                        padding: "5px 10px", background: expandedUser === acc.id ? "#374151" : "var(--bg-surface)",
                        color: expandedUser === acc.id ? "#fff" : "var(--text-secondary)",
                        border: "1px solid var(--border)", borderRadius: "6px", fontSize: "11px", cursor: "pointer",
                      }}>Funkcie</button>
                    )}
                    {isAdmin && (
                      <button onClick={() => setEditingUser({ ...acc })} style={{ padding: "5px 10px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "11px", cursor: "pointer", color: "var(--text-secondary)" }}>
                        Heslo
                      </button>
                    )}
                    {isAdmin && acc.id !== "ales" && (
                      <button onClick={async () => {
                        if (inviteSending) return;
                        setInviteSending(acc.id); setInviteSentFor(null);
                        try {
                          const res = await fetch("/api/users/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: acc.id }) });
                          const body = await res.json();
                          if (!res.ok) { alert("Chyba: " + (body.error || "neznáma")); return; }
                          setInviteSentFor(acc.id);
                          setTimeout(() => setInviteSentFor(null), 4000);
                        } catch (e) { alert("Chyba: " + (e instanceof Error ? e.message : e)); }
                        finally { setInviteSending(null); }
                      }} style={{
                        padding: "5px 10px",
                        background: inviteSentFor === acc.id ? "#D1FAE5" : "var(--bg-surface)",
                        border: `1px solid ${inviteSentFor === acc.id ? "#6EE7B7" : "var(--border)"}`,
                        borderRadius: "6px", fontSize: "11px", cursor: "pointer",
                        color: inviteSentFor === acc.id ? "#065F46" : "var(--text-secondary)",
                        opacity: inviteSending === acc.id ? 0.6 : 1,
                      }}>
                        {inviteSending === acc.id ? "…" : inviteSentFor === acc.id ? "✓ Odoslané" : "✉ Pozvánka"}
                      </button>
                    )}
                    {isAdmin && acc.id !== "ales" && (
                      <button onClick={async () => {
                        if (!confirm(`Resetovať heslo pre ${acc.name}?`)) return;
                        try {
                          const res = await fetch("/api/users/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: acc.id }) });
                          const body = await res.json();
                          if (!res.ok) { alert("Chyba: " + (body.error || "neznáma")); return; }
                          try { await navigator.clipboard.writeText(body.temp_password); } catch { /* ignore */ }
                          alert(`✅ Heslo resetované pre ${acc.name}\n\nDočasné heslo (skopírované do schránky):\n\n${body.temp_password}\n\nPošli ho maklerovi bezpečným kanálom.`);
                        } catch (e) { alert("Chyba: " + (e instanceof Error ? e.message : e)); }
                      }} style={{ padding: "5px 10px", background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: "6px", fontSize: "11px", cursor: "pointer", color: "#92400E" }}>
                        🔑 Reset
                      </button>
                    )}
                    {isAdmin && acc.id !== "ales" && (
                      <button onClick={() => { if (confirm(`Odstrániť účet ${acc.name}?`)) deleteAccount(acc.id); }} style={{ padding: "5px 10px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "11px", cursor: "pointer", color: "#EF4444" }}>
                        Odstrániť
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Feature toggles panel */}
              {isAdmin && expandedUser === acc.id && acc.id !== "ales" && (
                <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)", background: "var(--bg-surface)" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "10px" }}>
                    Povolené funkcie pre {acc.name}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }} className="naber-grid">
                    {ALL_FEATURES.map(feat => {
                      const enabled = featureToggles[acc.id]?.[feat.id] !== false;
                      return (
                        <button key={feat.id} onClick={() => {
                          const next = { ...featureToggles };
                          if (!next[acc.id]) next[acc.id] = {} as Record<FeatureId, boolean>;
                          next[acc.id][feat.id] = !enabled;
                          setFeatureToggles(next);
                          saveFeatureToggles(next);
                        }} style={{
                          display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "8px",
                          background: enabled ? "#F0FDF4" : "var(--bg-elevated)",
                          border: `1px solid ${enabled ? "#BBF7D0" : "var(--border)"}`,
                          cursor: "pointer", fontSize: "12px", fontWeight: "500",
                          color: enabled ? "#065F46" : "var(--text-muted)", transition: "all 0.15s",
                        }}>
                          <div style={{ width: "32px", height: "18px", borderRadius: "9px", background: enabled ? "#10B981" : "#D1D5DB", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                            <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#fff", position: "absolute", top: "2px", left: enabled ? "16px" : "2px", transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }} />
                          </div>
                          {feat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {accountSaved && (
        <div style={{ fontSize: "13px", color: "#065F46", fontWeight: "500", marginTop: "12px" }}>Účet aktualizovaný</div>
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

// ─── Tab: Pobočka ─────────────────────────────────────────────────────────────

function TabPobocka({ userRole, userPobockaId }: { userRole: string; userPobockaId: string | null }) {
  const [period, setPeriod] = useState<Period>("month");
  const [loading, setLoading] = useState(true);
  const [nehnutelnosti, setNehnutelnosti] = useState<NehPobRow[]>([]);
  const [klienti, setKlienti] = useState<KlientPobRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pobocky, setPobocky] = useState<PobockaRow[]>([]);

  type SortKey = "nazov" | "makleri" | "nabery" | "obrat" | "obchody";
  const [sortKey, setSortKey] = useState<SortKey>("obrat");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [drillPobocka, setDrillPobocka] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [nehData, klData, usersData, pobData] = await Promise.all([
        fetch("/api/nehnutelnosti").then(r => r.json()),
        fetch("/api/klienti").then(r => r.json()),
        fetch("/api/users").then(r => r.json()),
        fetch("/api/pobocky").then(r => r.json()).catch(() => []),
      ]);
      setNehnutelnosti(nehData ?? []);
      setKlienti(klData ?? []);
      setUsers(usersData.users ?? []);
      setPobocky(Array.isArray(pobData) ? pobData : []);
      setLoading(false);
    }
    load();
  }, []);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const from = periodStart(period);
  const isManazer = userRole === "manazer";

  const rows = useMemo(() => pobocky.map(p => {
    const pobockaUsers = users.filter(u => u.pobocka_id === p.id);
    const pobockaUserIds = new Set(pobockaUsers.map(u => u.id));
    const deals = nehnutelnosti.filter(n => isDeal(n.stav_inzeratu) && inPeriod(n.updated_at ?? n.created_at, from) && (n.makler_id ? pobockaUserIds.has(n.makler_id) : false));
    const nabery = klienti.filter(k => inPeriod(k.created_at, from) && (k.makler_id ? pobockaUserIds.has(k.makler_id) : false));
    const obrat = deals.reduce((s, n) => s + (n.cena ?? 0), 0);
    const provizia = deals.reduce((s, n) => s + (n.provizia_hodnota ?? (n.cena ?? 0) * 0.03), 0);
    return { ...p, makleriCount: pobockaUsers.length, naberyCount: nabery.length, obchodovCount: deals.length, obrat, provizia };
  }), [pobocky, users, nehnutelnosti, klienti, from]);

  const sorted = [...rows].sort((a, b) => {
    const v = sortDir === "asc" ? 1 : -1;
    if (sortKey === "nazov") return v * a.nazov.localeCompare(b.nazov);
    if (sortKey === "makleri") return v * (a.makleriCount - b.makleriCount);
    if (sortKey === "nabery") return v * (a.naberyCount - b.naberyCount);
    if (sortKey === "obrat") return v * (a.obrat - b.obrat);
    return v * (a.obchodovCount - b.obchodovCount);
  });

  const SortTh = ({ k, label }: { k: SortKey; label: string }) => (
    <th onClick={() => handleSort(k)} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textAlign: k === "nazov" ? "left" : "right", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
      {label}{sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );

  const drill = drillPobocka ? rows.find(r => r.id === drillPobocka) : null;
  const drillMakleri = drill ? users.filter(u => u.pobocka_id === drill.id) : [];
  const drillDeals = drill ? nehnutelnosti.filter(n => isDeal(n.stav_inzeratu) && inPeriod(n.updated_at ?? n.created_at, from) && drillMakleri.some(u => u.id === n.makler_id)) : [];

  if (loading) return <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: 14 }}>Načítavam…</div>;

  if (pobocky.length === 0) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: 14 }}>
      Žiadne pobočky. Pridaj ich v Nastaveniach.
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Porovnanie pobočiek</div>
        <PeriodSwitch value={period} onChange={setPeriod} />
      </div>

      {drillPobocka && drill ? (
        <div>
          <button onClick={() => setDrillPobocka(null)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--text-primary)", cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0 }}>
            ← Späť
          </button>
          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{drill.nazov}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>{drill.mesto}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              <KpiCard label="Makléri" value={drill.makleriCount} />
              <KpiCard label="Nábery" value={drill.naberyCount} sub="za obdobie" />
              <KpiCard label="Obchody" value={drill.obchodovCount} sub="za obdobie" />
              <KpiCard label="Obrat" value={drill.obrat ? fmtEur(drill.obrat) : "—"} color="var(--success)" />
            </div>
          </div>
          <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 13 }}>Makléri pobočky</div>
            {drillMakleri.length === 0 ? (
              <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 13 }}>Žiadni makléri</div>
            ) : drillMakleri.map((u, i) => {
              const uDeals = drillDeals.filter(n => n.makler_id === u.id);
              const uObrat = uDeals.reduce((s, n) => s + (n.cena ?? 0), 0);
              return (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderBottom: i < drillMakleri.length - 1 ? "1px solid var(--border)" : "none", fontSize: 13 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#374151", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{avatarInitials(u.name || u.email)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{u.name || u.email}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{u.role}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700 }}>{uDeals.length} obchodov</div>
                    <div style={{ fontSize: 11, color: "var(--success)" }}>{uObrat ? fmtEur(uObrat) : "—"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <SortTh k="nazov" label="Pobočka" />
                <SortTh k="makleri" label="Makléri" />
                <SortTh k="nabery" label="Nábery" />
                <SortTh k="obchody" label="Obchody" />
                <SortTh k="obrat" label="Obrat" />
                {(userRole === "super_admin" || userRole === "majitel") && <th style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textAlign: "right" }}>Provízia</th>}
                <th style={{ padding: "10px 14px" }} />
              </tr>
            </thead>
            <tbody>
              {sorted.filter(r => isManazer ? r.id === userPobockaId : true).map((r, i) => {
                const canDrill = userRole === "super_admin" || userRole === "majitel" || (isManazer && r.id === userPobockaId);
                return (
                  <tr key={r.id} style={{ borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none", background: isManazer && r.id === userPobockaId ? "var(--bg-elevated)" : "transparent" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 600, fontSize: 13 }}>
                      <div>{r.nazov}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{r.mesto}</div>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 13 }}>{r.makleriCount}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 13 }}>{r.naberyCount}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 13, fontWeight: 600 }}>{r.obchodovCount}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 13, fontWeight: 700 }}>{r.obrat ? fmtEur(r.obrat) : "—"}</td>
                    {(userRole === "super_admin" || userRole === "majitel") && <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 13, color: "var(--success)" }}>{r.provizia ? fmtEur(r.provizia) : "—"}</td>}
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      {canDrill && <button onClick={() => setDrillPobocka(r.id)} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "var(--text-primary)" }}>Detail →</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
