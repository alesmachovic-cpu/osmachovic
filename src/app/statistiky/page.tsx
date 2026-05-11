"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { STATUS_LABELS } from "@/lib/database.types";

/* ─────────────────────────── Typy ─────────────────────────── */
type Period = "month" | "quarter" | "year";
type TabKey = "celkove" | "pobocky" | "makleri" | "sutaz";

interface Nehnutelnost {
  id: string; nazov: string | null; typ_nehnutelnosti: string | null;
  stav_inzeratu: string | null; cena: number | null; plocha: number | null;
  lokalita: string | null; created_at: string; updated_at: string | null;
  makler_id: string | null; makler_email: string | null; makler: string | null;
  makler_meno: string | null; provizia_hodnota: number | null;
}
interface Klient { id: string; status: string; created_at: string; makler_id: string | null; }
interface Makler { id: string; meno: string; email: string; }
interface User { id: string; name: string; role: string; email: string; pobocka_id: string | null; }
interface Pobocka { id: string; nazov: string; mesto: string; }

/* ─────────────────────────── Helpers ─────────────────────────── */
function fmt(n: number) { return n.toLocaleString("sk"); }
function fmtEur(n: number) { return n.toLocaleString("sk", { maximumFractionDigits: 0 }) + " €"; }

function periodStart(p: Period): Date {
  const now = new Date();
  if (p === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (p === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return new Date(now.getFullYear(), q * 3, 1);
  }
  return new Date(now.getFullYear(), 0, 1);
}

function prevPeriodStart(p: Period): Date {
  const now = new Date();
  if (p === "month") return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  if (p === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return new Date(now.getFullYear(), (q - 1) * 3, 1);
  }
  return new Date(now.getFullYear() - 1, 0, 1);
}

function isDeal(n: Nehnutelnost) {
  return ["predany", "predaný", "archiv"].includes((n.stav_inzeratu ?? "").toLowerCase());
}

function dealDate(n: Nehnutelnost) { return new Date(n.updated_at ?? n.created_at); }

function inPeriod(n: Nehnutelnost, from: Date) { return dealDate(n) >= from; }

function avatarInitials(name: string) {
  return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
}

/* ─────────────────────────── Shared UI ─────────────────────────── */
const S = {
  card: {
    background: "var(--bg-surface)", border: "1px solid var(--border)",
    borderRadius: "12px", padding: "18px 20px",
  } as React.CSSProperties,
  kpi: {
    background: "var(--bg-surface)", border: "1px solid var(--border)",
    borderRadius: "12px", padding: "16px 18px",
  } as React.CSSProperties,
  tag: (color: string): React.CSSProperties => ({
    display: "inline-block", padding: "2px 8px", borderRadius: "6px",
    fontSize: "11px", fontWeight: 600, background: color + "20", color,
  }),
};

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={S.kpi}>
      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: "26px", fontWeight: 800, color: color ?? "var(--text-primary)", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>{sub}</div>}
    </div>
  );
}

function Bar({ val, max, color = "var(--accent)" }: { val: number; max: number; color?: string }) {
  return (
    <div style={{ height: "7px", background: "var(--border)", borderRadius: "4px", flex: 1 }}>
      <div style={{ width: `${max ? Math.min((val / max) * 100, 100) : 0}%`, height: "100%", background: color, borderRadius: "4px", transition: "width 0.4s ease" }} />
    </div>
  );
}

function PeriodSwitch({ value, onChange, tabs }: { value: Period; onChange: (p: Period) => void; tabs?: Period[] }) {
  const options = [
    { key: "month" as Period, label: "Mesiac" },
    { key: "quarter" as Period, label: "Kvartál" },
    { key: "year" as Period, label: "Rok" },
  ].filter(o => !tabs || tabs.includes(o.key));
  return (
    <div style={{ display: "flex", gap: "4px", background: "var(--bg-elevated)", borderRadius: "8px", padding: "3px" }}>
      {options.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)} style={{
          padding: "5px 12px", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: value === o.key ? 700 : 500,
          background: value === o.key ? "var(--bg-surface)" : "transparent",
          color: value === o.key ? "var(--text-primary)" : "var(--text-muted)", cursor: "pointer",
          boxShadow: value === o.key ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
        }}>{o.label}</button>
      ))}
    </div>
  );
}

/* ─────────────────────────── Tab: CELKOVÉ ─────────────────────────── */
function TabCelkove({ nehnutelnosti, klienti, period, onPeriodChange }: {
  nehnutelnosti: Nehnutelnost[]; klienti: Klient[]; period: Period; onPeriodChange: (p: Period) => void;
}) {
  const from = periodStart(period);
  const active = nehnutelnosti.filter(n => !isDeal(n));
  const deals = nehnutelnosti.filter(isDeal);
  const dealsThisPeriod = deals.filter(n => inPeriod(n, from));
  const obrat = dealsThisPeriod.reduce((s, n) => s + (n.cena ?? 0), 0);
  const provizia = dealsThisPeriod.reduce((s, n) => s + (n.provizia_hodnota ?? (n.cena ?? 0) * 0.03), 0);
  const avgCena = active.length ? active.reduce((s, n) => s + (n.cena ?? 0), 0) / active.length : 0;
  const klientiThisPeriod = klienti.filter(k => new Date(k.created_at) >= from);

  const portfolioValue = active.reduce((s, n) => s + (n.cena ?? 0), 0);
  const proviziaMinEstimate = active.reduce((s, n) => s + (n.cena ?? 0) * 0.02, 0);
  const proviziaMaxEstimate = active.reduce((s, n) => s + (n.cena ?? 0) * 0.04, 0);

  const statusDist = klienti.reduce((acc, k) => { acc[k.status] = (acc[k.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const typDist = active.reduce((acc, n) => { const t = n.typ_nehnutelnosti || "iný"; acc[t] = (acc[t] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const maxStatusCount = Math.max(...Object.values(statusDist), 1);
  const maxTypCount = Math.max(...Object.values(typDist), 1);

  const months: { label: string; key: string; obrat: number; deals: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("sk", { month: "short" });
    const mDeals = deals.filter(n => (n.updated_at ?? n.created_at).startsWith(key));
    months.push({ label, key, obrat: mDeals.reduce((s, n) => s + (n.cena ?? 0), 0), deals: mDeals.length });
  }
  const maxObrat = Math.max(...months.map(m => m.obrat), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Firemné portfólio a výkon</div>
        <PeriodSwitch value={period} onChange={onPeriodChange} />
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
        <KpiCard label="Klienti celkom" value={klienti.length} sub={`+${klientiThisPeriod.length} za obdobie`} color="var(--success)" />
        <KpiCard label="Aktívne nehn." value={active.length} sub={`Priem. cena ${avgCena ? Math.round(avgCena / 1000) + "k €" : "—"}`} color="var(--warning)" />
        <KpiCard label="Uzavreté obchody" value={dealsThisPeriod.length} sub="za vybrané obdobie" color="var(--accent)" />
        <KpiCard label="Obrat za obdobie" value={obrat ? fmtEur(obrat) : "—"} sub={provizia ? `Prov. firmy ~${fmtEur(provizia)}` : undefined} color="var(--purple, #9f5cf7)" />
      </div>

      {/* Pipeline */}
      <div style={{ ...S.card, borderLeft: "4px solid var(--success)" }}>
        <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)", marginBottom: "12px" }}>💰 Pipeline — Potenciálny zisk z aktívneho portfólia</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
          <div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Celková hodnota</div>
            <div style={{ fontSize: "22px", fontWeight: 800 }}>{fmtEur(portfolioValue)}</div>
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Min. provízia (2 %)</div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--warning)" }}>{fmtEur(proviziaMinEstimate)}</div>
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Max. provízia (4 %)</div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--success)" }}>{fmtEur(proviziaMaxEstimate)}</div>
          </div>
        </div>
      </div>

      {/* Mesačný trend */}
      <div style={S.card}>
        <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)", marginBottom: "16px" }}>📈 Trend obratu (6 mesiacov)</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", height: "100px" }}>
          {months.map(m => (
            <div key={m.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}>
              <div style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                <div title={`${fmtEur(m.obrat)} · ${m.deals} obchodov`} style={{
                  width: "100%", background: m.obrat > 0 ? "var(--accent)" : "var(--border)",
                  borderRadius: "4px 4px 0 0", height: `${Math.max((m.obrat / maxObrat) * 100, m.deals > 0 ? 8 : 2)}%`,
                }} />
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>{m.label}</div>
              {m.deals > 0 && <div style={{ fontSize: "9px", color: "var(--text-muted)" }}>{m.deals}×</div>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* Klienti by status */}
        <div style={S.card}>
          <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)", marginBottom: "14px" }}>Klienti podľa statusu</div>
          {Object.keys(statusDist).length === 0
            ? <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Žiadni klienti</div>
            : Object.entries(statusDist).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
              <div key={status} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", minWidth: "130px" }}>{STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}</div>
                <Bar val={count} max={maxStatusCount} />
                <div style={{ fontSize: "12px", fontWeight: 600, minWidth: "24px", textAlign: "right" }}>{count}</div>
              </div>
            ))}
        </div>

        {/* Portfolio by typ */}
        <div style={S.card}>
          <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)", marginBottom: "14px" }}>Portfólio podľa typu</div>
          {Object.keys(typDist).length === 0
            ? <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Žiadne nehnuteľnosti</div>
            : Object.entries(typDist).sort((a, b) => b[1] - a[1]).map(([typ, count]) => (
              <div key={typ} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", minWidth: "100px", textTransform: "capitalize" }}>{typ.replace(/-/g, " ")}</div>
                <Bar val={count} max={maxTypCount} color="var(--success)" />
                <div style={{ fontSize: "12px", fontWeight: 600, minWidth: "24px", textAlign: "right" }}>{count}</div>
              </div>
            ))}
        </div>
      </div>

      {/* Top 5 nehn */}
      {active.length > 0 && (
        <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: "14px" }}>Top nehnuteľnosti v portfóliu</div>
          {active.sort((a, b) => (b.cena ?? 0) - (a.cena ?? 0)).slice(0, 5).map((n, i, arr) => (
            <div key={n.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr", padding: "12px 20px", borderBottom: i < arr.length - 1 ? "1px solid var(--border-subtle, var(--border))" : "none", alignItems: "center", fontSize: "13px" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{n.nazov || "—"}</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{n.lokalita}</div>
              </div>
              <div style={{ fontWeight: 700, color: "var(--accent)" }}>{n.cena ? fmtEur(n.cena) : "—"}</div>
              <div style={{ color: "var(--text-secondary)", textTransform: "capitalize", fontSize: "12px" }}>{n.typ_nehnutelnosti || "—"}</div>
              <div style={{ color: "var(--success)", fontSize: "12px" }}>~{n.cena ? fmtEur(Math.round(n.cena * 0.03)) : "—"} (3 %)</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Tab: POBOČKY ─────────────────────────── */
function TabPobocky({ nehnutelnosti, klienti, users, pobocky, period, onPeriodChange, userRole, userPobockaId }: {
  nehnutelnosti: Nehnutelnost[]; klienti: Klient[]; users: User[]; pobocky: Pobocka[];
  period: Period; onPeriodChange: (p: Period) => void; userRole: string; userPobockaId: string | null;
}) {
  const from = periodStart(period);
  const isManazer = userRole === "manazer";

  type SortKey = "nazov" | "makleri" | "nabery" | "obrat" | "obchody";
  const [sortKey, setSortKey] = useState<SortKey>("obrat");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [drillPobocka, setDrillPobocka] = useState<string | null>(null);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const rows = useMemo(() => pobocky.map(p => {
    const pobockaUsers = users.filter(u => u.pobocka_id === p.id);
    const pobockaUserIds = new Set(pobockaUsers.map(u => u.id));
    const deals = nehnutelnosti.filter(n => isDeal(n) && inPeriod(n, from) && (n.makler_id ? pobockaUserIds.has(n.makler_id) : false));
    const nabery = klienti.filter(k => new Date(k.created_at) >= from && (k.makler_id ? pobockaUserIds.has(k.makler_id) : false));
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
    <th onClick={() => handleSort(k)} style={{ padding: "10px 14px", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textAlign: k === "nazov" ? "left" : "right", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
      {label}{sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );

  const drill = drillPobocka ? rows.find(r => r.id === drillPobocka) : null;
  const drillMakleri = drill ? users.filter(u => u.pobocka_id === drill.id) : [];
  const drillDeals = drill ? nehnutelnosti.filter(n => isDeal(n) && inPeriod(n, from) && drillMakleri.some(u => u.id === n.makler_id)) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Porovnanie pobočiek</div>
        <PeriodSwitch value={period} onChange={onPeriodChange} />
      </div>

      {drillPobocka && drill ? (
        <div>
          <button onClick={() => setDrillPobocka(null)} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "13px", fontWeight: 600, marginBottom: "16px", padding: 0 }}>
            ← Späť na prehľad
          </button>
          <div style={{ ...S.card, marginBottom: "16px" }}>
            <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "4px" }}>{drill.nazov}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>{drill.mesto}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
              <KpiCard label="Makléri" value={drill.makleriCount} />
              <KpiCard label="Nábery" value={drill.naberyCount} sub="za obdobie" />
              <KpiCard label="Obchody" value={drill.obchodovCount} sub="za obdobie" />
              <KpiCard label="Obrat" value={drill.obrat ? fmtEur(drill.obrat) : "—"} sub={drill.provizia ? `Prov. ~${fmtEur(drill.provizia)}` : undefined} color="var(--success)" />
            </div>
          </div>
          <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: "13px" }}>Makléri pobočky</div>
            {drillMakleri.length === 0 ? <div style={{ padding: "16px", color: "var(--text-muted)", fontSize: "13px" }}>Žiadni makléri</div> : drillMakleri.map((u, i) => {
              const uDeals = drillDeals.filter(n => n.makler_id === u.id);
              const uObrat = uDeals.reduce((s, n) => s + (n.cena ?? 0), 0);
              return (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 16px", borderBottom: i < drillMakleri.length - 1 ? "1px solid var(--border)" : "none", fontSize: "13px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#fff", flexShrink: 0 }}>{avatarInitials(u.name || u.email)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{u.name || u.email}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{u.role}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700 }}>{uDeals.length} obchodov</div>
                    <div style={{ fontSize: "11px", color: "var(--success)" }}>{uObrat ? fmtEur(uObrat) : "—"}</div>
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
                {(userRole === "super_admin" || userRole === "majitel") && <th style={{ padding: "10px 14px", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textAlign: "right" }}>Provízia</th>}
                <th style={{ padding: "10px 14px" }} />
              </tr>
            </thead>
            <tbody>
              {sorted.filter(r => isManazer ? r.id === userPobockaId : true).map((r, i) => {
                const canDrill = userRole === "super_admin" || userRole === "majitel" || (isManazer && r.id === userPobockaId);
                return (
                  <tr key={r.id} style={{ borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none", background: isManazer && r.id === userPobockaId ? "var(--bg-elevated)" : "transparent" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 600, fontSize: "13px" }}>
                      <div>{r.nazov}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 400 }}>{r.mesto}</div>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: "13px" }}>{r.makleriCount}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: "13px" }}>{r.naberyCount}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: "13px", fontWeight: 600 }}>{r.obchodovCount}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: "13px", fontWeight: 700, color: "var(--accent)" }}>{r.obrat ? fmtEur(r.obrat) : "—"}</td>
                    {(userRole === "super_admin" || userRole === "majitel") && <td style={{ padding: "12px 14px", textAlign: "right", fontSize: "13px", color: "var(--success)" }}>{r.provizia ? fmtEur(r.provizia) : "—"}</td>}
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      {canDrill && <button onClick={() => setDrillPobocka(r.id)} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "6px", padding: "4px 10px", fontSize: "12px", cursor: "pointer", color: "var(--text-primary)" }}>Detail →</button>}
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

/* ─────────────────────────── Tab: MAKLÉRI ─────────────────────────── */
function TabMakleri({ nehnutelnosti, klienti, users, pobocky, period, onPeriodChange, currentUser }: {
  nehnutelnosti: Nehnutelnost[]; klienti: Klient[]; users: User[]; pobocky: Pobocka[];
  period: Period; onPeriodChange: (p: Period) => void; currentUser: { id: string; role: string; pobocka_id?: string | null };
}) {
  const from = periodStart(period);
  const isMakler = currentUser.role === "makler";
  const isManazer = currentUser.role === "manazer";

  const visibleUsers = useMemo(() => {
    if (isMakler) return users.filter(u => u.id === currentUser.id);
    if (isManazer) return users.filter(u => u.pobocka_id === currentUser.pobocka_id);
    return users;
  }, [users, currentUser, isMakler, isManazer]);

  const [selectedId, setSelectedId] = useState<string>(() => isMakler ? currentUser.id : "");

  const selected = selectedId ? visibleUsers.find(u => u.id === selectedId) : null;

  const statForUser = (u: User) => {
    const uDeals = nehnutelnosti.filter(n => isDeal(n) && inPeriod(n, from) && n.makler_id === u.id);
    const uNabery = klienti.filter(k => new Date(k.created_at) >= from && k.makler_id === u.id);
    const uAllKlienti = klienti.filter(k => k.makler_id === u.id);
    const obrat = uDeals.reduce((s, n) => s + (n.cena ?? 0), 0);
    const provizia = uDeals.reduce((s, n) => s + (n.provizia_hodnota ?? (n.cena ?? 0) * 0.03), 0);
    return { nabery: uNabery.length, obchody: uDeals.length, obrat, provizia, klientiCelkom: uAllKlienti.length, konverzia: uAllKlienti.length > 0 ? Math.round((uDeals.length / uAllKlienti.length) * 100) : 0 };
  };

  const teamAvg = useMemo(() => {
    if (visibleUsers.length === 0) return { nabery: 0, obchody: 0, obrat: 0 };
    const stats = visibleUsers.map(statForUser);
    return {
      nabery: Math.round(stats.reduce((s, x) => s + x.nabery, 0) / stats.length),
      obchody: Math.round(stats.reduce((s, x) => s + x.obchody, 0) / stats.length),
      obrat: stats.reduce((s, x) => s + x.obrat, 0) / stats.length,
    };
  }, [visibleUsers, nehnutelnosti, klienti, from]);

  const selStat = selected ? statForUser(selected) : null;
  const pobocka = selected ? pobocky.find(p => p.id === selected.pobocka_id) : null;

  const uMonths: { label: string; key: string; nabery: number; obchody: number }[] = [];
  if (selected) {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("sk", { month: "short" });
      uMonths.push({
        label, key,
        nabery: klienti.filter(k => k.makler_id === selected.id && k.created_at.startsWith(key)).length,
        obchody: nehnutelnosti.filter(n => isDeal(n) && n.makler_id === selected.id && (n.updated_at ?? n.created_at).startsWith(key)).length,
      });
    }
  }
  const maxMonth = Math.max(...uMonths.map(m => Math.max(m.nabery, m.obchody)), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {!isMakler && (
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "13px" }}>
              <option value="">— Vyber makléra —</option>
              {visibleUsers.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
          )}
          {!selectedId && !isMakler && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Vyber makléra pre detail</span>}
        </div>
        <PeriodSwitch value={period} onChange={onPeriodChange} />
      </div>

      {selStat && selected ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 800, color: "#fff" }}>{avatarInitials(selected.name || selected.email)}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "16px" }}>{selected.name || selected.email}</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{pobocka?.nazov ?? "—"} · {selected.role}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
            <KpiCard label="Nábery" value={selStat.nabery} sub={`Priem. tímu: ${teamAvg.nabery}`} color={selStat.nabery >= teamAvg.nabery ? "var(--success)" : "var(--warning)"} />
            <KpiCard label="Obchody" value={selStat.obchody} sub={`Priem. tímu: ${teamAvg.obchody}`} color={selStat.obchody >= teamAvg.obchody ? "var(--success)" : "var(--warning)"} />
            <KpiCard label="Obrat" value={selStat.obrat ? fmtEur(selStat.obrat) : "—"} sub={`Prov. ~${fmtEur(selStat.provizia)}`} color="var(--accent)" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <KpiCard label="Klienti celkom" value={selStat.klientiCelkom} />
            <KpiCard label="Konverzia klient → obchod" value={selStat.konverzia + " %"} color={selStat.konverzia >= 30 ? "var(--success)" : undefined} />
          </div>

          {uMonths.length > 0 && (
            <div style={S.card}>
              <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "14px" }}>Trend makléra (6 mesiacov)</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: "80px" }}>
                {uMonths.map(m => (
                  <div key={m.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}>
                    <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", gap: "2px" }}>
                      <div style={{ flex: 1, background: "var(--accent)", opacity: 0.7, borderRadius: "3px 3px 0 0", height: `${Math.max((m.nabery / maxMonth) * 100, m.nabery > 0 ? 8 : 0)}%` }} title={`${m.nabery} náberov`} />
                      <div style={{ flex: 1, background: "var(--success)", borderRadius: "3px 3px 0 0", height: `${Math.max((m.obchody / maxMonth) * 100, m.obchody > 0 ? 8 : 0)}%` }} title={`${m.obchody} obchodov`} />
                    </div>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", marginTop: "3px" }}>{m.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "10px", color: "var(--text-muted)" }}><div style={{ width: "10px", height: "10px", borderRadius: "2px", background: "var(--accent)", opacity: 0.7 }} /> Nábery</div>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "10px", color: "var(--text-muted)" }}><div style={{ width: "10px", height: "10px", borderRadius: "2px", background: "var(--success)" }} /> Obchody</div>
              </div>
            </div>
          )}
        </div>
      ) : !isMakler ? (
        <div style={{ ...S.card, textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
          Vyber makléra zo zoznamu pre zobrazenie detailu.
        </div>
      ) : null}
    </div>
  );
}

/* ─────────────────────────── Tab: SÚŤAŽ ─────────────────────────── */
const MEDAL_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];
const MEDAL_EMOJI = ["🥇", "🥈", "🥉"];

function TabSutaz({ nehnutelnosti, klienti, users, pobocky, period, onPeriodChange, currentUser }: {
  nehnutelnosti: Nehnutelnost[]; klienti: Klient[]; users: User[]; pobocky: Pobocka[];
  period: Period; onPeriodChange: (p: Period) => void;
  currentUser: { id: string; role: string };
}) {
  const from = periodStart(period);
  const prevFrom = prevPeriodStart(period);

  const rows = useMemo(() => {
    return users.map(u => {
      const uDeals = nehnutelnosti.filter(n => isDeal(n) && inPeriod(n, from) && n.makler_id === u.id);
      const uPrevDeals = nehnutelnosti.filter(n => isDeal(n) && dealDate(n) >= prevFrom && dealDate(n) < from && n.makler_id === u.id);
      const obrat = uDeals.reduce((s, n) => s + (n.cena ?? 0), 0);
      const prevObrat = uPrevDeals.reduce((s, n) => s + (n.cena ?? 0), 0);
      const provizia = uDeals.length > 0 ? uDeals.reduce((s, n) => s + (n.provizia_hodnota ?? (n.cena ?? 0) * 0.03), 0) / uDeals.length : 0;
      const nabery = klienti.filter(k => new Date(k.created_at) >= from && k.makler_id === u.id).length;
      const zmena = prevObrat > 0 ? Math.round(((obrat - prevObrat) / prevObrat) * 100) : null;
      return { user: u, obrat, provizia, obchodov: uDeals.length, nabery, zmena };
    }).sort((a, b) => b.obrat - a.obrat);
  }, [users, nehnutelnosti, klienti, from, prevFrom]);

  // Badges
  const badges = useMemo(() => {
    const maklarMesiaca = rows[0];
    const najvacsiObchod = (() => {
      let best: Nehnutelnost | null = null;
      for (const n of nehnutelnosti.filter(x => isDeal(x) && inPeriod(x, from))) {
        if (!best || (n.provizia_hodnota ?? 0) > (best.provizia_hodnota ?? 0)) best = n;
      }
      return best ? users.find(u => u.id === best!.makler_id) : null;
    })();
    const najvacsiNaber = [...rows].sort((a, b) => b.nabery - a.nabery)[0];
    const najvacsiSkok = rows.filter(r => r.zmena !== null).sort((a, b) => (b.zmena ?? 0) - (a.zmena ?? 0))[0];
    return { maklarMesiaca, najvacsiObchod, najvacsiNaber, najvacsiSkok };
  }, [rows, nehnutelnosti, users, from]);

  const pobockaName = (u: User) => pobocky.find(p => p.id === u.pobocka_id)?.nazov ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Rebríček maklérov — celofiremný</div>
        <PeriodSwitch value={period} onChange={onPeriodChange} />
      </div>

      {/* Badges */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
        {[
          { icon: "🏆", title: `Maklér ${period === "month" ? "mesiaca" : period === "quarter" ? "kvartálu" : "roka"}`, who: badges.maklarMesiaca?.user },
          { icon: "💰", title: "Najväčší obchod", who: badges.najvacsiObchod },
          { icon: "📈", title: "Najviac náberov", who: badges.najvacsiNaber?.user },
          { icon: "🚀", title: "Najväčší skok", who: badges.najvacsiSkok?.user, sub: badges.najvacsiSkok?.zmena != null ? `+${badges.najvacsiSkok.zmena} %` : undefined },
        ].map(b => (
          <div key={b.title} style={{ ...S.card, textAlign: "center", padding: "14px 12px" }}>
            <div style={{ fontSize: "22px", marginBottom: "4px" }}>{b.icon}</div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{b.title}</div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>{b.who ? (b.who.name || b.who.email).split(" ")[0] : "—"}</div>
            {b.sub && <div style={{ fontSize: "11px", color: "var(--success)", marginTop: "2px" }}>{b.sub}</div>}
          </div>
        ))}
      </div>

      {/* Leaderboard table */}
      <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textAlign: "center", width: "44px" }}>#</th>
              <th style={{ padding: "10px 12px", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textAlign: "left" }}>Maklér</th>
              <th style={{ padding: "10px 12px", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textAlign: "right" }}>Obrat</th>
              <th style={{ padding: "10px 12px", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textAlign: "right" }}>Priem. prov. firmy</th>
              <th style={{ padding: "10px 12px", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textAlign: "right" }}>Obchody</th>
              <th style={{ padding: "10px 12px", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textAlign: "right" }}>Zmena</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isMe = r.user.id === currentUser.id;
              const top3 = i < 3 && r.obrat > 0;
              return (
                <tr key={r.user.id} style={{
                  borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none",
                  background: isMe ? "var(--accent)18" : top3 ? MEDAL_COLORS[i] + "08" : "transparent",
                }}>
                  <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: 800, fontSize: top3 ? "16px" : "13px", color: top3 ? MEDAL_COLORS[i] : "var(--text-muted)" }}>
                    {top3 && r.obrat > 0 ? MEDAL_EMOJI[i] : i + 1}
                  </td>
                  <td style={{ padding: "12px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: top3 ? MEDAL_COLORS[i] + "40" : "var(--bg-elevated)", border: `2px solid ${top3 ? MEDAL_COLORS[i] : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, flexShrink: 0 }}>
                        {avatarInitials(r.user.name || r.user.email)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                          {r.user.name || r.user.email}
                          {isMe && <span style={S.tag("var(--accent)")}>Ty</span>}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{pobockaName(r.user)}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 12px", textAlign: "right", fontWeight: 700, fontSize: "13px", color: r.obrat > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
                    {r.obrat > 0 ? fmtEur(r.obrat) : "—"}
                  </td>
                  <td style={{ padding: "12px 12px", textAlign: "right", fontSize: "13px", color: r.provizia > 0 ? "var(--success)" : "var(--text-muted)" }}>
                    {r.provizia > 0 ? fmtEur(r.provizia) : "—"}
                  </td>
                  <td style={{ padding: "12px 12px", textAlign: "right", fontSize: "13px", fontWeight: 600 }}>
                    {r.obchodov > 0 ? r.obchodov : "—"}
                  </td>
                  <td style={{ padding: "12px 12px", textAlign: "right", fontSize: "12px", fontWeight: 600, color: r.zmena == null ? "var(--text-muted)" : r.zmena > 0 ? "var(--success)" : r.zmena < 0 ? "#ef4444" : "var(--text-muted)" }}>
                    {r.zmena == null ? "—" : r.zmena > 0 ? `↑ +${r.zmena} %` : r.zmena < 0 ? `↓ ${r.zmena} %` : "→ 0 %"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────── Hlavná stránka ─────────────────────────── */
const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "celkove", label: "Celkové", icon: "📊" },
  { key: "pobocky", label: "Pobočky", icon: "🏢" },
  { key: "makleri", label: "Makléri", icon: "👤" },
  { key: "sutaz", label: "Súťaž", icon: "🏆" },
];

function StatistikyInner() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const rawTab = sp.get("tab") as TabKey | null;
  const tab: TabKey = TABS.find(t => t.key === rawTab)?.key ?? "celkove";

  const role = user?.role ?? "makler";
  const isMakler = role === "makler";
  const isManazer = role === "manazer";
  const isElevated = role === "super_admin" || role === "majitel";

  // Default period: Súťaž → rok, ostatné → mesiac
  const [period, setPeriod] = useState<Period>(tab === "sutaz" ? "year" : "month");

  // Pri zmene tabu reset period
  function goTab(k: TabKey) {
    setPeriod(k === "sutaz" ? "year" : "month");
    router.push(`${pathname}?tab=${k}`);
  }

  // Data
  const [loading, setLoading] = useState(true);
  const [nehnutelnosti, setNehnutelnosti] = useState<Nehnutelnost[]>([]);
  const [klienti, setKlienti] = useState<Klient[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [pobocky, setPobocky] = useState<Pobocka[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/nehnutelnosti").then(r => r.json()),
      fetch("/api/klienti").then(r => r.json()),
      fetch("/api/users").then(r => r.json()),
      fetch("/api/pobocky").then(r => r.json()),
    ]).then(([nh, kl, us, po]) => {
      setNehnutelnosti((nh ?? []) as Nehnutelnost[]);
      setKlienti((kl ?? []) as Klient[]);
      setUsers(((us.users ?? us) ?? []) as User[]);
      setPobocky((po ?? []) as Pobocka[]);
      setLoading(false);
    });
  }, []);

  // RBAC: skryté taby
  const visibleTabs = TABS.filter(t => {
    if (t.key === "celkove" && isMakler) return false;
    if (t.key === "pobocky" && isMakler) return false;
    return true;
  });

  // Ensure tab is visible
  const activeTab: TabKey = visibleTabs.find(t => t.key === tab)?.key ?? visibleTabs[0]?.key ?? "sutaz";

  const currentUser = { id: user?.id ?? "", role, pobocka_id: (user as unknown as User)?.pobocka_id ?? null };

  return (
    <div style={{ maxWidth: "1100px" }}>
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 4px", color: "var(--text-primary)" }}>Štatistiky</h2>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>Výkon firmy, pobočiek a maklérov</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "24px", borderBottom: "1px solid var(--border)" }}>
        {visibleTabs.map(t => {
          const active = t.key === activeTab;
          return (
            <button key={t.key} onClick={() => goTab(t.key)} style={{
              padding: "10px 18px", borderRadius: "10px 10px 0 0", border: "none",
              background: active ? "var(--bg-elevated)" : "transparent",
              color: active ? "var(--text-primary)" : "var(--text-muted)",
              fontSize: "13px", fontWeight: active ? 700 : 500, cursor: "pointer",
              borderBottom: active ? "2px solid var(--accent, #3B82F6)" : "2px solid transparent",
              transition: "all 0.15s",
            }}>
              <span style={{ marginRight: "6px" }}>{t.icon}</span>{t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)", fontSize: "14px" }}>Načítavam...</div>
      ) : (
        <>
          {activeTab === "celkove" && !isMakler && (
            <TabCelkove nehnutelnosti={nehnutelnosti} klienti={klienti} period={period} onPeriodChange={setPeriod} />
          )}
          {activeTab === "pobocky" && !isMakler && (
            <TabPobocky nehnutelnosti={nehnutelnosti} klienti={klienti} users={users} pobocky={pobocky} period={period} onPeriodChange={setPeriod} userRole={role} userPobockaId={currentUser.pobocka_id} />
          )}
          {activeTab === "makleri" && (
            <TabMakleri nehnutelnosti={nehnutelnosti} klienti={klienti} users={users} pobocky={pobocky} period={period} onPeriodChange={setPeriod} currentUser={currentUser} />
          )}
          {activeTab === "sutaz" && (
            <TabSutaz nehnutelnosti={nehnutelnosti} klienti={klienti} users={users} pobocky={pobocky} period={period} onPeriodChange={setPeriod} currentUser={currentUser} />
          )}
        </>
      )}
    </div>
  );
}

export default function StatistikyPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Načítavam...</div>}>
      <StatistikyInner />
    </Suspense>
  );
}
