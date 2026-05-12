"use client";

import { useState, useEffect } from "react";

type MotivatedSeller = {
  signal_type: string;
  severity: string;
  detected_at: string;
  evidence: string;
  monitor_inzeraty: {
    id: string;
    nazov: string;
    lokalita: string;
    typ: string;
    izby: number;
    cena: number;
    plocha: number;
    url: string;
    first_seen_at: string;
    predajca_typ: string;
  } | null;
};

type AnalyzaData = {
  total_active: number;
  new_this_week: number;
  by_portal: Record<string, number>;
  by_typ: Record<string, number>;
  predajcovia: { sukromni: number; realitky: number; ostatni: number };
  motivated_sellers: MotivatedSeller[];
  sales_stats: {
    avg_dom: number | null;
    avg_discount: number | null;
    avg_sale_price: number | null;
    sample_size: number;
  };
};

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderRadius: "12px",
      padding: "16px 20px",
      minWidth: 0,
    }}>
      <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontSize: "26px", fontWeight: "700", color: "var(--text-primary)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>{sub}</div>}
    </div>
  );
}

function HBar({ label, value, max, color = "#2563eb" }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
        <span style={{ color: "var(--text-primary)" }}>{label}</span>
        <span style={{ color: "var(--text-muted)", fontWeight: "600" }}>{value}</span>
      </div>
      <div style={{ height: "8px", background: "var(--bg-elevated)", borderRadius: "4px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "4px", transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

const SIGNAL_LABELS: Record<string, string> = {
  PRICE_DROP_SIGNIFICANT: "Výrazné zníženie ceny",
  PRICE_DROP_MODERATE: "Mierné zníženie ceny",
  LONG_ON_MARKET: "Dlho na trhu",
  PRICE_DROP_MULTIPLE: "Opakované zníženia",
  RE_LISTED: "Znovu inzerovaný",
};

function fmtCena(c: number | null | undefined) {
  if (!c) return "—";
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(c);
}

function AnalyzyInner() {
  const [data, setData] = useState<AnalyzaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/monitor/analyza")
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Načítavam trhové dáta...</div>
  );

  if (error || !data) return (
    <div style={{ padding: "40px", textAlign: "center", color: "#ef4444" }}>Chyba: {error ?? "Žiadne dáta"}</div>
  );

  const portalMax = Math.max(...Object.values(data.by_portal), 1);
  const typMax = Math.max(...Object.values(data.by_typ), 1);
  const totalPredajcovia = data.predajcovia.sukromni + data.predajcovia.realitky + data.predajcovia.ostatni;

  const portalColors: Record<string, string> = {
    nehnutelnosti: "#2563eb",
    reality: "#7c3aed",
    bazos: "#d97706",
    topreality: "#059669",
    sreality: "#dc2626",
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 0 60px" }}>
      <div style={{ marginBottom: "28px" }}>
        <div style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)" }}>Analýza trhu</div>
        <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>Aktívne inzeráty na trhu — nie vlastné portfólio</div>
      </div>

      {/* KPI tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "28px" }}>
        <Stat label="Aktívnych inzerátov" value={data.total_active.toLocaleString("sk-SK")} />
        <Stat label="Nových tento týždeň" value={data.new_this_week} />
        <Stat label="Motivovaných predajcov" value={data.motivated_sellers.length} sub="HIGH signál" />
        <Stat
          label="Priem. čas predaja"
          value={data.sales_stats.avg_dom ? `${data.sales_stats.avg_dom} dní` : "—"}
          sub={data.sales_stats.sample_size ? `${data.sales_stats.sample_size} predajov` : undefined}
        />
        <Stat
          label="Priem. zľava"
          value={data.sales_stats.avg_discount != null ? `${data.sales_stats.avg_discount}%` : "—"}
          sub="od vyvolávacej ceny"
        />
        <Stat
          label="Priem. predajná cena"
          value={fmtCena(data.sales_stats.avg_sale_price)}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
        {/* Portály */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
          <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "16px" }}>Rozloženie podľa portálu</div>
          {Object.entries(data.by_portal).sort((a, b) => b[1] - a[1]).map(([portal, count]) => (
            <HBar key={portal} label={portal} value={count} max={portalMax} color={portalColors[portal.toLowerCase()] ?? "#6b7280"} />
          ))}
        </div>

        {/* Typy */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
          <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "16px" }}>Rozloženie podľa typu</div>
          {Object.entries(data.by_typ).sort((a, b) => b[1] - a[1]).map(([typ, count]) => (
            <HBar key={typ} label={typ} value={count} max={typMax} color="#059669" />
          ))}
        </div>
      </div>

      {/* Kto predáva */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
        <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "16px" }}>Kto predáva</div>
        <div style={{ display: "flex", gap: "8px", height: "28px", borderRadius: "8px", overflow: "hidden", marginBottom: "12px" }}>
          {totalPredajcovia > 0 && <>
            <div style={{ flex: data.predajcovia.realitky, background: "#2563eb", minWidth: data.predajcovia.realitky ? "2px" : 0 }} title={`Realitky: ${data.predajcovia.realitky}`} />
            <div style={{ flex: data.predajcovia.sukromni, background: "#7c3aed", minWidth: data.predajcovia.sukromni ? "2px" : 0 }} title={`Súkromní: ${data.predajcovia.sukromni}`} />
            <div style={{ flex: data.predajcovia.ostatni, background: "#d1d5db", minWidth: data.predajcovia.ostatni ? "2px" : 0 }} title={`Ostatní: ${data.predajcovia.ostatni}`} />
          </>}
        </div>
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
          {[
            { label: "Realitné kancelárie", count: data.predajcovia.realitky, color: "#2563eb" },
            { label: "Súkromní predajcovia", count: data.predajcovia.sukromni, color: "#7c3aed" },
            { label: "Ostatní", count: data.predajcovia.ostatni, color: "#9ca3af" },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: item.color, flexShrink: 0 }} />
              <span style={{ color: "var(--text-muted)" }}>{item.label}:</span>
              <span style={{ fontWeight: "600", color: "var(--text-primary)" }}>
                {item.count}
                {totalPredajcovia > 0 && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> ({Math.round(item.count / totalPredajcovia * 100)}%)</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Motivovaní predajcovia */}
      {data.motivated_sellers.length > 0 && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
          <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>
            Motivovaní predajcovia
            <span style={{ marginLeft: "8px", background: "#fef3c7", color: "#92400e", borderRadius: "10px", padding: "2px 8px", fontSize: "11px", fontWeight: "700" }}>
              {data.motivated_sellers.length}
            </span>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>Inzeráty s HIGH motivačným signálom — možní potenciálni klienti</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {data.motivated_sellers.slice(0, 10).map((s, i) => {
              const inn = s.monitor_inzeraty;
              if (!inn) return null;
              return (
                <div key={i} style={{
                  display: "flex", gap: "12px", alignItems: "flex-start",
                  padding: "12px", background: "var(--bg-elevated)", borderRadius: "8px",
                }}>
                  <div style={{ flexShrink: 0, marginTop: "2px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {inn.nazov || `${inn.typ} ${inn.izby ? inn.izby + "i" : ""}, ${inn.lokalita}`}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                      {SIGNAL_LABELS[s.signal_type] ?? s.signal_type}
                      {inn.cena ? ` · ${fmtCena(inn.cena)}` : ""}
                      {inn.plocha ? ` · ${inn.plocha} m²` : ""}
                    </div>
                    {s.evidence && (
                      <div style={{ fontSize: "11px", color: "#d97706", marginTop: "3px" }}>{s.evidence}</div>
                    )}
                  </div>
                  {inn.url && (
                    <a href={inn.url} target="_blank" rel="noopener noreferrer" style={{
                      fontSize: "11px", color: "#2563eb", textDecoration: "none", flexShrink: 0, padding: "2px 8px",
                      background: "#eff6ff", borderRadius: "6px",
                    }}>
                      Otvoriť
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalyzyPage() {
  return (
    <div style={{ padding: "24px 20px" }}>
      <AnalyzyInner />
    </div>
  );
}
