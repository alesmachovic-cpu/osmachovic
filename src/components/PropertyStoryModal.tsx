"use client";

import { useState, useEffect } from "react";

interface NehnRow {
  id: string;
  nazov: string | null;
  lokalita: string | null;
  typ_nehnutelnosti: string | null;
  plocha: number | null;
  izby: number | null;
  cena: number | null;
}

interface StoryResult {
  id: string | null;
  final_copy: string;
  passed_first_attempt: boolean;
  violations_count: number;
  quality: {
    overall_quality?: number;
    hook_strength?: number;
    lifestyle_authenticity?: number;
    data_integration?: number;
    social_snippet_punch?: number;
  };
  final_status: string;
  rarity_score: number;
  cma: {
    active_count: number;
    sold_count: number;
    asking_median_per_m2: number;
    realized_median_per_m2: number;
  };
  debug?: { total_tokens: number; took_ms: number };
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  approved_first_pass: { label: "Schválené hneď", color: "#15803d", bg: "#dcfce7" },
  approved_after_revision: { label: "Schválené po korektúre", color: "#1d4ed8", bg: "#dbeafe" },
  requires_human_review: { label: "Vyžaduje kontrolu", color: "#b91c1c", bg: "#fee2e2" },
};

export default function PropertyStoryModal({
  onClose,
  userId,
  nehnutelnosti = [],
}: {
  onClose: () => void;
  userId?: string;
  nehnutelnosti?: NehnRow[];
}) {
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<StoryResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Pre-vyberie prvú nehnutelnost ak je zoznam
  useEffect(() => {
    if (!selected && nehnutelnosti.length > 0) setSelected(nehnutelnosti[0].id);
  }, [nehnutelnosti, selected]);

  async function generate() {
    if (!selected) { setError("Vyber nehnuteľnosť"); return; }
    setError(""); setLoading(true); setResult(null);
    try {
      const r = await fetch("/api/property-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nehnutelnost_id: selected, user_id: userId }),
      });
      const body = await r.json();
      if (!r.ok) { setError(body.error || `HTTP ${r.status}`); setLoading(false); return; }
      setResult(body);
      setLoading(false);
    } catch (e) {
      setError((e as Error).message); setLoading(false);
    }
  }

  function copy() {
    if (!result?.final_copy) return;
    navigator.clipboard.writeText(result.final_copy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const status = result ? STATUS_LABELS[result.final_status] || STATUS_LABELS.requires_human_review : null;

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
            ✨ AI Property Story
          </div>
          <button onClick={onClose} style={{
            width: "32px", height: "32px", borderRadius: "50%", border: "none",
            background: "var(--bg-elevated)", cursor: "pointer", fontSize: "14px",
            color: "var(--text-muted)",
          }}>✕</button>
        </div>

        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {!result && (
            <>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                Vyber nehnuteľnosť z portfólia. AI vygeneruje pripravený inzerátový copy
                vrátane <strong>investičnej logiky</strong> s konkrétnymi číslami z monitoringu
                (median predajné ceny, demand index, čas na trhu).
                <br/><br/>
                Pipeline: <em>Generator</em> → <em>Validator</em> (čisti klišé, vynucuje pravidlá) → <em>Auditor</em> (skóruje kvalitu). Trvá ~20-40 sekúnd.
              </div>

              <div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                  Nehnuteľnosť z portfólia
                </div>
                <select value={selected} onChange={e => setSelected(e.target.value)} disabled={loading} style={{
                  width: "100%", padding: "10px 12px", borderRadius: "8px",
                  border: "1px solid var(--border)", background: "var(--bg-elevated)",
                  color: "var(--text-primary)", fontSize: "13px", outline: "none", cursor: "pointer",
                }}>
                  {nehnutelnosti.length === 0 ? (
                    <option value="">— žiadne nehnuteľnosti v portfóliu —</option>
                  ) : (
                    nehnutelnosti.map(n => (
                      <option key={n.id} value={n.id}>
                        {n.nazov || `${n.typ_nehnutelnosti} — ${n.lokalita}`} {n.plocha ? `(${n.plocha} m²)` : ""}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {error && (
                <div style={{ padding: "12px 14px", borderRadius: "10px", background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", fontSize: "13px" }}>
                  {error}
                </div>
              )}

              <button onClick={generate} disabled={loading || !selected} style={{
                padding: "14px 18px", borderRadius: "12px",
                background: "linear-gradient(135deg, #4338ca 0%, #6366f1 100%)",
                color: "#fff", border: "none", fontSize: "14px", fontWeight: 700,
                cursor: (loading || !selected) ? "default" : "pointer",
                opacity: (loading || !selected) ? 0.5 : 1,
              }}>
                {loading ? "✨ Generujem (čakaj 20-40s)..." : "✨ Vygenerovať popis"}
              </button>

              {loading && (
                <div style={{ textAlign: "center", padding: "20px", fontSize: "12px", color: "var(--text-muted)" }}>
                  3 vrstvy AI bežia: Generator → Validator → Auditor.
                  <br/>Validator čistí klišé a vynucuje data-driven content.
                </div>
              )}
            </>
          )}

          {result && status && (
            <>
              {/* Status badge + quality */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                <div style={{
                  padding: "6px 14px", borderRadius: "10px",
                  background: status.bg, color: status.color,
                  fontSize: "12px", fontWeight: 700,
                }}>
                  {status.label}
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "11px" }}>
                  <Score label="Celkom" value={result.quality.overall_quality}/>
                  <Score label="Hook" value={result.quality.hook_strength}/>
                  <Score label="Lifestyle" value={result.quality.lifestyle_authenticity}/>
                  <Score label="Dáta" value={result.quality.data_integration}/>
                </div>
              </div>

              {/* Final copy */}
              <div style={{
                background: "var(--bg-elevated)", borderRadius: "12px",
                padding: "20px", border: "1px solid var(--border)",
                fontSize: "13px", lineHeight: "1.7",
                whiteSpace: "pre-wrap", color: "var(--text-primary)",
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              }}>
                {result.final_copy}
              </div>

              {/* Meta */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "11px", color: "var(--text-muted)" }}>
                <div>Rarity: <strong>{result.rarity_score}/10</strong></div>
                <div>Comparables: <strong>{result.cma.active_count + result.cma.sold_count}</strong> ({result.cma.sold_count} predaných)</div>
                {result.cma.realized_median_per_m2 > 0 && (
                  <div>Median realizačná: <strong>{Math.round(result.cma.realized_median_per_m2).toLocaleString("sk")} €/m²</strong></div>
                )}
                {result.violations_count > 0 && (
                  <div style={{ color: "#b91c1c" }}>{result.violations_count} korekcií</div>
                )}
                {result.debug?.total_tokens && (
                  <div>~{result.debug.total_tokens.toLocaleString("sk")} tokens · {Math.round((result.debug.took_ms || 0) / 1000)}s</div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={copy} style={{
                  flex: 1, padding: "12px 16px", borderRadius: "10px",
                  background: copied ? "#15803d" : "var(--text-primary)",
                  color: copied ? "#fff" : "var(--bg-surface)",
                  border: "none", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                }}>
                  {copied ? "✓ Skopírované" : "📋 Skopírovať text"}
                </button>
                <button onClick={() => { setResult(null); setError(""); }} style={{
                  padding: "12px 18px", borderRadius: "10px",
                  background: "var(--bg-elevated)", color: "var(--text-secondary)",
                  border: "1px solid var(--border)", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                }}>← Nový popis</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Score({ label, value }: { label: string; value?: number }) {
  if (!value) return null;
  const color = value >= 8 ? "#15803d" : value >= 6 ? "#1d4ed8" : "#b91c1c";
  return (
    <div style={{
      padding: "4px 10px", borderRadius: "6px",
      background: "var(--bg-elevated)", border: "1px solid var(--border)",
      display: "flex", gap: "4px", alignItems: "baseline",
    }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <strong style={{ color }}>{value}/10</strong>
    </div>
  );
}
