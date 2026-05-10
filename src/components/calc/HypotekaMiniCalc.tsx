"use client";

import { useState, useMemo } from "react";

function calcSplatka(istina: number, rocnyUrok: number, roky: number): number {
  if (!istina || !roky) return 0;
  if (!rocnyUrok) return istina / (roky * 12);
  const r = rocnyUrok / 100 / 12;
  const n = roky * 12;
  return (istina * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

const fmt = (n: number) => Math.round(n).toLocaleString("sk");

type Props = { cena: number };

export function HypotekaMiniCalc({ cena }: Props) {
  const [vlastne, setVlastne] = useState(Math.round(cena * 0.1));
  const [urok, setUrok] = useState(4.5);
  const [doba, setDoba] = useState(30);

  const { mesacna, celkom, uroky } = useMemo(() => {
    const istina = Math.max(0, cena - vlastne);
    const m = calcSplatka(istina, urok, doba);
    const c = m * doba * 12;
    return { mesacna: m, celkom: c, uroky: c - istina };
  }, [cena, vlastne, urok, doba]);

  const inputSt: React.CSSProperties = {
    width: "100%", padding: "8px 10px", background: "var(--bg-surface)",
    border: "1px solid var(--border)", borderRadius: "8px",
    fontSize: "13px", color: "var(--text-primary)", outline: "none",
  };
  const labelSt: React.CSSProperties = {
    fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "4px", display: "block",
  };

  return (
    <section style={{
      border: "1px solid #BFDBFE", background: "#EFF6FF",
      borderRadius: "12px", padding: "14px 16px",
    }}>
      <div style={{ fontSize: "13px", fontWeight: "700", color: "#1E3A5F", marginBottom: "12px" }}>
        🏦 Indikatívna splátka hypotéky ({fmt(cena)} €)
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "10px" }}>
        <label>
          <span style={labelSt}>Vlastné zdroje (€)</span>
          <input type="number" value={vlastne} onChange={e => setVlastne(Number(e.target.value))} style={inputSt} />
        </label>
        <label>
          <span style={labelSt}>Úrok (%)</span>
          <input type="number" step="0.1" value={urok} onChange={e => setUrok(Number(e.target.value))} style={inputSt} />
        </label>
        <label>
          <span style={labelSt}>Doba (roky)</span>
          <input type="number" value={doba} onChange={e => setDoba(Number(e.target.value))} style={inputSt} />
        </label>
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        background: "var(--bg-surface)", borderRadius: "8px", padding: "10px 14px",
        fontSize: "13px", color: "var(--text-primary)",
      }}>
        <span>📊 Mesačná splátka: <strong style={{ color: "#1D4ED8" }}>{fmt(mesacna)} €</strong></span>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          Celkom: {fmt(celkom)} € · Úroky: {fmt(uroky)} €
        </span>
      </div>
      <a
        href={`/nastroje?tab=kalkulator&cena=${cena}&vlastne=${vlastne}&urok=${urok}&doba=${doba}`}
        style={{ display: "block", marginTop: "8px", fontSize: "11px", color: "#3B82F6", textDecoration: "none", textAlign: "right" }}
      >
        Plná kalkulačka →
      </a>
    </section>
  );
}
