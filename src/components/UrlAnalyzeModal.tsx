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
  stav_inzerovany?: string | null;
  stav_posudeny_ai?: string | null;
  stav_odovodnenie?: string | null;
  year_built?: number | null;
  year_reconstructed?: number | null;
  popis?: string | null;
  predajca?: string | null;
  fotka_url?: string | null;
}

interface Analysis {
  zaklad?: { cena?: number; plocha?: number; eurM2?: number; benchmark?: number; odchylka?: number; stav?: string };
  benchmark_zdroj?: string;
  trh?: {
    zdroj?: "realized" | "asking" | "static";
    asking_median?: number | null;
    asking_count?: number;
    realized_median?: number | null;
    realized_count?: number;
    avg_discount_pct?: number | null;
    median_dom?: number | null;
  };
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
  okolie?: {
    plusy?: string[];
    minusy?: string[];
    doprava?: string;
    obcianska_vybavenost?: string;
    charakter?: string;
    shrnutie?: string;
    skore?: number;
    zdroj?: string;
  };
}

interface Result {
  url: string;
  extracted: Extracted;
  analysis: Analysis | null;
  ai_failed?: boolean;
  ai_error?: string;
  ai_debug?: string | null;
  message?: string;
  manual_input?: boolean;
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

  const verdiktKey = result?.analysis?.ai?.verdikt || result?.analysis?.zaklad?.stav || "trhova_cena";
  const v = VERDIKT[verdiktKey] || VERDIKT.trhova_cena;
  const odch = result?.analysis?.zaklad?.odchylka ?? 0;

  // TASK Bug#1 — Manual fallback formulár pri zlyhaní AI extrakcie
  const [manualMode, setManualMode] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [mNazov, setMNazov] = useState("");
  const [mTyp, setMTyp] = useState<"byt" | "rodinny_dom" | "pozemok" | "chata" | "komercna" | "garaz" | "">("");
  const [mLokalita, setMLokalita] = useState("");
  const [mCena, setMCena] = useState<string>("");
  const [mPlocha, setMPlocha] = useState<string>("");
  const [mIzby, setMIzby] = useState<string>("");
  const [mStav, setMStav] = useState<"novostavba" | "po_rekonstrukcii" | "povodny_stav" | "">("");
  const [mPopis, setMPopis] = useState("");

  // Pri otvorení manuálneho módu predvyplň z meta tagov ktoré nám server vrátil
  useEffect(() => {
    if (manualMode && result?.extracted) {
      setMNazov(result.extracted.nazov || "");
      setMLokalita(result.extracted.lokalita || "");
      setMPopis(result.extracted.popis || "");
    }
  }, [manualMode, result?.extracted]);

  async function submitManual() {
    if (!mLokalita || !mCena || !mPlocha) {
      alert("Vyplň aspoň lokalitu, cenu a plochu — bez nich sa analýza nedá spočítať.");
      return;
    }
    setManualSubmitting(true);
    try {
      const r = await fetch("/api/analyze-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: result?.url || "manual",
          manual_data: {
            nazov: mNazov || null,
            typ_nehnutelnosti: mTyp || null,
            lokalita: mLokalita,
            cena: Number(mCena),
            plocha: Number(mPlocha),
            izby: mIzby ? Number(mIzby) : null,
            stav: mStav || null,
            stav_inzerovany: mStav || null,
            stav_posudeny_ai: mStav || null,
            popis: mPopis || null,
          },
        }),
      });
      const d = await r.json();
      if (!r.ok) { alert("Chyba: " + (d.error || `HTTP ${r.status}`)); setManualSubmitting(false); return; }
      setResult(d);
      setManualMode(false);
    } catch (e) {
      alert("Chyba: " + (e as Error).message);
    } finally {
      setManualSubmitting(false);
    }
  }

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
              <button
                onClick={() => { setError(""); setManualMode(true); }}
                style={{
                  marginTop: "10px", padding: "8px 14px", borderRadius: "8px",
                  background: "#991b1b", color: "#fff", border: "none",
                  fontSize: "12px", fontWeight: 700, cursor: "pointer",
                }}
              >📝 Vyplniť ručne a pokračovať</button>
            </div>
          )}

          {/* AI extraction failed — show banner + manual fallback option */}
          {!loading && !error && result?.ai_failed && !manualMode && (
            <div style={{
              padding: "16px", borderRadius: "10px",
              background: "#FEF3C7", border: "1px solid #FDE68A", color: "#92400E",
              marginBottom: "16px",
            }}>
              <div style={{ fontWeight: 700, marginBottom: "4px" }}>⚠️ AI extrakcia zlyhala</div>
              <div style={{ fontSize: "13px", marginBottom: "10px" }}>
                {result.message || "Nepodarilo sa automaticky vytiahnuť údaje z inzerátu."}
                {result.ai_error && (
                  <div style={{ fontSize: "11px", color: "#78350F", marginTop: "4px", fontStyle: "italic" }}>
                    Dôvod: {result.ai_error}
                  </div>
                )}
              </div>
              <button
                onClick={() => setManualMode(true)}
                style={{
                  padding: "8px 14px", borderRadius: "8px",
                  background: "#92400E", color: "#fff", border: "none",
                  fontSize: "12px", fontWeight: 700, cursor: "pointer",
                }}
              >📝 Vyplniť údaje ručne</button>
            </div>
          )}

          {/* Manual fill form */}
          {manualMode && (
            <div style={{
              padding: "20px", borderRadius: "12px",
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px",
            }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                📝 Manuálne údaje o nehnuteľnosti
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Názov inzerátu</label>
                  <input value={mNazov} onChange={e => setMNazov(e.target.value)} placeholder="napr. 3-izbový byt..."
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "13px" }} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Typ *</label>
                  <select value={mTyp} onChange={e => setMTyp(e.target.value as typeof mTyp)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "13px" }}>
                    <option value="">— vyber —</option>
                    <option value="byt">Byt</option>
                    <option value="rodinny_dom">Rodinný dom</option>
                    <option value="pozemok">Pozemok</option>
                    <option value="chata">Chata</option>
                    <option value="komercna">Komerčná</option>
                    <option value="garaz">Garáž</option>
                  </select>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Lokalita * (mesto + mestská časť)</label>
                  <input value={mLokalita} onChange={e => setMLokalita(e.target.value)} placeholder="napr. Bratislava-Ružinov"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "13px" }} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Cena (€) *</label>
                  <input type="number" value={mCena} onChange={e => setMCena(e.target.value)} placeholder="200000"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "13px" }} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Plocha (m²) *</label>
                  <input type="number" value={mPlocha} onChange={e => setMPlocha(e.target.value)} placeholder="65"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "13px" }} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Počet izieb</label>
                  <input type="number" value={mIzby} onChange={e => setMIzby(e.target.value)} placeholder="3"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "13px" }} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Stav</label>
                  <select value={mStav} onChange={e => setMStav(e.target.value as typeof mStav)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "13px" }}>
                    <option value="">— neuvedený —</option>
                    <option value="novostavba">Novostavba</option>
                    <option value="po_rekonstrukcii">Po rekonštrukcii</option>
                    <option value="povodny_stav">Pôvodný stav</option>
                  </select>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Popis (voliteľné, pomáha AI verdiktu)</label>
                  <textarea value={mPopis} onChange={e => setMPopis(e.target.value)} rows={3}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "13px", fontFamily: "inherit", resize: "vertical" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button onClick={() => setManualMode(false)} style={{
                  padding: "10px 16px", borderRadius: "8px", border: "1px solid var(--border)",
                  background: "transparent", color: "var(--text-primary)",
                  fontSize: "13px", fontWeight: 600, cursor: "pointer",
                }}>Zrušiť</button>
                <button onClick={submitManual} disabled={manualSubmitting} style={{
                  padding: "10px 18px", borderRadius: "8px", border: "none",
                  background: "#374151", color: "#fff",
                  fontSize: "13px", fontWeight: 700, cursor: manualSubmitting ? "default" : "pointer",
                  opacity: manualSubmitting ? 0.5 : 1,
                }}>{manualSubmitting ? "Analyzujem..." : "Spustiť analýzu →"}</button>
              </div>
            </div>
          )}

          {result && result.analysis && !result.ai_failed && (
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
                    ["Stav", result.extracted.stav_posudeny_ai || result.extracted.stav || "—"],
                  ].map(([l, val]) => (
                    <div key={l}>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{l}</div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Detail roku výstavby + AI posúdenie stavu */}
                {(result.extracted.year_built || (result.extracted.stav_inzerovany && result.extracted.stav_posudeny_ai && result.extracted.stav_inzerovany !== result.extracted.stav_posudeny_ai)) && (
                  <div style={{
                    marginTop: "12px", padding: "10px 14px", borderRadius: "10px",
                    background: "#eff6ff", border: "1px solid #bfdbfe",
                  }}>
                    {result.extracted.year_built && (
                      <div style={{ fontSize: "12px", color: "#1e40af", marginBottom: result.extracted.stav_odovodnenie ? "6px" : 0 }}>
                        🏗️ <strong>Postavené {result.extracted.year_built}</strong>
                        {result.extracted.year_reconstructed ? <> · <strong>Rekonštrukcia {result.extracted.year_reconstructed}</strong></> : null}
                      </div>
                    )}
                    {result.extracted.stav_inzerovany && result.extracted.stav_posudeny_ai && result.extracted.stav_inzerovany !== result.extracted.stav_posudeny_ai && (
                      <div style={{ fontSize: "12px", color: "#1e40af" }}>
                        💡 <strong>Inzerát uvádza:</strong> &quot;{result.extracted.stav_inzerovany}&quot; ·
                        {" "}<strong>AI posúdenie:</strong> &quot;{result.extracted.stav_posudeny_ai}&quot;
                        {result.extracted.stav_odovodnenie && (
                          <div style={{ marginTop: "4px", fontStyle: "italic", color: "#3730a3" }}>
                            {result.extracted.stav_odovodnenie}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {result.analysis.benchmark_zdroj && (
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "10px", fontStyle: "italic" }}>
                    {result.analysis.benchmark_zdroj}
                  </div>
                )}
              </div>

              {/* Trh v segmente — koľko ľudia zľavnili, ako dlho leží na trhu */}
              {result.analysis.trh && (result.analysis.trh.avg_discount_pct != null || result.analysis.trh.median_dom != null || result.analysis.trh.realized_count) && (
                <div style={{
                  background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                  border: "1px solid #fcd34d", borderRadius: "12px", padding: "16px",
                }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "10px" }}>
                    📊 Trh v segmente
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px 16px" }}>
                    {result.analysis.trh.avg_discount_pct != null && (
                      <div>
                        <div style={{ fontSize: "11px", color: "#92400e" }}>Predajcovia bežne zľavnia</div>
                        <div style={{ fontSize: "16px", fontWeight: 800, color: "#78350f" }}>
                          {result.analysis.trh.avg_discount_pct}%
                          <span style={{ fontSize: "11px", fontWeight: 500, color: "#92400e", marginLeft: "6px" }}>
                            (z {result.analysis.trh.realized_count} predaných)
                          </span>
                        </div>
                      </div>
                    )}
                    {result.analysis.trh.median_dom != null && (
                      <div>
                        <div style={{ fontSize: "11px", color: "#92400e" }}>Typický čas na trhu</div>
                        <div style={{ fontSize: "16px", fontWeight: 800, color: "#78350f" }}>
                          {result.analysis.trh.median_dom} dní
                        </div>
                      </div>
                    )}
                    {result.analysis.trh.asking_median != null && result.analysis.trh.realized_median != null && (
                      <>
                        <div>
                          <div style={{ fontSize: "11px", color: "#92400e" }}>Median ASKING (€/m²)</div>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#78350f" }}>
                            {Math.round(result.analysis.trh.asking_median).toLocaleString("sk")}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: "11px", color: "#92400e" }}>Median REALIZAČNÉ (€/m²)</div>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#78350f" }}>
                            {Math.round(result.analysis.trh.realized_median).toLocaleString("sk")}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {result.analysis.trh.zdroj === "asking" && (
                    <div style={{ fontSize: "10px", color: "#92400e", marginTop: "8px", fontStyle: "italic" }}>
                      Pozn.: málo predaných dát pre tento segment — analyzujeme z aktívnych ponúk. Po nazbieraní viac realizačných predajov sa presnosť zlepší.
                    </div>
                  )}
                </div>
              )}

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

              {/* OKOLIE — Gemini analýza okolia (NEW) */}
              {result.analysis.okolie && (result.analysis.okolie.plusy?.length || result.analysis.okolie.minusy?.length || result.analysis.okolie.shrnutie) && (
                <div style={{
                  padding: "16px", background: "var(--bg-surface)",
                  borderRadius: "12px", border: "1px solid var(--border)",
                  display: "flex", flexDirection: "column", gap: "12px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                      📍 Okolie nehnuteľnosti
                    </div>
                    {typeof result.analysis.okolie.skore === "number" && result.analysis.okolie.skore > 0 && (
                      <span style={{
                        padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 700,
                        background: result.analysis.okolie.skore >= 7 ? "#DCFCE7" : result.analysis.okolie.skore >= 5 ? "#FEF3C7" : "#FEE2E2",
                        color: result.analysis.okolie.skore >= 7 ? "#15803D" : result.analysis.okolie.skore >= 5 ? "#92400E" : "#991B1B",
                      }}>
                        Skóre: {result.analysis.okolie.skore}/10
                      </span>
                    )}
                  </div>

                  {result.analysis.okolie.shrnutie && (
                    <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, fontStyle: "italic" }}>
                      {result.analysis.okolie.shrnutie}
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    {result.analysis.okolie.plusy && result.analysis.okolie.plusy.length > 0 && (
                      <div style={{ padding: "10px 12px", background: "#F0FDF4", borderRadius: "8px", border: "1px solid #BBF7D0" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#15803D", marginBottom: "6px" }}>✓ PLUSY</div>
                        <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: "#14532D", lineHeight: 1.5 }}>
                          {result.analysis.okolie.plusy.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                      </div>
                    )}
                    {result.analysis.okolie.minusy && result.analysis.okolie.minusy.length > 0 && (
                      <div style={{ padding: "10px 12px", background: "#FEF2F2", borderRadius: "8px", border: "1px solid #FECACA" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#991B1B", marginBottom: "6px" }}>✗ MÍNUSY</div>
                        <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: "#7F1D1D", lineHeight: 1.5 }}>
                          {result.analysis.okolie.minusy.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>

                  {(result.analysis.okolie.doprava || result.analysis.okolie.obcianska_vybavenost || result.analysis.okolie.charakter) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
                      {result.analysis.okolie.doprava && <div>🚌 <strong>Doprava:</strong> {result.analysis.okolie.doprava}</div>}
                      {result.analysis.okolie.obcianska_vybavenost && <div>🏪 <strong>Vybavenosť:</strong> {result.analysis.okolie.obcianska_vybavenost}</div>}
                      {result.analysis.okolie.charakter && <div>🌳 <strong>Charakter:</strong> {result.analysis.okolie.charakter}</div>}
                    </div>
                  )}
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
