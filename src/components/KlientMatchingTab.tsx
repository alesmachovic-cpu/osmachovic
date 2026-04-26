"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { calcMatch, fmtCena, type MatchObjednavka } from "@/lib/matching";
import type { Klient, Nehnutelnost } from "@/lib/database.types";

interface ScoredNehn {
  nehnutelnost: Nehnutelnost;
  score: number;
  reasons: string[];
}

/**
 * Tab "Zhody" v karte klienta-kupujúceho — automaticky vypočíta najlepšie
 * vyhovujúce nehnuteľnosti z portfólia podľa rozpočtu, lokality, typu, izieb.
 *
 * Zobrazí top 10 zoradené podľa skóre. Maklér klikom otvorí detail nehnuteľnosti
 * alebo pošle klientovi prehľad.
 */
export default function KlientMatchingTab({ klient }: { klient: Klient }) {
  const router = useRouter();
  const [items, setItems] = useState<ScoredNehn[]>([]);
  const [loading, setLoading] = useState(true);
  const [minScore, setMinScore] = useState(30);

  useEffect(() => {
    let stopped = false;
    async function load() {
      setLoading(true);
      const [{ data: ns }, { data: os }] = await Promise.all([
        supabase.from("nehnutelnosti").select("*").neq("stav", "predane").order("created_at", { ascending: false }),
        supabase.from("objednavky").select("id, klient_id, druh, poziadavky, lokalita, cena_do").eq("klient_id", klient.id),
      ]);
      if (stopped) return;
      const nehn = (ns ?? []) as Nehnutelnost[];
      const obj = (os ?? []) as MatchObjednavka[];
      const scored = nehn.map(n => {
        const r = calcMatch(klient, n, obj);
        return { nehnutelnost: n, score: r.score, reasons: r.reasons };
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);
      setItems(scored);
      setLoading(false);
    }
    load();
    return () => { stopped = true; };
  }, [klient]);

  const visible = items.filter(i => i.score >= minScore).slice(0, 20);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
        Hľadám zhody…
      </div>
    );
  }

  if (klient.typ !== "kupujuci" && klient.typ !== "oboje") {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
        Tento klient nie je kupujúci. Matching sa robí len pre kupujúcich a klientov s typom „oboje".
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <div style={{ fontSize: "36px", marginBottom: "8px" }}>🔍</div>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
          Žiadne zhody
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          {klient.rozpocet_max
            ? "Aktuálne v portfóliu nemáme nehnuteľnosti čo by zodpovedali objednávke. Vráť sa keď príde nový inzerát."
            : "Klient ešte nemá vyplnenú objednávku ani rozpočet — doplň údaje a zhody sa objavia."
          }
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Filter — minimum skóre */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
          {visible.length === items.length
            ? `${items.length} ${items.length === 1 ? "zhoda" : "zhôd"}`
            : `${visible.length} z ${items.length} (min. skóre ${minScore})`}
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {[30, 50, 70].map(t => (
            <button key={t} onClick={() => setMinScore(t)} style={{
              padding: "4px 10px", borderRadius: "6px",
              background: minScore === t ? "#374151" : "var(--bg-elevated)",
              color: minScore === t ? "#fff" : "var(--text-secondary)",
              border: "1px solid " + (minScore === t ? "#374151" : "var(--border)"),
              fontSize: "11px", fontWeight: 600, cursor: "pointer",
            }}>{t}+</button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {visible.map(({ nehnutelnost: n, score, reasons }) => {
          const scoreColor = score >= 70 ? "#10B981" : score >= 50 ? "#F59E0B" : "#6B7280";
          return (
            <div key={n.id} style={{
              padding: "14px", background: "var(--bg-elevated)",
              border: "1px solid var(--border)", borderRadius: "10px",
              display: "flex", gap: "14px", alignItems: "flex-start", flexWrap: "wrap",
            }}>
              {/* Score circle */}
              <div style={{
                width: "52px", height: "52px", borderRadius: "50%",
                background: `${scoreColor}15`, color: scoreColor,
                border: `2px solid ${scoreColor}40`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px", fontWeight: 700, flexShrink: 0,
              }}>{score}</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                  {String(n.nazov || "Bez názvu")}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
                  {n.lokalita && <span>📍 {String(n.lokalita)}</span>}
                  {n.cena != null && <span>💰 {fmtCena(Number(n.cena))}</span>}
                  {n.izby != null && <span>🚪 {n.izby}-izb</span>}
                  {n.plocha != null && <span>📐 {n.plocha} m²</span>}
                </div>
                {reasons.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" }}>
                    {reasons.map((r, i) => (
                      <span key={i} style={{
                        fontSize: "10px", padding: "2px 8px", borderRadius: "10px",
                        background: `${scoreColor}10`, color: scoreColor, fontWeight: 600,
                      }}>{r}</span>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={() => router.push(`/portfolio?id=${n.id}`)} style={{
                padding: "6px 12px", background: "var(--bg-surface)",
                border: "1px solid var(--border)", borderRadius: "8px",
                fontSize: "12px", fontWeight: 600, color: "var(--text-primary)",
                cursor: "pointer", flexShrink: 0,
              }}>Otvoriť →</button>
            </div>
          );
        })}
      </div>

      {visible.length === 0 && items.length > 0 && (
        <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
          Žiadna zhoda nepresahuje min. skóre {minScore}. Zníž prahovú hodnotu vyššie.
        </div>
      )}
    </div>
  );
}
