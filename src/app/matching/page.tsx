"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Klient, Nehnutelnost } from "@/lib/database.types";

interface Objednavka {
  id: string;
  klient_id: string;
  druh: string | null;
  poziadavky: Record<string, unknown> | null;
  lokalita: { kraje?: string[]; okresy?: string[] } | string[] | null;
  cena_do: number | null;
  cena_od: number | null;
}

interface Match {
  klient: Klient;
  nehnutelnost: Nehnutelnost;
  objednavka: Objednavka | null;
  score: number;
  reasons: string[];
}

function calcMatch(k: Klient, n: Nehnutelnost, objednavky: Objednavka[]): { score: number; reasons: string[]; obj: Objednavka | null } {
  let score = 0;
  const reasons: string[] = [];

  if (k.typ !== "kupujuci" && k.typ !== "oboje") return { score: 0, reasons: [], obj: null };

  const obj = objednavky.find(o => o.klient_id === k.id) ?? null;

  // Typ nehnuteľnosti z objednávky
  if (obj?.druh && n.typ) {
    const druhLower = obj.druh.toLowerCase();
    const typLower = n.typ.toLowerCase();
    if (druhLower === typLower || druhLower.includes(typLower) || typLower.includes(druhLower)) {
      score += 25;
      reasons.push("Typ nehnuteľnosti sedí");
    }
  }

  // Rozpočet
  const maxCena = obj?.cena_do ?? k.rozpocet_max;
  if (maxCena && n.cena != null) {
    if (n.cena <= maxCena) {
      score += 30;
      reasons.push("Cena je v rozpočte");
    } else if (n.cena <= maxCena * 1.1) {
      score += 12;
      reasons.push("Cena mierne nad rozpočtom");
    }
  }

  // Lokalita z objednávky (môže byť {kraje,okresy} alebo string[]) alebo z klienta
  const rawLok = obj?.lokalita;
  const objLokality: string[] = Array.isArray(rawLok)
    ? rawLok
    : rawLok
      ? [...(rawLok.kraje ?? []), ...(rawLok.okresy ?? [])]
      : [];
  if (objLokality.length > 0 && n.lokalita) {
    const nLow = n.lokalita.toLowerCase();
    const match = objLokality.some(lok => {
      const lokLow = lok.toLowerCase();
      return nLow.includes(lokLow) || lokLow.includes(nLow);
    });
    if (match) {
      score += 25;
      reasons.push("Lokalita zodpovedá");
    }
  } else if (k.lokalita && n.lokalita) {
    const kWords = k.lokalita.toLowerCase().split(/[\s,]+/);
    const nWords = n.lokalita.toLowerCase().split(/[\s,]+/);
    const overlap = kWords.some(w => nWords.some(nw => nw.includes(w) || w.includes(nw)));
    if (overlap) {
      score += 25;
      reasons.push("Lokalita zodpovedá");
    }
  }

  // Izby z požiadaviek
  if (obj?.poziadavky && n.izby != null) {
    const poz = obj.poziadavky;
    const izbyArr = (poz.izby ?? poz.pocet_izieb ?? poz.rooms) as number[] | undefined;
    if (Array.isArray(izbyArr) && izbyArr.includes(n.izby)) {
      score += 10;
      reasons.push(`${n.izby}-izbový vyhovuje`);
    }
  }

  // Bonus za aktívnu objednávku
  if (obj) {
    score += 10;
    reasons.push("Má objednávku");
  }

  return { score: Math.min(score, 100), reasons, obj };
}

function fmtCena(c: number | null) {
  if (c == null) return "—";
  return c >= 1000 ? `${Math.round(c / 1000)}k €` : `${c} €`;
}

export default function MatchingPage() {
  const [klienti, setKlienti] = useState<Klient[]>([]);
  const [nehnutelnosti, setNehnutelnosti] = useState<Nehnutelnost[]>([]);
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [minScore, setMinScore] = useState(30);
  const [expanded, setExpanded] = useState<number | null>(null);
  // Pre-filter na konkrétnu objednávku/klienta cez ?objednavka=ID alebo ?klient=ID
  const [focusObjednavkaId, setFocusObjednavkaId] = useState<string | null>(null);
  const [focusKlientId, setFocusKlientId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    setFocusObjednavkaId(sp.get("objednavka"));
    setFocusKlientId(sp.get("klient"));
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [kData, nData, oData] = await Promise.all([
        fetch("/api/klienti").then(r => r.json()),
        fetch("/api/nehnutelnosti").then(r => r.json()),
        fetch("/api/objednavky").then(r => r.json()),
      ]);
      const ks = (Array.isArray(kData) ? kData : []).filter((k: { typ: string }) => k.typ === "kupujuci" || k.typ === "oboje");
      const ns = Array.isArray(nData) ? nData : [];
      const obs = (Array.isArray(oData) ? oData : []) as Objednavka[];
      setKlienti(ks);
      setNehnutelnosti(ns);

      const result: Match[] = [];
      for (const klient of ks) {
        for (const neh of ns) {
          const { score, reasons, obj } = calcMatch(klient, neh, obs);
          if (score > 0) result.push({ klient, nehnutelnost: neh, objednavka: obj, score, reasons });
        }
      }
      result.sort((a, b) => b.score - a.score);
      setMatches(result);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = matches.filter(m => {
    if (m.score < minScore) return false;
    if (focusObjednavkaId && m.objednavka?.id !== focusObjednavkaId) return false;
    if (focusKlientId && m.klient.id !== focusKlientId) return false;
    return true;
  });
  const focusKlientName = focusObjednavkaId
    ? klienti.find(k => matches.find(m => m.objednavka?.id === focusObjednavkaId && m.klient.id === k.id))?.meno
    : (focusKlientId ? klienti.find(k => k.id === focusKlientId)?.meno : null);

  function scoreColor(s: number) {
    if (s >= 80) return { color: "#065F46", bg: "#D1FAE5", ring: "#10B981" };
    if (s >= 50) return { color: "#1D4ED8", bg: "#DBEAFE", ring: "#3B82F6" };
    return { color: "#92400E", bg: "#FEF3C7", ring: "#F59E0B" };
  }

  const filters = [
    { label: "Všetky", value: 0 },
    { label: "30%+", value: 30 },
    { label: "50%+", value: 50 },
    { label: "70%+", value: 70 },
  ];

  return (
    <div style={{ maxWidth: "800px" }}>
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 4px", color: "var(--text-primary)" }}>
          Matching
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
          Automatické párovanie kupujúcich s nehnuteľnosťami
        </p>
      </div>

      {(focusObjednavkaId || focusKlientId) && (
        <div style={{
          marginBottom: "16px", padding: "10px 14px", background: "#EFF6FF",
          border: "1px solid #BFDBFE", borderRadius: "10px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
        }}>
          <span style={{ fontSize: "13px", color: "#1D4ED8" }}>
            🔎 Filtrované na: <strong>{focusKlientName || "konkrétnu objednávku"}</strong>
          </span>
          <button onClick={() => {
            setFocusObjednavkaId(null);
            setFocusKlientId(null);
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", "/matching");
            }
          }} style={{
            padding: "5px 12px", fontSize: "12px", fontWeight: "600",
            background: "#fff", color: "#1D4ED8", border: "1px solid #BFDBFE",
            borderRadius: "8px", cursor: "pointer",
          }}>
            Zrušiť filter
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="matching-stats" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "16px" }}>
        {[
          { label: "Kupujúci", value: klienti.length, icon: "👥" },
          { label: "Nehnuteľnosti", value: nehnutelnosti.length, icon: "🏠" },
          { label: "Zhody", value: filtered.length, icon: "🔗" },
        ].map(s => (
          <div key={s.label} style={{
            background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px",
            padding: "14px 16px", textAlign: "center",
          }}>
            <div style={{ fontSize: "18px", marginBottom: "4px" }}>{s.icon}</div>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-primary)" }}>{s.value}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        {filters.map(f => (
          <button key={f.value} onClick={() => setMinScore(f.value)} style={{
            padding: "6px 14px", borderRadius: "20px", fontSize: "12.5px", fontWeight: "600",
            border: "1px solid var(--border)", cursor: "pointer",
            background: minScore === f.value ? "#374151" : "var(--bg-surface)",
            color: minScore === f.value ? "#fff" : "var(--text-secondary)",
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "28px", marginBottom: "10px" }}>🔗</div>
          Počítam zhody...
        </div>
      )}

      {/* Empty states */}
      {!loading && klienti.length === 0 && (
        <div style={{ padding: "50px 20px", textAlign: "center", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "32px", marginBottom: "10px" }}>👥</div>
          <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>Žiadni kupujúci</div>
          <div style={{ fontSize: "13px" }}>Pridaj klientov typu &quot;kupujúci&quot; pre spárovanie.</div>
        </div>
      )}

      {!loading && klienti.length > 0 && nehnutelnosti.length === 0 && (
        <div style={{ padding: "50px 20px", textAlign: "center", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "32px", marginBottom: "10px" }}>🏠</div>
          <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>Žiadne nehnuteľnosti</div>
          <div style={{ fontSize: "13px" }}>Pridaj nehnuteľnosti do portfólia.</div>
        </div>
      )}

      {!loading && filtered.length === 0 && klienti.length > 0 && nehnutelnosti.length > 0 && (
        <div style={{ padding: "50px 20px", textAlign: "center", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "32px", marginBottom: "10px" }}>🔍</div>
          <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>Žiadne zhody</div>
          <div style={{ fontSize: "13px" }}>Skús znížiť minimálne skóre alebo pridaj viac dát.</div>
        </div>
      )}

      {/* Match cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {filtered.map((m, i) => {
          const sc = scoreColor(m.score);
          const isOpen = expanded === i;
          return (
            <div key={i} onClick={() => setExpanded(isOpen ? null : i)} style={{
              background: "var(--bg-surface)", border: `1px solid ${isOpen ? sc.ring : "var(--border)"}`,
              borderRadius: "14px", overflow: "hidden", cursor: "pointer",
              transition: "border-color 0.2s",
            }}>
              {/* Main row */}
              <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                {/* Score ring */}
                <div style={{
                  width: "50px", height: "50px", borderRadius: "50%",
                  background: `conic-gradient(${sc.ring} ${m.score * 3.6}deg, var(--border) 0deg)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <div style={{
                    width: "40px", height: "40px", borderRadius: "50%",
                    background: "var(--bg-surface)", display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: "13px", fontWeight: "800", color: sc.color,
                  }}>
                    {m.score}%
                  </div>
                </div>

                {/* Names */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: "700", fontSize: "14px", color: "var(--text-primary)" }}>
                      {m.klient.meno}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>↔</span>
                    <span style={{ fontWeight: "600", fontSize: "13px", color: "var(--accent)" }}>
                      {m.nehnutelnost.nazov}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>
                    {m.nehnutelnost.lokalita} · {m.nehnutelnost.cena != null ? `${m.nehnutelnost.cena.toLocaleString("sk")} €` : "—"}
                    {m.nehnutelnost.izby ? ` · ${m.nehnutelnost.izby}i` : ""}
                  </div>
                </div>

                {/* Reasons count */}
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", flexShrink: 0,
                }}>
                  <div style={{
                    fontSize: "11px", fontWeight: "600", color: sc.color,
                    background: sc.bg, padding: "3px 10px", borderRadius: "10px",
                  }}>
                    {m.reasons.length}× zhoda
                  </div>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5"
                    style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px" }}>
                  {/* Reasons */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                    {m.reasons.map(r => (
                      <span key={r} style={{
                        fontSize: "11.5px", fontWeight: "500",
                        padding: "4px 10px", borderRadius: "8px",
                        background: "#D1FAE5", color: "#065F46",
                      }}>
                        ✓ {r}
                      </span>
                    ))}
                  </div>

                  {/* Two columns: Klient | Nehnuteľnosť */}
                  <div className="matching-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    {/* Klient */}
                    <div style={{ background: "var(--bg-elevated)", borderRadius: "10px", padding: "12px" }}>
                      <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Kupujúci</div>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>{m.klient.meno}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px", fontSize: "12px", color: "var(--text-secondary)" }}>
                        {m.klient.telefon && <div>📞 {m.klient.telefon}</div>}
                        {m.klient.email && <div>✉️ {m.klient.email}</div>}
                        {m.klient.lokalita && <div>📍 {m.klient.lokalita}</div>}
                        {m.klient.rozpocet_max && <div>💰 max {fmtCena(m.klient.rozpocet_max)}</div>}
                        {m.objednavka?.druh && <div>🏠 Hľadá: {m.objednavka.druh}</div>}
                        {m.objednavka?.lokalita && (() => {
                          const raw = m.objednavka.lokalita;
                          const loks = Array.isArray(raw) ? raw : [...(raw.kraje ?? []), ...(raw.okresy ?? [])];
                          return loks.length > 0 ? <div>📍 Lokality: {loks.join(", ")}</div> : null;
                        })()}
                        {m.objednavka?.cena_do && <div>💰 Max: {fmtCena(m.objednavka.cena_do)}</div>}
                      </div>
                    </div>

                    {/* Nehnuteľnosť */}
                    <div style={{ background: "var(--bg-elevated)", borderRadius: "10px", padding: "12px" }}>
                      <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Nehnuteľnosť</div>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>{m.nehnutelnost.nazov}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px", fontSize: "12px", color: "var(--text-secondary)" }}>
                        <div>📍 {m.nehnutelnost.lokalita}</div>
                        <div>💰 {m.nehnutelnost.cena != null ? `${m.nehnutelnost.cena.toLocaleString("sk")} €` : "—"}</div>
                        {m.nehnutelnost.typ && <div>🏠 {m.nehnutelnost.typ}</div>}
                        {m.nehnutelnost.izby && <div>🛏️ {m.nehnutelnost.izby} izby</div>}
                        {m.nehnutelnost.plocha && <div>📐 {m.nehnutelnost.plocha} m²</div>}
                        {m.nehnutelnost.stav && <div>🔧 {m.nehnutelnost.stav}</div>}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <button onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/klienti/${m.klient.id}`;
                    }} style={{
                      flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid var(--border)",
                      background: "var(--bg-surface)", color: "var(--text-primary)",
                      fontSize: "12.5px", fontWeight: "600", cursor: "pointer",
                    }}>
                      👥 Karta klienta
                    </button>
                    <button onClick={(e) => {
                      e.stopPropagation();
                      if (m.klient.telefon) window.location.href = `tel:${m.klient.telefon}`;
                    }} style={{
                      flex: 1, padding: "10px", borderRadius: "10px", border: "none",
                      background: "#374151", color: "#fff",
                      fontSize: "12.5px", fontWeight: "600", cursor: "pointer",
                    }}>
                      📞 Kontaktovať
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .matching-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
