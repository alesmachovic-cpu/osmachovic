"use client";

import { useEffect, useState } from "react";

type Naklad = {
  id: string;
  nazov: string;
  suma: number;
  den_splatnosti: number;
  kategoria: string | null;
  aktivny: boolean;
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

export default function PravidelneNakladyPage() {
  const [list, setList] = useState<Naklad[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const [nazov, setNazov] = useState("");
  const [suma, setSuma] = useState("");
  const [den, setDen] = useState("1");
  const [kat, setKat] = useState("");

  async function load() {
    setLoading(true);
    const r = await fetch("/api/pravidelne-naklady");
    setList(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!nazov.trim() || !suma) return;
    await fetch("/api/pravidelne-naklady", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nazov,
        suma: parseFloat(suma.replace(",", ".")) || 0,
        den_splatnosti: parseInt(den) || 1,
        kategoria: kat,
      }),
    });
    setNazov(""); setSuma(""); setDen("1"); setKat("");
    load();
  }

  async function toggleAktivny(n: Naklad) {
    await fetch("/api/pravidelne-naklady", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: n.id, aktivny: !n.aktivny }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Zmazať pravidelný náklad?")) return;
    await fetch(`/api/pravidelne-naklady?id=${id}`, { method: "DELETE" });
    load();
  }

  async function runNow() {
    setRunning(true);
    const r = await fetch("/api/cron/pravidelne-naklady");
    const d = await r.json();
    setRunning(false);
    alert(d.count ? `Pridané: ${d.created.join(", ")}` : "Žiadne nové náklady (buď ešte nie je čas, alebo už existujú)");
  }

  const aktivne = list.filter((n) => n.aktivny);
  const sumaMesacne = aktivne.reduce((s, n) => s + Number(n.suma), 0);

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#374151" }}>Pravidelné mesačné náklady</h1>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>Auto-pridanie do prehľadu denne o 01:00 (0–2 dni pred splatnosťou)</div>
        </div>
        <button onClick={runNow} disabled={running} style={{ background: "transparent", color: "#374151", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", opacity: running ? 0.5 : 1 }}>
          {running ? "Spúšťam…" : "▶ Spustiť teraz"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }} className="dash-grid">
        <Stat title="Aktívne náklady" value={`${aktivne.length}`} />
        <Stat title="Mesačne celkom" value={`${sumaMesacne.toFixed(2)} €`} color="var(--danger)" />
        <Stat title="Ročne" value={`${(sumaMesacne * 12).toFixed(2)} €`} color="var(--danger)" />
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px", marginBottom: "16px" }}>
        <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "10px" }}>Pridať náklad</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: "8px", alignItems: "center" }}>
          <input style={inputSt} placeholder="Názov (napr. Nájom)" value={nazov} onChange={(e) => setNazov(e.target.value)} />
          <input style={inputSt} inputMode="decimal" placeholder="Suma €" value={suma} onChange={(e) => setSuma(e.target.value)} />
          <input style={inputSt} type="number" min="1" max="31" placeholder="Deň splat." value={den} onChange={(e) => setDen(e.target.value)} />
          <input style={inputSt} placeholder="Kategória" value={kat} onChange={(e) => setKat(e.target.value)} />
          <button onClick={add} style={{ background: "#374151", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 16px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>+ Pridať</button>
        </div>
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden" }}>
        <div className="table-header" style={{
          display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 100px auto",
          gap: "12px", padding: "12px 16px",
          background: "var(--bg-elevated)", fontSize: "11px", fontWeight: 700,
          color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em",
        }}>
          <div>Názov</div>
          <div style={{ textAlign: "right" }}>Suma</div>
          <div>Splatnosť</div>
          <div>Kategória</div>
          <div>Stav</div>
          <div></div>
        </div>
        {loading ? (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>Načítavam…</div>
        ) : list.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>Žiadne pravidelné náklady. Pridaj prvý.</div>
        ) : (
          list.map((n) => (
            <div key={n.id} className="table-row" style={{
              display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 100px auto",
              gap: "12px", padding: "14px 16px",
              borderTop: "1px solid var(--border-subtle)", fontSize: "13px", alignItems: "center",
              opacity: n.aktivny ? 1 : 0.5,
            }}>
              <div style={{ fontWeight: 600 }}>{n.nazov}</div>
              <div style={{ textAlign: "right", fontWeight: 700, color: "var(--danger)" }}>{Number(n.suma).toFixed(2)} €</div>
              <div className="table-cell-hide">{n.den_splatnosti}. v mesiaci</div>
              <div className="table-cell-hide" style={{ color: "var(--text-secondary)" }}>{n.kategoria || "—"}</div>
              <div>
                <button onClick={() => toggleAktivny(n)} style={{
                  background: n.aktivny ? "var(--success-light)" : "var(--bg-elevated)",
                  color: n.aktivny ? "var(--success)" : "var(--text-secondary)",
                  border: "none", borderRadius: "999px", padding: "4px 10px",
                  fontSize: "11px", fontWeight: 700, cursor: "pointer",
                }}>
                  {n.aktivny ? "✓ Aktívny" : "Pauza"}
                </button>
              </div>
              <div>
                <button onClick={() => remove(n.id)} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "12px", color: "var(--danger)" }}>×</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ title, value, color }: { title: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px 18px" }}>
      <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: "22px", fontWeight: 700, color: color || "#374151", marginTop: "4px" }}>{value}</div>
    </div>
  );
}
