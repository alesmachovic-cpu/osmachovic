"use client";
import { Suspense, useEffect, useState } from "react";
import type { Klient, Nehnutelnost } from "@/lib/database.types";
import { STATUS_LABELS } from "@/lib/database.types";

interface MarketSentiment {
  lokalita: string;
  typ: string;
  izby: number | null;
  active_count: number;
  median_eur_per_m2: number | null;
  median_dom: number | null;
  demand_index: number;
  price_change_30d_pct: number | null;
}

interface DisapRow {
  id: string;
  disappeared_on: string;
  estimated_sale_price: number | null;
  total_days_on_market: number;
  estimated_discount_pct: number | null;
  monitor_inzeraty: { lokalita: string | null; typ: string | null; izby: number | null; nazov: string | null } | null;
}

export default function AnalyzyPage() {
  return <Suspense fallback={<div style={{ padding: "40px" }}>Načítavam…</div>}><AnalyzyInner /></Suspense>;
}

function AnalyzyInner() {
  const [klienti, setKlienti] = useState<Klient[]>([]);
  const [nehnutelnosti, setNehnutelnosti] = useState<Nehnutelnost[]>([]);
  const [loading, setLoading] = useState(true);
  const [sentiments, setSentiments] = useState<MarketSentiment[]>([]);
  const [disappearances, setDisappearances] = useState<DisapRow[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/klienti").then(r => r.json()),
      fetch("/api/nehnutelnosti").then(r => r.json()),
      // Najnovšie sentiments — vyber najnovší dátum, posledných 50 segmentov
      fetch("/api/market-sentiments?limit=50").then(r => r.json()),
      // Posledných 20 detegovaných predajov
      fetch("/api/monitor/disappearances?limit=20").then(r => r.json()),
    ]).then(([k, n, s, d]) => {
      setKlienti(k ?? []);
      setNehnutelnosti(n ?? []);
      // Filter na najnovší dátum
      const all = (s ?? []) as Array<MarketSentiment & { sentiment_date: string }>;
      const latestDate = all[0]?.sentiment_date;
      setSentiments(latestDate ? all.filter(x => x.sentiment_date === latestDate) : []);
      setDisappearances((d ?? []) as unknown as DisapRow[]);
      setLoading(false);
    });
  }, []);

  const hotSegments = [...sentiments].sort((a, b) => b.demand_index - a.demand_index).slice(0, 5);
  const coldSegments = [...sentiments].sort((a, b) => a.demand_index - b.demand_index).slice(0, 5);

  // Stats
  const totalPotencialnaProviziaMin = nehnutelnosti.reduce((s, n) => s + (n.cena ?? 0) * 0.02, 0);
  const totalPotencialnaProviziaMax = nehnutelnosti.reduce((s, n) => s + (n.cena ?? 0) * 0.04, 0);
  const avgCena = nehnutelnosti.length ? nehnutelnosti.reduce((s, n) => s + (n.cena ?? 0), 0) / nehnutelnosti.length : 0;

  // Status distribution
  const statusDist = klienti.reduce((acc, k) => {
    acc[k.status] = (acc[k.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Typ distribution
  const typNehDist = nehnutelnosti.reduce((acc, n) => {
    acc[n.typ] = (acc[n.typ] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const typKliDist = klienti.reduce((acc, k) => {
    if (k.typ) acc[k.typ] = (acc[k.typ] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // This month
  const thisMonth = new Date();
  const klientiThisMonth = klienti.filter(k => {
    const d = new Date(k.created_at);
    return d.getMonth() === thisMonth.getMonth() && d.getFullYear() === thisMonth.getFullYear();
  }).length;

  function Bar({ val, max, color }: { val: number; max: number; color: string }) {
    return (
      <div style={{ height: "8px", background: "var(--border)", borderRadius: "4px", flex: 1 }}>
        <div style={{ width: `${max ? (val / max) * 100 : 0}%`, height: "100%", background: color, borderRadius: "4px" }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1000px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 4px", color: "var(--text-primary)" }}>Analýzy & Report</h2>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>Manažérsky prehľad portfólia</p>
      </div>

      {loading ? <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Načítavam...</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Top stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
            {[
              { label: "Klienti celkom", value: klienti.length, icon: "👥", color: "var(--success)" },
              { label: "Tento mesiac", value: klientiThisMonth, icon: "📅", color: "var(--accent)" },
              { label: "Nehnuteľnosti", value: nehnutelnosti.length, icon: "🏠", color: "var(--warning)" },
              { label: "Priemerná cena", value: avgCena ? `${Math.round(avgCena / 1000)}k €` : "—", icon: "💰", color: "var(--purple)" },
            ].map(s => (
              <div key={s.label} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 18px", borderTop: `3px solid ${s.color}` }}>
                <div style={{ fontSize: "18px", marginBottom: "6px" }}>{s.icon}</div>
                <div style={{ fontSize: "24px", fontWeight: "800", color: s.color }}>{s.value}</div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "3px" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Pipeline */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", borderLeft: "4px solid var(--success)" }}>
            <div style={{ fontWeight: "700", fontSize: "15px", color: "var(--text-primary)", marginBottom: "12px" }}>💰 Pipeline — Potenciálny zisk</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Celková hodnota portfólia</div>
                <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-primary)" }}>
                  {nehnutelnosti.reduce((s, n) => s + (n.cena ?? 0), 0).toLocaleString("sk")} €
                </div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Min. provízia (2%)</div>
                <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--warning)" }}>
                  {Math.round(totalPotencialnaProviziaMin).toLocaleString("sk")} €
                </div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Max. provízia (4%)</div>
                <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--success)" }}>
                  {Math.round(totalPotencialnaProviziaMax).toLocaleString("sk")} €
                </div>
              </div>
            </div>
          </div>

          {/* Market intelligence — hot/cold segments + recent sales (Etapa C) */}
          {(hotSegments.length > 0 || disappearances.length > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              {hotSegments.length > 0 && (
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", borderLeft: "4px solid #dc2626" }}>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)", marginBottom: "12px" }}>
                    🔥 Najhorúcejšie segmenty
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {hotSegments.map((s, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 12px", borderRadius: "8px",
                        background: "var(--bg-elevated)",
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                            {s.lokalita}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                            {s.typ}{s.izby != null ? ` · ${s.izby} izb.` : ""} · {s.active_count} ponúk
                            {s.median_eur_per_m2 ? ` · ${Math.round(s.median_eur_per_m2).toLocaleString("sk")} €/m²` : ""}
                          </div>
                        </div>
                        <div style={{
                          padding: "6px 12px", borderRadius: "8px",
                          background: "#fee2e2", color: "#991b1b",
                          fontSize: "13px", fontWeight: 800,
                        }}>{s.demand_index}/10</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {coldSegments.length > 0 && (
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", borderLeft: "4px solid #3b82f6" }}>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)", marginBottom: "12px" }}>
                    ❄️ Pomalé segmenty
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {coldSegments.map((s, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 12px", borderRadius: "8px",
                        background: "var(--bg-elevated)",
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                            {s.lokalita}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                            {s.typ}{s.izby != null ? ` · ${s.izby} izb.` : ""} · {s.active_count} ponúk
                            {s.median_dom != null ? ` · ${s.median_dom} dní na trhu` : ""}
                          </div>
                        </div>
                        <div style={{
                          padding: "6px 12px", borderRadius: "8px",
                          background: "#dbeafe", color: "#1e40af",
                          fontSize: "13px", fontWeight: 800,
                        }}>{s.demand_index}/10</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cenová heatmap per district — z najnovších market_sentiments */}
          {sentiments.length > 0 && (() => {
            // Group sentimenty by lokalita (district = first word, napr. "Bratislava-Petržalka" → "Bratislava-Petržalka")
            const byDistrict = new Map<string, { lokalita: string; segments: number; medians: number[]; demands: number[] }>();
            for (const s of sentiments) {
              if (!s.median_eur_per_m2) continue;
              const key = s.lokalita.replace(/^Reality\s+/i, "");
              if (!byDistrict.has(key)) byDistrict.set(key, { lokalita: key, segments: 0, medians: [], demands: [] });
              const d = byDistrict.get(key)!;
              d.segments++;
              d.medians.push(Number(s.median_eur_per_m2));
              d.demands.push(Number(s.demand_index));
            }
            const districts = Array.from(byDistrict.values()).map(d => ({
              lokalita: d.lokalita,
              segments: d.segments,
              avg_eur_per_m2: Math.round(d.medians.reduce((s, x) => s + x, 0) / d.medians.length),
              avg_demand: Math.round((d.demands.reduce((s, x) => s + x, 0) / d.demands.length) * 10) / 10,
            }));
            if (districts.length === 0) return null;
            const maxPrice = Math.max(...districts.map(d => d.avg_eur_per_m2));
            const minPrice = Math.min(...districts.map(d => d.avg_eur_per_m2));
            const priceRange = maxPrice - minPrice || 1;
            return (
              <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", borderLeft: "4px solid #7c3aed" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>
                    🗺 Cenová heatmap (per lokalita)
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {districts.length} lokalít · {minPrice.toLocaleString("sk")} – {maxPrice.toLocaleString("sk")} €/m²
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {districts.sort((a, b) => b.avg_eur_per_m2 - a.avg_eur_per_m2).map((d) => {
                    const ratio = (d.avg_eur_per_m2 - minPrice) / priceRange;
                    // Gradient: zelené (lacné) → žlté → červené (drahé)
                    const hue = (1 - ratio) * 120; // 120 = zelená, 0 = červená
                    const bg = `hsl(${hue}, 70%, 92%)`;
                    const txt = `hsl(${hue}, 60%, 30%)`;
                    return (
                      <div key={d.lokalita} style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "8px 12px", borderRadius: "8px", background: bg,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: txt }}>{d.lokalita}</div>
                          <div style={{ fontSize: "11px", color: txt, opacity: 0.75 }}>
                            {d.segments} segmentov · demand {d.avg_demand}/10
                          </div>
                        </div>
                        <div style={{ fontSize: "14px", fontWeight: 800, color: txt }}>
                          {d.avg_eur_per_m2.toLocaleString("sk")} €/m²
                        </div>
                        {/* Mini progress bar */}
                        <div style={{
                          width: "60px", height: "6px", borderRadius: "3px",
                          background: "rgba(0,0,0,0.08)", overflow: "hidden",
                        }}>
                          <div style={{
                            width: `${ratio * 100}%`, height: "100%",
                            background: txt, opacity: 0.7,
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Recently detected sales — implicitne predané inzeráty z monitoringu */}
          {disappearances.length > 0 && (
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", borderLeft: "4px solid #16a34a" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>
                  ✅ Detegované predaje (z monitoringu)
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  Posledných {disappearances.length} · odhad realizačnej ceny
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {disappearances.slice(0, 8).map((d) => (
                  <div key={d.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 12px", borderRadius: "8px", background: "var(--bg-elevated)",
                    fontSize: "12px",
                  }}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: "10px" }}>
                      <div style={{ color: "var(--text-primary)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {d.monitor_inzeraty?.lokalita || "—"} · {d.monitor_inzeraty?.typ || "—"}
                        {d.monitor_inzeraty?.izby != null ? ` · ${d.monitor_inzeraty.izby} izb.` : ""}
                      </div>
                      <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "1px" }}>
                        {new Date(d.disappeared_on).toLocaleDateString("sk")} · {d.total_days_on_market} dní na trhu
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#15803d", fontWeight: 700 }}>
                        {d.estimated_sale_price != null ? `${Math.round(d.estimated_sale_price).toLocaleString("sk")} €` : "—"}
                      </div>
                      <div style={{ color: "var(--text-muted)", fontSize: "10px" }}>
                        {d.estimated_discount_pct != null ? `−${d.estimated_discount_pct}% od pôvodnej` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            {/* Klienti by status */}
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
              <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text-primary)", marginBottom: "14px" }}>Klienti podľa statusu</div>
              {klienti.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Žiadni klienti</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {Object.entries(statusDist).map(([status, count]) => (
                    <div key={status} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", minWidth: "140px" }}>{STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}</div>
                      <Bar val={count} max={klienti.length} color="var(--accent)" />
                      <div style={{ fontSize: "12.5px", fontWeight: "600", color: "var(--text-primary)", minWidth: "30px", textAlign: "right" }}>{count}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Nehnuteľnosti by typ */}
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
              <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text-primary)", marginBottom: "14px" }}>Portfólio podľa typu</div>
              {nehnutelnosti.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Žiadne nehnuteľnosti</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {Object.entries(typNehDist).map(([typ, count]) => (
                    <div key={typ} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", minWidth: "80px", textTransform: "capitalize" }}>{typ}</div>
                      <Bar val={count} max={nehnutelnosti.length} color="var(--success)" />
                      <div style={{ fontSize: "12.5px", fontWeight: "600", color: "var(--text-primary)", minWidth: "30px", textAlign: "right" }}>{count}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Nehnuteľnosti table */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", fontWeight: "700", fontSize: "14px", color: "var(--text-primary)" }}>
              Top nehnuteľnosti v portfóliu
            </div>
            {nehnutelnosti.slice(0, 5).map((n, i) => (
              <div key={n.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr", padding: "12px 20px", borderBottom: i < 4 ? "1px solid var(--border-subtle)" : "none", alignItems: "center", fontSize: "13.5px" }}>
                <div>
                  <div style={{ fontWeight: "600", color: "var(--text-primary)" }}>{n.nazov}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{n.lokalita}</div>
                </div>
                <div style={{ fontWeight: "700", color: "var(--accent)" }}>{n.cena != null ? `${n.cena.toLocaleString("sk")} €` : "—"}</div>
                <div style={{ color: "var(--text-secondary)", textTransform: "capitalize" }}>{n.typ}</div>
                <div style={{ color: "var(--success)", fontSize: "12.5px" }}>
                  +{n.cena != null ? Math.round(n.cena * 0.03).toLocaleString("sk") : "—"} € (3%)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
