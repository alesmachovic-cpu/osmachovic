"use client";

import { useState } from "react";

interface InitialParams {
  typ?: string;
  lokalita?: string;
  plocha?: number;
  izby?: number;
  stav?: string;
  features?: Record<string, boolean | string>;
  energy_class?: string;
  year_built?: number;
  owner_target_price?: number;
  klient_id?: string;
  nehnutelnost_id?: string;
}

interface Strategy {
  price: number;
  dom_days: number;
  label: string;
}

interface PricingResult {
  recommended_price: number;
  price_low: number;
  price_high: number;
  confidence_score: number;
  base_price_source: string;
  strategies: { aggressive: Strategy; market: Strategy; aspirational: Strategy };
  recommended_strategy: "aggressive" | "market" | "aspirational";
  rarity_score: number;
  cma: {
    active_count: number;
    sold_count: number;
    asking_median_per_m2: number;
    realized_median_per_m2: number;
    asking_to_realized_gap_pct: number | null;
    median_dom: number | null;
    sold_samples: Array<{ lokalita: string; estimated_sale_price: number; total_days_on_market: number; estimated_discount_pct: number | null }>;
  };
}

const STAV_OPTS = [
  { value: "novostavba", label: "Novostavba" },
  { value: "po_rekonstrukcii", label: "Po rekonštrukcii" },
  { value: "ciastocna_rekonstrukcia", label: "Čiast. rekonštrukcia" },
  { value: "povodny_stav", label: "Pôvodný stav" },
  { value: "na_rekonstrukciu", label: "Na rekonštrukciu" },
];

const eur = (n: number) => `${Math.round(n).toLocaleString("sk")} €`;

export default function PricingEstimateModal({ initialParams = {}, onClose, userId }: {
  initialParams?: InitialParams;
  onClose: () => void;
  userId?: string;
}) {
  const [typ, setTyp] = useState(initialParams.typ || "byt");
  const [lokalita, setLokalita] = useState(initialParams.lokalita || "");
  const [plocha, setPlocha] = useState<string>(initialParams.plocha?.toString() || "");
  const [izby, setIzby] = useState<string>(initialParams.izby?.toString() || "");
  const [stav, setStav] = useState(initialParams.stav || "povodny_stav");
  const [yearBuilt, setYearBuilt] = useState<string>(initialParams.year_built?.toString() || "");
  const [features, setFeatures] = useState<Record<string, boolean>>(
    initialParams.features
      ? Object.fromEntries(Object.entries(initialParams.features).map(([k, v]) => [k, !!v]))
      : { balkon: false, terasa: false, garaz: false, vytah: false, parking: false, zahrada: false }
  );
  const [ownerTarget, setOwnerTarget] = useState<string>(initialParams.owner_target_price?.toString() || "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PricingResult | null>(null);

  async function handleEstimate() {
    if (!lokalita.trim() || !plocha || Number(plocha) <= 0) {
      setError("Vyplň lokalitu a plochu");
      return;
    }
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/pricing/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          klient_id: initialParams.klient_id,
          nehnutelnost_id: initialParams.nehnutelnost_id,
          typ, lokalita: lokalita.trim(),
          plocha: Number(plocha),
          izby: izby ? Number(izby) : undefined,
          stav,
          year_built: yearBuilt ? Number(yearBuilt) : undefined,
          features,
          owner_target_price: ownerTarget ? Number(ownerTarget) : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error || `HTTP ${res.status}`); setLoading(false); return; }
      setResult(body);
      setLoading(false);
    } catch (e) {
      setError((e as Error).message); setLoading(false);
    }
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "40px 20px", overflowY: "auto", zIndex: 1000,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg-surface)", borderRadius: "16px",
        maxWidth: "780px", width: "100%", maxHeight: "calc(100vh - 80px)",
        overflowY: "auto", boxShadow: "0 24px 48px rgba(0,0,0,0.3)",
      }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
            💰 Oceniť nehnuteľnosť
          </div>
          <button onClick={onClose} style={{
            width: "32px", height: "32px", borderRadius: "50%", border: "none",
            background: "var(--bg-elevated)", cursor: "pointer", fontSize: "14px",
            color: "var(--text-muted)",
          }}>✕</button>
        </div>

        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Form */}
          {!result && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Typ">
                  <select value={typ} onChange={e => setTyp(e.target.value)} style={selSt}>
                    <option value="byt">Byt</option>
                    <option value="rodinny_dom">Rodinný dom</option>
                    <option value="pozemok">Pozemok</option>
                    <option value="chata">Chata</option>
                    <option value="komercna">Komerčná</option>
                  </select>
                </Field>
                <Field label="Lokalita *">
                  <input value={lokalita} onChange={e => setLokalita(e.target.value)} style={inpSt} placeholder="Bratislava-Ružinov"/>
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <Field label="Plocha (m²) *">
                  <input type="number" value={plocha} onChange={e => setPlocha(e.target.value)} style={inpSt} placeholder="75"/>
                </Field>
                <Field label="Počet izieb">
                  <input type="number" value={izby} onChange={e => setIzby(e.target.value)} style={inpSt} placeholder="3"/>
                </Field>
                <Field label="Rok výstavby">
                  <input type="number" value={yearBuilt} onChange={e => setYearBuilt(e.target.value)} style={inpSt} placeholder="2010"/>
                </Field>
              </div>

              <Field label="Stav">
                <select value={stav} onChange={e => setStav(e.target.value)} style={selSt}>
                  {STAV_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>

              <Field label="Vybavenie">
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {[
                    ["balkon", "Balkón"], ["terasa", "Terasa"], ["zahrada", "Záhrada"],
                    ["garaz", "Garáž"], ["parking", "Parkovacie miesto"], ["vytah", "Výťah"],
                  ].map(([k, label]) => (
                    <button key={k} type="button" onClick={() => setFeatures({ ...features, [k]: !features[k] })}
                      style={{
                        padding: "8px 14px", borderRadius: "8px", border: "1px solid var(--border)",
                        background: features[k] ? "var(--text-primary)" : "var(--bg-elevated)",
                        color: features[k] ? "var(--bg-surface)" : "var(--text-secondary)",
                        fontSize: "12px", fontWeight: 600, cursor: "pointer",
                      }}>{label}</button>
                  ))}
                </div>
              </Field>

              <Field label="Cieľ majiteľa (voliteľné)">
                <input type="number" value={ownerTarget} onChange={e => setOwnerTarget(e.target.value)} style={inpSt} placeholder="Koľko si predajca želá"/>
              </Field>

              {error && (
                <div style={{ padding: "12px 14px", borderRadius: "10px", background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", fontSize: "13px" }}>
                  {error}
                </div>
              )}

              <button onClick={handleEstimate} disabled={loading} style={{
                padding: "14px 18px", borderRadius: "12px", background: "var(--text-primary)", color: "var(--bg-surface)",
                border: "none", fontSize: "14px", fontWeight: 700,
                cursor: loading ? "default" : "pointer", opacity: loading ? 0.5 : 1,
              }}>
                {loading ? "Počítam..." : "💰 Oceniť"}
              </button>
            </>
          )}

          {/* Result */}
          {result && <Result result={result} ownerTarget={ownerTarget ? Number(ownerTarget) : null} onReset={() => setResult(null)} />}
        </div>
      </div>
    </div>
  );
}

const inpSt: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: "8px",
  border: "1px solid var(--border)", background: "var(--bg-elevated)",
  color: "var(--text-primary)", fontSize: "13px", outline: "none",
};
const selSt: React.CSSProperties = { ...inpSt, cursor: "pointer" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>{label}</div>
      {children}
    </div>
  );
}

function Result({ result, ownerTarget, onReset }: { result: PricingResult; ownerTarget: number | null; onReset: () => void }) {
  const recKey = result.recommended_strategy;
  const strategies = [
    { key: "aggressive", color: "#dc2626", bg: "#fee2e2", desc: "Rýchly predaj, viacero ponúk" },
    { key: "market", color: "#374151", bg: "#f3f4f6", desc: "Štandardný flow, trhová cena" },
    { key: "aspirational", color: "#15803d", bg: "#dcfce7", desc: "Vysoká marža, dlhší predaj" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Recommended price */}
      <div style={{ textAlign: "center", padding: "20px", borderRadius: "14px", background: "var(--bg-elevated)" }}>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Odporúčaná cena</div>
        <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          {eur(result.recommended_price)}
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
          Rozsah: <strong>{eur(result.price_low)}</strong> – <strong>{eur(result.price_high)}</strong> · spoľahlivosť {Math.round(result.confidence_score * 100)}%
        </div>
      </div>

      {/* 3 strategies */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
        {strategies.map(s => {
          const data = result.strategies[s.key as "aggressive" | "market" | "aspirational"];
          const isRec = s.key === recKey;
          return (
            <div key={s.key} style={{
              padding: "14px", borderRadius: "12px",
              background: isRec ? s.bg : "var(--bg-elevated)",
              border: isRec ? `2px solid ${s.color}` : "1px solid var(--border)",
              position: "relative",
            }}>
              {isRec && (
                <div style={{
                  position: "absolute", top: "-10px", right: "10px",
                  background: s.color, color: "#fff",
                  padding: "3px 10px", borderRadius: "8px",
                  fontSize: "10px", fontWeight: 700,
                }}>ODPORÚČAM</div>
              )}
              <div style={{ fontSize: "11px", fontWeight: 700, color: s.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {data.label}
              </div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", margin: "6px 0 4px" }}>
                {eur(data.price)}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                ~{data.dom_days} dní na trhu
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px", fontStyle: "italic" }}>
                {s.desc}
              </div>
            </div>
          );
        })}
      </div>

      {/* CMA */}
      <div style={{ background: "var(--bg-elevated)", borderRadius: "12px", padding: "14px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "10px" }}>
          📊 Trhové porovnanie (CMA)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px 16px", fontSize: "12px" }}>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Aktívne ponuky: </span>
            <strong>{result.cma.active_count}</strong> · median <strong>{eur(result.cma.asking_median_per_m2)}</strong>/m²
          </div>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Predané (12 mes.): </span>
            <strong>{result.cma.sold_count}</strong>
            {result.cma.realized_median_per_m2 > 0 && <> · median <strong>{eur(result.cma.realized_median_per_m2)}</strong>/m²</>}
          </div>
          {result.cma.asking_to_realized_gap_pct != null && (
            <div>
              <span style={{ color: "var(--text-muted)" }}>Asking-vs-realized gap: </span>
              <strong>{result.cma.asking_to_realized_gap_pct}%</strong>
            </div>
          )}
          {result.cma.median_dom != null && (
            <div>
              <span style={{ color: "var(--text-muted)" }}>Median DOM: </span>
              <strong>{result.cma.median_dom} dní</strong>
            </div>
          )}
          <div>
            <span style={{ color: "var(--text-muted)" }}>Rarity score: </span>
            <strong>{result.rarity_score}/10</strong>
            {result.rarity_score >= 7 && <span style={{ color: "var(--text-muted)" }}> (vzácna nehnuteľnosť)</span>}
          </div>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Zdroj base ceny: </span>
            <strong>{result.base_price_source === "realized" ? "predané" : result.base_price_source === "asking_corrected" ? "asking − gap" : "statický odhad"}</strong>
          </div>
        </div>
        {result.cma.sold_samples.length > 0 && (
          <details style={{ marginTop: "10px" }}>
            <summary style={{ fontSize: "11px", color: "var(--text-muted)", cursor: "pointer" }}>
              {result.cma.sold_samples.length} predaných comparables
            </summary>
            <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
              {result.cma.sold_samples.map((s, i) => (
                <div key={i} style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {s.lokalita} · {eur(s.estimated_sale_price)} · {s.total_days_on_market} dní {s.estimated_discount_pct ? `· −${s.estimated_discount_pct}%` : ""}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Owner target gap */}
      {ownerTarget && ownerTarget > 0 && (
        <div style={{ padding: "12px 14px", borderRadius: "10px", background: "#fef3c7", border: "1px solid #fcd34d" }}>
          <div style={{ fontSize: "12px", color: "#92400e" }}>
            <strong>Cieľ majiteľa:</strong> {eur(ownerTarget)} ·
            {(() => {
              const diff = ((ownerTarget - result.recommended_price) / result.recommended_price) * 100;
              const absD = Math.abs(diff);
              if (absD < 3) return <> v súlade s trhovou cenou ✓</>;
              if (diff > 0) return <> o {Math.round(absD)}% NAD trhovou cenou — predĺžený predaj alebo zľava nutná</>;
              return <> o {Math.round(absD)}% POD trhovou cenou — môžeš ponúknuť vyššiu cenu</>;
            })()}
          </div>
        </div>
      )}

      <button onClick={onReset} style={{
        padding: "10px 14px", borderRadius: "10px", background: "var(--bg-elevated)",
        color: "var(--text-secondary)", border: "1px solid var(--border)",
        fontSize: "12px", fontWeight: 600, cursor: "pointer",
      }}>← Nový odhad</button>
    </div>
  );
}
