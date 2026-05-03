"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Klient, Nehnutelnost } from "@/lib/database.types";
import { STATUS_LABELS } from "@/lib/database.types";
import UrlAnalyzeModal from "@/components/UrlAnalyzeModal";
import PricingEstimateModal from "@/components/PricingEstimateModal";
import PropertyStoryModal from "@/components/PropertyStoryModal";
import { useAuth } from "@/components/AuthProvider";

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
  const { user } = useAuth();
  const search = useSearchParams();
  const [pricingModal, setPricingModal] = useState(false);
  const [storyModal, setStoryModal] = useState(false);
  const [klienti, setKlienti] = useState<Klient[]>([]);
  const [nehnutelnosti, setNehnutelnosti] = useState<Nehnutelnost[]>([]);
  const [loading, setLoading] = useState(true);
  const [urlInput, setUrlInput] = useState("");
  const [urlModal, setUrlModal] = useState(false);
  const [sentiments, setSentiments] = useState<MarketSentiment[]>([]);
  const [disappearances, setDisappearances] = useState<DisapRow[]>([]);

  // Auto-open URL analyzer ak prišiel cez ?analyze=URL (z monitora)
  useEffect(() => {
    const u = search?.get("analyze");
    if (u && /^https?:\/\//i.test(u)) {
      setUrlInput(u);
      setUrlModal(true);
    }
  }, [search]);

  useEffect(() => {
    Promise.all([
      supabase.from("klienti").select("*").order("created_at", { ascending: false }),
      supabase.from("nehnutelnosti").select("*").order("created_at", { ascending: false }),
      // Najnovšie sentiments — vyber najnovší dátum, posledných 50 segmentov
      supabase.from("market_sentiments")
        .select("lokalita, typ, izby, active_count, median_eur_per_m2, median_dom, demand_index, price_change_30d_pct, sentiment_date")
        .order("sentiment_date", { ascending: false })
        .order("demand_index", { ascending: false })
        .limit(50),
      // Posledných 20 detegovaných predajov
      supabase.from("monitor_inzeraty_disappearances")
        .select("id, disappeared_on, estimated_sale_price, total_days_on_market, estimated_discount_pct, monitor_inzeraty(lokalita, typ, izby, nazov)")
        .eq("classification", "likely_sold")
        .gte("confidence_score", 0.6)
        .order("disappeared_on", { ascending: false })
        .limit(20),
    ]).then(([{ data: k }, { data: n }, { data: s }, { data: d }]) => {
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

          {/* URL Analýza — vlož link z portálu, AI vytiahne dáta + spraví analýzu */}
          <div style={{
            background: "linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)",
            borderRadius: "16px", padding: "20px 24px", color: "#fff",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <span style={{ fontSize: "22px" }}>🔍</span>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 700 }}>Analýza nehnuteľnosti z URL</div>
                <div style={{ fontSize: "12px", opacity: 0.75, marginTop: "2px" }}>
                  Vlož link z nehnutelnosti.sk, reality.sk, bazos.sk, topreality.sk alebo z akéhokoľvek inzerátu
                </div>
              </div>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); if (urlInput.trim()) setUrlModal(true); }}
              style={{ display: "flex", gap: "8px", marginTop: "12px" }}
            >
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://www.nehnutelnosti.sk/..."
                style={{
                  flex: 1, padding: "11px 14px", borderRadius: "10px",
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  color: "#fff", fontSize: "13px", outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={!urlInput.trim() || !/^https?:\/\//i.test(urlInput.trim())}
                style={{
                  padding: "11px 22px", borderRadius: "10px",
                  background: "#fff", color: "#1e3a8a",
                  border: "none", fontSize: "13px", fontWeight: 700,
                  cursor: urlInput.trim() && /^https?:\/\//i.test(urlInput.trim()) ? "pointer" : "default",
                  opacity: urlInput.trim() && /^https?:\/\//i.test(urlInput.trim()) ? 1 : 0.5,
                }}
              >
                Analyzovať
              </button>
            </form>
          </div>

          {/* Cenová kalkulačka + AI Property Story (2 stĺpce) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{
              background: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
              borderRadius: "16px", padding: "20px 24px", color: "#fff",
              display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "12px",
            }}>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                  💰 Cenová kalkulačka
                </div>
                <div style={{ fontSize: "12px", opacity: 0.85, marginTop: "4px" }}>
                  3 stratégie (agresívna / trhová / aspirational) + DOM predikcia + CMA z reálnych predaných.
                </div>
              </div>
              <button onClick={() => setPricingModal(true)} style={{
                padding: "10px 18px", borderRadius: "10px",
                background: "#fff", color: "#064e3b",
                border: "none", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                alignSelf: "flex-start",
              }}>Otvoriť kalkulačku</button>
            </div>

            <div style={{
              background: "linear-gradient(135deg, #4338ca 0%, #6366f1 100%)",
              borderRadius: "16px", padding: "20px 24px", color: "#fff",
              display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "12px",
            }}>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                  ✨ AI popis pre inzerát
                </div>
                <div style={{ fontSize: "12px", opacity: 0.85, marginTop: "4px" }}>
                  Vyber nehnuteľnosť z portfólia — AI vygeneruje hook, lifestyle, investičnú logiku s číslami z monitora.
                </div>
              </div>
              <button onClick={() => setStoryModal(true)} disabled={nehnutelnosti.length === 0} style={{
                padding: "10px 18px", borderRadius: "10px",
                background: "#fff", color: "#4338ca",
                border: "none", fontSize: "13px", fontWeight: 700,
                cursor: nehnutelnosti.length === 0 ? "default" : "pointer",
                opacity: nehnutelnosti.length === 0 ? 0.5 : 1,
                alignSelf: "flex-start",
              }}>{nehnutelnosti.length === 0 ? "Žiadne nehnuteľnosti" : "Vygenerovať popis"}</button>
            </div>
          </div>

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

      {urlModal && (
        <UrlAnalyzeModal
          url={urlInput.trim()}
          onClose={() => setUrlModal(false)}
        />
      )}
      {pricingModal && (
        <PricingEstimateModal
          onClose={() => setPricingModal(false)}
          userId={user?.id}
        />
      )}
      {storyModal && (
        <PropertyStoryModal
          onClose={() => setStoryModal(false)}
          userId={user?.id}
          nehnutelnosti={nehnutelnosti.map(n => ({
            id: n.id,
            nazov: n.nazov,
            lokalita: n.lokalita,
            typ_nehnutelnosti: (n as { typ_nehnutelnosti?: string | null }).typ_nehnutelnosti ?? n.typ ?? null,
            plocha: n.plocha,
            izby: n.izby,
            cena: n.cena,
          }))}
        />
      )}
    </div>
  );
}
