"use client";

import { useEffect, useState } from "react";

interface Extracted {
  nazov?: string | null;
  typ_nehnutelnosti?: string | null;
  lokalita?: string | null;
  cena?: number | null;
  plocha?: number | null;
  izby?: number | null;
  stav?: string | null;
  popis?: string | null;
  predajca?: string | null;
  fotka_url?: string | null;
}

interface Analysis {
  zaklad?: { cena?: number; plocha?: number; eurM2?: number; benchmark?: number; odchylka?: number; stav?: string };
  benchmark_zdroj?: string;
  hypoteka?: {
    istina?: number; mesacna_splatka?: number; celkova_nakup?: number;
    hotovost_potrebna?: number; potrebny_prijem?: number;
    ltv?: string; urok?: string; roky?: number;
  } | null;
  ai?: {
    verdikt?: string;
    silne_stranky?: string[];
    slabe_stranky?: string[];
    odporucanie?: string;
    cielova_skupina?: string;
    cas_predaja?: string;
    vyjednavacie_argumenty?: string[];
  };
}

interface Result {
  url: string;
  extracted: Extracted;
  analysis: Analysis;
}

const VERDIKT: Record<string, { label: string; bg: string; color: string }> = {
  podhodnotene: { label: "Podhodnotená", bg: "#dcfce7", color: "#15803d" },
  trhova_cena: { label: "Trhová cena", bg: "#f3f4f6", color: "#374151" },
  nadhodnotene: { label: "Nadhodnotená", bg: "#fee2e2", color: "#b91c1c" },
};

const eur = (n: number | null | undefined) =>
  n == null ? "—" : `${Math.round(n).toLocaleString("sk")} €`;

export default function UrlAnalyzeModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError("");
      try {
        const r = await fetch("/api/analyze-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const body = await r.json();
        if (cancelled) return;
        if (!r.ok) { setError(body.error || `HTTP ${r.status}`); setLoading(false); return; }
        setResult(body);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message); setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  async function downloadPdf() {
    if (!result) return;
    setDownloading(true);
    try {
      const r = await fetch("/api/analyze-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      if (!r.ok) { alert("Nepodarilo sa vygenerovať PDF"); setDownloading(false); return; }
      const blob = await r.blob();
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = `analyza_${(result.extracted.nazov || result.extracted.lokalita || "nehnutelnost").toLowerCase().replace(/[^a-z0-9]+/gi, "_").slice(0, 40)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(dlUrl), 1000);
    } catch (e) {
      alert("Chyba: " + (e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  const verdiktKey = result?.analysis.ai?.verdikt || result?.analysis.zaklad?.stav || "trhova_cena";
  const v = VERDIKT[verdiktKey] || VERDIKT.trhova_cena;
  const odch = result?.analysis.zaklad?.odchylka ?? 0;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "40px 20px", overflowY: "auto", zIndex: 1000,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--bg-surface)", borderRadius: "16px",
        maxWidth: "720px", width: "100%", maxHeight: "calc(100vh - 80px)",
        overflowY: "auto", boxShadow: "0 24px 48px rgba(0,0,0,0.3)",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
            🔍 Analýza inzerátu
          </div>
          <button onClick={onClose} style={{
            width: "32px", height: "32px", borderRadius: "50%", border: "none",
            background: "var(--bg-elevated)", cursor: "pointer", fontSize: "14px",
            color: "var(--text-muted)",
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px" }}>
          {loading && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
              <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                Sťahujem inzerát a analyzujem...
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
                Trvá to 5–20 sekúnd (závisí od veľkosti stránky)
              </div>
            </div>
          )}

          {error && (
            <div style={{
              padding: "16px", borderRadius: "10px",
              background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b",
            }}>
              <div style={{ fontWeight: 700, marginBottom: "4px" }}>❌ Chyba</div>
              <div style={{ fontSize: "13px" }}>{error}</div>
            </div>
          )}

          {result && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Hlavička */}
              <div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>
                  {result.extracted.nazov || result.extracted.typ_nehnutelnosti || "Nehnuteľnosť"}
                </div>
                {result.extracted.lokalita && (
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
                    📍 {result.extracted.lokalita}
                  </div>
                )}
                <a href={result.url} target="_blank" rel="noreferrer" style={{
                  fontSize: "11px", color: "var(--accent)", textDecoration: "underline",
                  display: "inline-block", marginTop: "4px", wordBreak: "break-all",
                }}>{result.url}</a>
              </div>

              {/* Verdikt */}
              <div style={{
                padding: "14px 18px", borderRadius: "12px",
                background: v.bg, color: v.color,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ fontSize: "16px", fontWeight: 800 }}>{v.label}</div>
                <div style={{ fontSize: "14px", fontWeight: 700 }}>
                  {odch > 0 ? "+" : ""}{odch}% voči trhu
                </div>
              </div>

              {/* Základné údaje */}
              <div style={{ background: "var(--bg-elevated)", borderRadius: "12px", padding: "16px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "10px" }}>
                  Základné údaje
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px 16px" }}>
                  {[
                    ["Cena", eur(result.extracted.cena)],
                    ["Plocha", result.extracted.plocha ? `${result.extracted.plocha} m²` : "—"],
                    ["€ / m²", eur(result.analysis.zaklad?.eurM2)],
                    ["Trhový benchmark", result.analysis.zaklad?.benchmark ? `${eur(result.analysis.zaklad?.benchmark)} / m²` : "—"],
                    ["Izby", result.extracted.izby != null ? String(result.extracted.izby) : "—"],
                    ["Stav", result.extracted.stav || "—"],
                  ].map(([l, val]) => (
                    <div key={l}>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{l}</div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>{val}</div>
                    </div>
                  ))}
                </div>
                {result.analysis.benchmark_zdroj && (
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "10px", fontStyle: "italic" }}>
                    {result.analysis.benchmark_zdroj}
                  </div>
                )}
              </div>

              {/* Hypotéka */}
              {result.analysis.hypoteka && (
                <div style={{ background: "var(--bg-elevated)", borderRadius: "12px", padding: "16px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "10px" }}>
                    Hypotéka ({result.analysis.hypoteka.ltv} LTV, {result.analysis.hypoteka.urok}, {result.analysis.hypoteka.roky} rokov)
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px 16px" }}>
                    {[
                      ["Mesačná splátka", eur(result.analysis.hypoteka.mesacna_splatka)],
                      ["Potrebná hotovosť", eur(result.analysis.hypoteka.hotovost_potrebna)],
                      ["Potrebný príjem", `${eur(result.analysis.hypoteka.potrebny_prijem)} / mes.`],
                      ["Celkom za úver", eur(result.analysis.hypoteka.celkova_nakup)],
                    ].map(([l, val]) => (
                      <div key={l}>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{l}</div>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI hodnotenie */}
              {result.analysis.ai && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {result.analysis.ai.silne_stranky && result.analysis.ai.silne_stranky.length > 0 && (
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                        ✓ Silné stránky
                      </div>
                      <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--text-primary)", fontSize: "13px", lineHeight: "1.6" }}>
                        {result.analysis.ai.silne_stranky.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {result.analysis.ai.slabe_stranky && result.analysis.ai.slabe_stranky.length > 0 && (
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#b91c1c", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                        ✕ Slabé stránky
                      </div>
                      <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--text-primary)", fontSize: "13px", lineHeight: "1.6" }}>
                        {result.analysis.ai.slabe_stranky.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {result.analysis.ai.vyjednavacie_argumenty && result.analysis.ai.vyjednavacie_argumenty.length > 0 && (
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                        💼 Vyjednávacie argumenty
                      </div>
                      <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--text-primary)", fontSize: "13px", lineHeight: "1.6" }}>
                        {result.analysis.ai.vyjednavacie_argumenty.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {result.analysis.ai.odporucanie && (
                    <div style={{
                      padding: "12px 14px", background: "var(--bg-elevated)",
                      borderRadius: "10px", borderLeft: "3px solid var(--accent)",
                    }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "4px" }}>
                        Odporúčanie
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: "1.5" }}>
                        {result.analysis.ai.odporucanie}
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "var(--text-muted)" }}>
                    {result.analysis.ai.cielova_skupina && (
                      <div>👤 <strong>Cieľová skupina:</strong> {result.analysis.ai.cielova_skupina}</div>
                    )}
                    {result.analysis.ai.cas_predaja && (
                      <div>⏱ <strong>Čas predaja:</strong> {result.analysis.ai.cas_predaja}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Akcie */}
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button
                  onClick={downloadPdf}
                  disabled={downloading}
                  style={{
                    flex: 1, padding: "12px 16px", borderRadius: "10px",
                    background: "var(--text-primary)", color: "var(--bg-surface)",
                    border: "none", fontSize: "13px", fontWeight: 700,
                    cursor: downloading ? "default" : "pointer",
                    opacity: downloading ? 0.5 : 1,
                  }}
                >
                  {downloading ? "Generujem PDF..." : "📥 Stiahnuť PDF"}
                </button>
                <button
                  onClick={onClose}
                  style={{
                    padding: "12px 18px", borderRadius: "10px",
                    background: "var(--bg-elevated)", color: "var(--text-primary)",
                    border: "1px solid var(--border)", fontSize: "13px", fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Zavrieť
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
