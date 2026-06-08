"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { skoreUroven, vypocitajSkore } from "@/lib/matching";
import type { ObjednavkaForMatch, NehnutelnostForMatch, KlientForMatch } from "@/lib/matching";
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

// Mapovanie DB záznamov na matching typy. lat/lng nie sú v ručných database.types
// (migrácia 086 ich pridala len do DB), ale dáta zo `select *` ich obsahujú.
function toNehForMatch(n: Nehnutelnost): NehnutelnostForMatch {
  const geo = n as Nehnutelnost & { lat?: number | null; lng?: number | null };
  return {
    id: n.id, klient_id: n.klient_id, typ: n.typ, cena: n.cena,
    plocha: n.plocha, izby: n.izby, lokalita: n.lokalita,
    kraj: n.kraj, okres: n.okres, status: n.status,
    lat: geo.lat ?? null, lng: geo.lng ?? null,
  };
}

function toObjForMatch(o: Objednavka): ObjednavkaForMatch {
  const geo = o as Objednavka & { lat?: number | null; lng?: number | null };
  return {
    id: o.id, klient_id: o.klient_id, druh: o.druh,
    poziadavky: o.poziadavky, lokalita: o.lokalita,
    cena_od: o.cena_od, cena_do: o.cena_do,
    lat: geo.lat ?? null, lng: geo.lng ?? null,
  };
}

// Jeden zdroj pravdy: ten istý vypocitajSkore ako widgety + API routes (predtým
// mala stránka vlastný algoritmus s inými číslami). Klient bez objednávky →
// pseudo-objednávka z profilu (lokalita, rozpočet), aby sa matching zobrazil na
// každom kupujúcom (Aleš 2026-06-06).
function calcMatch(k: Klient, n: Nehnutelnost, objednavky: Objednavka[]): { score: number; reasons: string[]; obj: Objednavka | null } {
  if (k.typ !== "kupujuci" && k.typ !== "oboje") return { score: 0, reasons: [], obj: null };

  const obj = objednavky.find(o => o.klient_id === k.id) ?? null;
  // Bez objednávky aj bez lokality klienta by sa párovalo len cez rozpočet →
  // 30 % na všetko v cene (falošné zhody zaplavia /matching). Vtedy nepárujeme.
  if (!obj && !k.lokalita) return { score: 0, reasons: [], obj: null };
  const klientForMatch: KlientForMatch = { id: k.id, lokalita: k.lokalita, rozpocet_max: k.rozpocet_max };
  const objForMatch: ObjednavkaForMatch = obj
    ? toObjForMatch(obj)
    : { id: `profil-${k.id}`, klient_id: k.id, druh: null, poziadavky: null, lokalita: null, cena_od: null, cena_do: null };

  const { score, reasons } = vypocitajSkore(objForMatch, toNehForMatch(n), klientForMatch);
  return { score, reasons, obj };
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
    const u = skoreUroven(s);
    if (u === "vyborna") return { color: "var(--text-primary)", bg: "#D1FAE5", ring: "#10B981" };
    if (u === "dobra") return { color: "var(--text-secondary)", bg: "#FEF3C7", ring: "#F59E0B" };
    return { color: "var(--text-secondary)", bg: "#F3F4F6", ring: "#9CA3AF" };
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
          marginBottom: "16px", padding: "10px 14px", background: "var(--bg-elevated)",
          border: "1px solid var(--border)", borderRadius: "10px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
        }}>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
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
            background: "#fff", color: "var(--text-secondary)", border: "1px solid var(--border)",
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
                    {!m.objednavka && (
                      <span style={{ fontSize: "10px", fontWeight: "600", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "2px 7px", borderRadius: "6px", border: "1px solid var(--border)" }}>
                        z profilu — doplň objednávku
                      </span>
                    )}
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
