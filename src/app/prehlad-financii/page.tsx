"use client";

import { useEffect, useState } from "react";

type Zaznam = {
  id: string;
  typ: "prijem" | "vydaj";
  datum: string;
  popis: string | null;
  suma: number;
  zaplatene: boolean;
  kategoria: string | null;
  faktura_id: string | null;
};

const inputSt: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  background: "var(--bg-surface)",
  color: "var(--text-primary)",
  fontSize: "14px",
  width: "100%",
};

export default function PrehladPage() {
  const [list, setList] = useState<Zaznam[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesiac, setMesiac] = useState<string>(new Date().toISOString().slice(0, 7));

  // quick add
  const [typ, setTyp] = useState<"prijem" | "vydaj">("vydaj");
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [popis, setPopis] = useState("");
  const [suma, setSuma] = useState("");
  const [kategoria, setKategoria] = useState("");

  async function load() {
    setLoading(true);
    const r = await fetch("/api/prehlad");
    setList(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!suma) return;
    await fetch("/api/prehlad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        typ, datum, popis, suma: parseFloat(suma.replace(",", ".")) || 0, kategoria,
      }),
    });
    setPopis(""); setSuma(""); setKategoria("");
    load();
  }

  async function togglePaid(z: Zaznam) {
    await fetch("/api/prehlad", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: z.id, zaplatene: !z.zaplatene }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Zmazať záznam?")) return;
    await fetch(`/api/prehlad?id=${id}`, { method: "DELETE" });
    load();
  }

  const filtered = list.filter((z) => z.datum.startsWith(mesiac));

  const prijmy = filtered.filter((z) => z.typ === "prijem");
  const vydavky = filtered.filter((z) => z.typ === "vydaj");
  const sumPrijmy = prijmy.reduce((s, z) => s + Number(z.suma), 0);
  const sumPrijmyZaplat = prijmy.filter((z) => z.zaplatene).reduce((s, z) => s + Number(z.suma), 0);
  const sumVydavky = vydavky.reduce((s, z) => s + Number(z.suma), 0);
  const sumVydavkyZaplat = vydavky.filter((z) => z.zaplatene).reduce((s, z) => s + Number(z.suma), 0);
  const zisk = sumPrijmyZaplat - sumVydavkyZaplat;
  const dan15 = sumPrijmyZaplat * 0.15;

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#374151" }}>Prehľad financií</h1>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>Príjmy, výdavky, zisk a 15 % daň</div>
        </div>
        <input type="month" value={mesiac} onChange={(e) => setMesiac(e.target.value)} style={{ ...inputSt, width: "180px" }} />
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }} className="dash-grid">
        <Stat title="Príjmy (zaplatené)" value={`${sumPrijmyZaplat.toFixed(2)} €`} sub={`Celkom vystavené: ${sumPrijmy.toFixed(2)} €`} color="var(--success)" />
        <Stat title="Výdavky (zaplatené)" value={`${sumVydavkyZaplat.toFixed(2)} €`} sub={`Plánované: ${sumVydavky.toFixed(2)} €`} color="var(--danger)" />
        <Stat title="Zisk" value={`${zisk.toFixed(2)} €`} color={zisk >= 0 ? "var(--success)" : "var(--danger)"} />
        <Stat title="Daň 15 %" value={`${dan15.toFixed(2)} €`} sub="z prijatých platieb" color="var(--warning)" />
      </div>

      {/* Quick add */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px", marginBottom: "16px" }}>
        <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "10px" }}>Pridať záznam</div>
        <div style={{ display: "grid", gridTemplateColumns: "120px 140px 2fr 1fr 1fr auto", gap: "8px", alignItems: "center" }}>
          <select style={inputSt} value={typ} onChange={(e) => setTyp(e.target.value as "prijem" | "vydaj")}>
            <option value="vydaj">Výdavok</option>
            <option value="prijem">Príjem</option>
          </select>
          <input style={inputSt} type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
          <input style={inputSt} placeholder="Popis" value={popis} onChange={(e) => setPopis(e.target.value)} />
          <input style={inputSt} placeholder="Kategória" value={kategoria} onChange={(e) => setKategoria(e.target.value)} />
          <input style={inputSt} inputMode="decimal" placeholder="Suma €" value={suma} onChange={(e) => setSuma(e.target.value)} />
          <button onClick={add} style={{ background: "#374151", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 16px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>+ Pridať</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden" }}>
        <div className="table-header" style={{
          display: "grid",
          gridTemplateColumns: "100px 100px 1fr 1fr 120px 100px auto",
          gap: "12px",
          padding: "12px 16px",
          background: "var(--bg-elevated)",
          fontSize: "11px",
          fontWeight: 700,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}>
          <div>Typ</div>
          <div>Dátum</div>
          <div>Popis</div>
          <div>Kategória</div>
          <div style={{ textAlign: "right" }}>Suma</div>
          <div>Stav</div>
          <div></div>
        </div>
        {loading ? (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>Načítavam…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>Žiadne záznamy v tomto mesiaci.</div>
        ) : (
          filtered.map((z) => (
            <div key={z.id} className="table-row" style={{
              display: "grid",
              gridTemplateColumns: "100px 100px 1fr 1fr 120px 100px auto",
              gap: "12px",
              padding: "14px 16px",
              borderTop: "1px solid var(--border-subtle)",
              fontSize: "13px",
              alignItems: "center",
              background: z.zaplatene
                ? (z.typ === "prijem" ? "rgba(52,199,89,0.04)" : "rgba(255,59,48,0.03)")
                : "transparent",
            }}>
              <div>
                <span style={{
                  fontSize: "11px", fontWeight: 700,
                  background: z.typ === "prijem" ? "var(--success-light)" : "var(--danger-light)",
                  color: z.typ === "prijem" ? "var(--success)" : "var(--danger)",
                  padding: "3px 8px", borderRadius: "999px",
                }}>{z.typ === "prijem" ? "Príjem" : "Výdaj"}</span>
              </div>
              <div className="table-cell-hide">{z.datum}</div>
              <div style={{ fontWeight: 600 }}>{z.popis || "—"}</div>
              <div className="table-cell-hide" style={{ color: "var(--text-secondary)" }}>{z.kategoria || "—"}</div>
              <div style={{ textAlign: "right", fontWeight: 700, color: z.typ === "prijem" ? "var(--success)" : "var(--danger)" }}>
                {z.typ === "prijem" ? "+" : "−"}{Number(z.suma).toFixed(2)} €
              </div>
              <div>
                <button onClick={() => togglePaid(z)} style={{
                  background: z.zaplatene ? "var(--success-light)" : "var(--bg-elevated)",
                  color: z.zaplatene ? "var(--success)" : "var(--text-secondary)",
                  border: "none", borderRadius: "999px", padding: "4px 10px",
                  fontSize: "11px", fontWeight: 700, cursor: "pointer",
                }}>
                  {z.zaplatene ? "✓ Zaplatené" : "Nezapl."}
                </button>
              </div>
              <div>
                <button onClick={() => remove(z.id)} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "12px", color: "var(--danger)" }}>×</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ title, value, sub, color }: { title: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px 18px" }}>
      <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: "22px", fontWeight: 700, color: color || "#374151", marginTop: "4px" }}>{value}</div>
      {sub && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{sub}</div>}
    </div>
  );
}
