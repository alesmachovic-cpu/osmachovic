"use client";

import { useState, useMemo } from "react";

const fmt = (n: number) => Math.round(n).toLocaleString("sk");

type Props = { cena: number; defaultSadzba?: number; defaultNaklady?: number };

export function ProviziaMiniCalc({ cena, defaultSadzba = 3, defaultNaklady = 500 }: Props) {
  const [sadzba, setSadzba] = useState(defaultSadzba);
  const [naklady, setNaklady] = useState(defaultNaklady);

  const { hruba, cista, pct } = useMemo(() => {
    const h = cena * (sadzba / 100);
    const c = h - naklady;
    return { hruba: h, cista: c, pct: cena > 0 ? (c / cena) * 100 : 0 };
  }, [cena, sadzba, naklady]);

  return (
    <section style={{
      border: "1px solid #A7F3D0", background: "#ECFDF5",
      borderRadius: "12px", padding: "14px 16px",
    }}>
      <div style={{ fontSize: "13px", fontWeight: "700", color: "#065F46", marginBottom: "12px" }}>
        💰 Provízia z predaja ({fmt(cena)} €)
      </div>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Sadzba:</span>
        {[2, 3, 4].map(s => (
          <button key={s} onClick={() => setSadzba(s)} style={{
            padding: "5px 12px", fontSize: "12px", borderRadius: "7px",
            background: sadzba === s ? "#065F46" : "var(--bg-surface)",
            color: sadzba === s ? "#fff" : "var(--text-primary)",
            border: `1px solid ${sadzba === s ? "#065F46" : "var(--border)"}`,
            cursor: "pointer", fontWeight: sadzba === s ? "700" : "400",
          }}>{s}%</button>
        ))}
        <span style={{ fontSize: "12px", color: "var(--text-secondary)", marginLeft: "6px" }}>Náklady:</span>
        <input
          type="number"
          value={naklady}
          onChange={e => setNaklady(Number(e.target.value))}
          style={{
            width: "80px", padding: "5px 8px", fontSize: "12px",
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "7px", color: "var(--text-primary)", outline: "none",
          }}
        />
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>€</span>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        background: "var(--bg-surface)", borderRadius: "8px", padding: "10px 14px", gap: "4px",
        fontSize: "13px",
      }}>
        <div style={{ color: "var(--text-secondary)" }}>Hrubá:<br /><strong style={{ color: "var(--text-primary)" }}>{fmt(hruba)} €</strong></div>
        <div style={{ color: "var(--text-muted)" }}>Náklady:<br /><span>−{fmt(naklady)} €</span></div>
        <div style={{ color: "#065F46" }}>🟢 Čistá:<br /><strong>{fmt(cista)} €</strong></div>
      </div>
      <div style={{ textAlign: "right", fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
        {pct.toFixed(2)} % z predajnej ceny
      </div>
    </section>
  );
}
