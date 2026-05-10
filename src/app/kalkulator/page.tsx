"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function calcSplatka(istina: number, rocnyUrok: number, roky: number) {
  if (!istina || !roky) return 0;
  if (!rocnyUrok) return istina / (roky * 12);
  const r = rocnyUrok / 100 / 12;
  const n = roky * 12;
  return (istina * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function fmt(n: number) {
  return n.toLocaleString("sk", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const INPUT: React.CSSProperties = {
  width: "100%", padding: "10px 12px",
  background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: "8px", fontSize: "14px", color: "var(--text-primary)", outline: "none",
};
const LABEL: React.CSSProperties = {
  fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)",
  marginBottom: "5px", display: "block",
};

function KalkulatorInner() {
  const sp = useSearchParams();
  // Hypotéka — pre-fill z URL params (z HypotekaMiniCalc deep-link)
  const [cenaBytu, setCenaBytu] = useState(sp.get("cena") || "200000");
  const [vlastneZdroje, setVlastneZdroje] = useState(sp.get("vlastne") || "40000");
  const [urok, setUrok] = useState(sp.get("urok") || "4.5");
  const [roky, setRoky] = useState(sp.get("doba") || "30");

  // Provízia
  const [predajnaCena, setPredajnaCena] = useState(sp.get("cena") || "200000");
  const [proviziaPercento, setProviziaPercento] = useState("3");
  const [naklady, setNaklady] = useState("500");

  const istina = (Number(cenaBytu) || 0) - (Number(vlastneZdroje) || 0);
  const splatka = calcSplatka(istina, Number(urok), Number(roky));
  const celkomZaplatene = splatka * Number(roky) * 12;
  const celkomUrок = celkomZaplatene - istina;

  const proviziaEuro = ((Number(predajnaCena) || 0) * (Number(proviziaPercento) || 0)) / 100;
  const cistyZisk = proviziaEuro - (Number(naklady) || 0);

  return (
    <div style={{ maxWidth: "900px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 4px", color: "var(--text-primary)" }}>Finančná Kalkulačka</h2>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>Hypotéka, provízia a čistý zisk</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

        {/* Hypotéka */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
            <div style={{ fontWeight: "700", fontSize: "15px", color: "var(--text-primary)" }}>🏦 Splátka Hypotéky</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>Mesačná splátka pri aktuálnom úroku</div>
          </div>
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={LABEL}>Cena bytu / nehnuteľnosti (€)</label>
              <input style={INPUT} type="number" value={cenaBytu} onChange={e => setCenaBytu(e.target.value)} />
            </div>
            <div>
              <label style={LABEL}>Vlastné zdroje / záloha (€)</label>
              <input style={INPUT} type="number" value={vlastneZdroje} onChange={e => setVlastneZdroje(e.target.value)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={LABEL}>Úroková sadzba (%)</label>
                <input style={INPUT} type="number" step="0.1" value={urok} onChange={e => setUrok(e.target.value)} />
              </div>
              <div>
                <label style={LABEL}>Doba splácania (roky)</label>
                <input style={INPUT} type="number" value={roky} onChange={e => setRoky(e.target.value)} />
              </div>
            </div>

            {/* Results */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Výška úveru</span>
                <span style={{ fontWeight: "600", fontSize: "13px" }}>{istina.toLocaleString("sk")} €</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--accent-light)", borderRadius: "8px" }}>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--accent)" }}>Mesačná splátka</span>
                <span style={{ fontSize: "22px", fontWeight: "800", color: "var(--accent)" }}>{fmt(splatka)} €</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>Celkom zaplatené</span>
                <span style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>{fmt(celkomZaplatene)} €</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>Z toho úroky</span>
                <span style={{ fontSize: "12.5px", color: "var(--danger)" }}>{fmt(celkomUrок)} €</span>
              </div>
            </div>
          </div>
        </div>

        {/* Provízia */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
            <div style={{ fontWeight: "700", fontSize: "15px", color: "var(--text-primary)" }}>💰 Provízia & Zisk RK</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>Výpočet výnosu z predaja</div>
          </div>
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={LABEL}>Predajná cena nehnuteľnosti (€)</label>
              <input style={INPUT} type="number" value={predajnaCena} onChange={e => setPredajnaCena(e.target.value)} />
            </div>
            <div>
              <label style={LABEL}>Provízna sadzba (%)</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input style={INPUT} type="number" step="0.5" value={proviziaPercento} onChange={e => setProviziaPercento(e.target.value)} />
                <div style={{ display: "flex", gap: "4px" }}>
                  {["2", "3", "4"].map(p => (
                    <button key={p} onClick={() => setProviziaPercento(p)}
                      style={{ padding: "10px 10px", border: "1px solid var(--border)", borderRadius: "8px", background: proviziaPercento === p ? "var(--accent)" : "var(--bg-elevated)", color: proviziaPercento === p ? "#fff" : "var(--text-secondary)", fontSize: "12.5px", fontWeight: "600", cursor: "pointer" }}>
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label style={LABEL}>Náklady (marketing, admin...) (€)</label>
              <input style={INPUT} type="number" value={naklady} onChange={e => setNaklady(e.target.value)} />
            </div>

            {/* Results */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Hrubá provízia</span>
                <span style={{ fontWeight: "600", fontSize: "13px" }}>{fmt(proviziaEuro)} €</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Náklady</span>
                <span style={{ fontWeight: "600", fontSize: "13px", color: "var(--danger)" }}>- {fmt(Number(naklady))} €</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: cistyZisk >= 0 ? "#D1FAE5" : "#FEE2E2", borderRadius: "8px" }}>
                <span style={{ fontSize: "14px", fontWeight: "700", color: cistyZisk >= 0 ? "var(--success)" : "var(--danger)" }}>Čistý zisk</span>
                <span style={{ fontSize: "22px", fontWeight: "800", color: cistyZisk >= 0 ? "var(--success)" : "var(--danger)" }}>{fmt(cistyZisk)} €</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>% z predajnej ceny</span>
                <span style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>{Number(predajnaCena) ? fmt((cistyZisk / Number(predajnaCena)) * 100) : "0.00"}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick presets */}
      <div style={{ marginTop: "20px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 20px" }}>
        <div style={{ fontWeight: "600", fontSize: "13.5px", color: "var(--text-primary)", marginBottom: "12px" }}>Rýchle prednastavenia</div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {[
            { label: "Byt 150k€, 3%", cena: "150000", prov: "3" },
            { label: "Byt 200k€, 3%", cena: "200000", prov: "3" },
            { label: "Dom 300k€, 2.5%", cena: "300000", prov: "2.5" },
            { label: "Dom 400k€, 2%", cena: "400000", prov: "2" },
          ].map(p => (
            <button key={p.label} onClick={() => { setPredajnaCena(p.cena); setCenaBytu(p.cena); setProviziaPercento(p.prov); }}
              style={{ padding: "7px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12.5px", cursor: "pointer", color: "var(--text-secondary)", fontWeight: "500" }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function KalkulatorPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Načítavam...</div>}>
      <KalkulatorInner />
    </Suspense>
  );
}
