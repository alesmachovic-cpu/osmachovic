"use client";

import { useState, useEffect } from "react";
import { MatchingWidget } from "./MatchingWidget";
import { CalculatorWidget } from "./CalculatorWidget";

type Props = {
  klient: { id: string; typ: string };
  nehnutelnostId?: string | null;
  objednavkaId?: string | null;
  predajnaCena?: number | null;
  cenaDo?: number | null;
  cenaOd?: number | null;
  onPlanovatObhliadku?: (matchKlientId: string, matchMeno: string, matchTel?: string | null) => void;
};

const panelSt: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  overflow: "hidden",
};

const sectionSt: React.CSSProperties = {
  borderBottom: "1px solid var(--border)",
};

export function ClientInsightPanel({ klient, nehnutelnostId, objednavkaId, predajnaCena, cenaDo, cenaOd, onPlanovatObhliadku }: Props) {
  const [wide, setWide] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const check = () => setWide(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const content = (
    <div style={panelSt}>
      <div style={sectionSt}>
        <MatchingWidget
          klientTyp={klient.typ}
          nehnutelnostId={nehnutelnostId}
          objednavkaId={objednavkaId}
          klientId={klient.id}
          onPlanovatObhliadku={onPlanovatObhliadku}
        />
      </div>
      <CalculatorWidget
        klientTyp={klient.typ}
        klientId={klient.id}
        predajnaCena={predajnaCena}
        cenaDo={cenaDo}
        cenaOd={cenaOd}
      />
    </div>
  );

  if (wide) {
    return (
      <div style={{
        position: "sticky",
        top: "80px",
        maxHeight: "calc(100vh - 100px)",
        overflowY: "auto",
      }}>
        {content}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: "16px" }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 14px", background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: open ? "12px 12px 0 0" : "12px", cursor: "pointer", fontSize: "13px",
        fontWeight: 600, color: "var(--text-primary)",
      }}>
        <span>🎯 Matching & Kalkulačka</span>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
          <div style={sectionSt}>
            <MatchingWidget
              klientTyp={klient.typ}
              nehnutelnostId={nehnutelnostId}
              objednavkaId={objednavkaId}
              klientId={klient.id}
              onPlanovatObhliadku={onPlanovatObhliadku}
            />
          </div>
          <CalculatorWidget
            klientTyp={klient.typ}
            klientId={klient.id}
            predajnaCena={predajnaCena}
            cenaDo={cenaDo}
            cenaOd={cenaOd}
          />
        </div>
      )}
    </div>
  );
}
