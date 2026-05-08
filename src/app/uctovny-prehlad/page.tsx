"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

type Faktura = {
  id: string;
  cislo_faktury: string;
  datum_vystavenia: string;
  suma_celkom: number;
  zaplatene: boolean;
  odberatel_snapshot: { nazov?: string } | null;
};
type Zaznam = {
  id: string;
  typ: "prijem" | "vydaj";
  datum: string;
  popis: string | null;
  suma: number;
  zaplatene: boolean;
};

export default function UctovnyPrehladPage() {
  const { user } = useAuth();
  const [faktury, setFaktury] = useState<Faktura[]>([]);
  const [prehlad, setPrehlad] = useState<Zaznam[]>([]);
  const [rok, setRok] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/faktury?user_id=${user.id}`).then((r) => r.json()).then((d) => setFaktury(Array.isArray(d) ? d : []));
    fetch("/api/prehlad").then((r) => r.json()).then(setPrehlad);
  }, [user?.id]);

  const yearStr = String(rok);
  const fY = faktury.filter((f) => f.datum_vystavenia.startsWith(yearStr));
  const pY = prehlad.filter((z) => z.datum.startsWith(yearStr));

  // Mesačné dáta
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const monthly = months.map((m) => {
    const key = `${rok}-${m}`;
    const fakt = faktury.filter((f) => f.datum_vystavenia.startsWith(key));
    const zazn = prehlad.filter((z) => z.datum.startsWith(key));
    const prijmy = zazn.filter((z) => z.typ === "prijem" && z.zaplatene).reduce((s, z) => s + Number(z.suma), 0);
    const vydavky = zazn.filter((z) => z.typ === "vydaj" && z.zaplatene).reduce((s, z) => s + Number(z.suma), 0);
    return {
      mesiac: m,
      label: new Date(2000, parseInt(m) - 1, 1).toLocaleDateString("sk-SK", { month: "short" }),
      faktur: fakt.length,
      vystavene: fakt.reduce((s, f) => s + Number(f.suma_celkom), 0),
      prijmy,
      vydavky,
      zisk: prijmy - vydavky,
    };
  });

  // Celoročné súčty
  const totalVystavene = fY.reduce((s, f) => s + Number(f.suma_celkom), 0);
  const totalZaplatene = fY.filter((f) => f.zaplatene).reduce((s, f) => s + Number(f.suma_celkom), 0);
  const totalNezaplat = totalVystavene - totalZaplatene;
  const prijmyZapl = pY.filter((z) => z.typ === "prijem" && z.zaplatene).reduce((s, z) => s + Number(z.suma), 0);
  const vydavkyZapl = pY.filter((z) => z.typ === "vydaj" && z.zaplatene).reduce((s, z) => s + Number(z.suma), 0);
  const zisk = prijmyZapl - vydavkyZapl;
  const dan15 = prijmyZapl * 0.15;
  const ziskPoDani = zisk - dan15;

  const maxStlpec = Math.max(...monthly.map((m) => Math.max(m.prijmy, m.vydavky)), 1);

  // Top 5 nezaplatených faktúr
  const nezaplaFakt = fY.filter((f) => !f.zaplatene).sort((a, b) => Number(b.suma_celkom) - Number(a.suma_celkom)).slice(0, 5);

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#374151" }}>Účtovný prehľad</h1>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>Automatický celoročný prehľad fakturácie a financií</div>
        </div>
        <select value={rok} onChange={(e) => setRok(Number(e.target.value))} style={{ padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "10px", background: "var(--bg-surface)", fontSize: "14px", fontWeight: 600 }}>
          {[0, 1, 2].map((d) => {
            const y = new Date().getFullYear() - d;
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }} className="dash-grid">
        <Kpi title="Vystavené faktúry" value={`${totalVystavene.toFixed(2)} €`} sub={`${fY.length} ks`} />
        <Kpi title="Zaplatené" value={`${totalZaplatene.toFixed(2)} €`} color="var(--success)" sub={`${fY.filter(f => f.zaplatene).length} ks`} />
        <Kpi title="Nezaplatené" value={`${totalNezaplat.toFixed(2)} €`} color="var(--warning)" sub={`${fY.filter(f => !f.zaplatene).length} ks`} />
        <Kpi title="Zisk po dani 15 %" value={`${ziskPoDani.toFixed(2)} €`} color={ziskPoDani >= 0 ? "var(--success)" : "var(--danger)"} sub={`Daň: ${dan15.toFixed(2)} €`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }} className="dash-grid">
        <Kpi title="Prijaté platby" value={`${prijmyZapl.toFixed(2)} €`} color="var(--success)" />
        <Kpi title="Výdavky" value={`${vydavkyZapl.toFixed(2)} €`} color="var(--danger)" />
        <Kpi title="Zisk pred daňou" value={`${zisk.toFixed(2)} €`} color={zisk >= 0 ? "var(--success)" : "var(--danger)"} />
      </div>

      {/* Mesačný graf */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em" }}>Mesačný prehľad {rok}</div>
          <div style={{ display: "flex", gap: "12px", fontSize: "11px", color: "var(--text-secondary)" }}>
            <span><span style={{ display: "inline-block", width: "10px", height: "10px", background: "var(--success)", borderRadius: "2px", marginRight: "4px" }} />Príjmy</span>
            <span><span style={{ display: "inline-block", width: "10px", height: "10px", background: "var(--danger)", borderRadius: "2px", marginRight: "4px" }} />Výdavky</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "8px", alignItems: "end", height: "180px" }}>
          {monthly.map((m) => (
            <div key={m.mesiac} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", height: "100%" }}>
              <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: "2px", width: "100%", justifyContent: "center" }}>
                <div title={`Príjmy: ${m.prijmy.toFixed(2)} €`} style={{ width: "40%", height: `${(m.prijmy / maxStlpec) * 100}%`, background: "var(--success)", borderRadius: "3px 3px 0 0", minHeight: m.prijmy > 0 ? "2px" : "0" }} />
                <div title={`Výdavky: ${m.vydavky.toFixed(2)} €`} style={{ width: "40%", height: `${(m.vydavky / maxStlpec) * 100}%`, background: "var(--danger)", borderRadius: "3px 3px 0 0", minHeight: m.vydavky > 0 ? "2px" : "0" }} />
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600 }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Mesačná tabuľka */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden", marginBottom: "20px" }}>
        <div className="table-header" style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr",
          gap: "12px", padding: "12px 16px",
          background: "var(--bg-elevated)", fontSize: "11px", fontWeight: 700,
          color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em",
        }}>
          <div>Mesiac</div>
          <div>Faktúr</div>
          <div style={{ textAlign: "right" }}>Vystavené</div>
          <div style={{ textAlign: "right" }}>Príjmy</div>
          <div style={{ textAlign: "right" }}>Výdavky</div>
          <div style={{ textAlign: "right" }}>Zisk</div>
        </div>
        {monthly.map((m) => (
          <div key={m.mesiac} className="table-row" style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr",
            gap: "12px", padding: "12px 16px",
            borderTop: "1px solid var(--border-subtle)", fontSize: "13px", alignItems: "center",
          }}>
            <div style={{ fontWeight: 600, color: "#374151" }}>{m.label}</div>
            <div className="table-cell-hide">{m.faktur}</div>
            <div style={{ textAlign: "right" }} className="table-cell-hide">{m.vystavene.toFixed(2)} €</div>
            <div style={{ textAlign: "right", color: "var(--success)", fontWeight: 600 }}>{m.prijmy.toFixed(2)} €</div>
            <div style={{ textAlign: "right", color: "var(--danger)", fontWeight: 600 }}>{m.vydavky.toFixed(2)} €</div>
            <div style={{ textAlign: "right", fontWeight: 700, color: m.zisk >= 0 ? "var(--success)" : "var(--danger)" }}>{m.zisk.toFixed(2)} €</div>
          </div>
        ))}
      </div>

      {/* Top nezaplatené */}
      {nezaplaFakt.length > 0 && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#374151", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Top nezaplatené faktúry</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {nezaplaFakt.map((f) => (
              <Link key={f.id} href={`/faktury/${f.id}`} style={{
                display: "grid", gridTemplateColumns: "1fr 2fr 1fr auto",
                gap: "12px", padding: "12px 14px",
                background: "var(--bg-elevated)", borderRadius: "10px",
                fontSize: "13px", alignItems: "center", textDecoration: "none", color: "var(--text-primary)",
              }}>
                <div style={{ fontWeight: 600, color: "#374151" }}>{f.cislo_faktury}</div>
                <div className="table-cell-hide">{f.odberatel_snapshot?.nazov || "—"}</div>
                <div className="table-cell-hide">{f.datum_vystavenia}</div>
                <div style={{ fontWeight: 700, color: "var(--warning)" }}>{Number(f.suma_celkom).toFixed(2)} €</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ title, value, sub, color }: { title: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px 18px" }}>
      <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: "22px", fontWeight: 700, color: color || "#374151", marginTop: "4px" }}>{value}</div>
      {sub && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{sub}</div>}
    </div>
  );
}
