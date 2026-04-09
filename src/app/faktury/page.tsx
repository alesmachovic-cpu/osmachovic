"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Faktura = {
  id: string;
  cislo_faktury: string;
  variabilny_symbol: string;
  datum_vystavenia: string;
  datum_splatnosti: string | null;
  suma_celkom: number;
  zaplatene: boolean;
  odberatel_snapshot: { nazov?: string } | null;
};

export default function FakturyPage() {
  const [list, setList] = useState<Faktura[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/faktury");
    const d = await r.json();
    setList(Array.isArray(d) ? d : []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function togglePaid(f: Faktura) {
    await fetch("/api/faktury", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: f.id, zaplatene: !f.zaplatene, datum_uhrady: !f.zaplatene ? new Date().toISOString().slice(0, 10) : null }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Zmazať faktúru?")) return;
    await fetch(`/api/faktury?id=${id}`, { method: "DELETE" });
    load();
  }

  const total = list.reduce((s, f) => s + Number(f.suma_celkom || 0), 0);
  const zaplatene = list.filter((f) => f.zaplatene).reduce((s, f) => s + Number(f.suma_celkom || 0), 0);
  const nezaplatene = total - zaplatene;

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#374151" }}>Faktúry</h1>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>Vystavené faktúry s automatickým číslovaním</div>
        </div>
        <Link
          href="/faktury/nova"
          style={{ background: "#374151", color: "#fff", borderRadius: "10px", padding: "10px 16px", fontSize: "14px", fontWeight: 600, textDecoration: "none" }}
        >
          + Nová faktúra
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }} className="dash-grid">
        <StatCard title="Celkom vystavené" value={`${total.toFixed(2)} €`} />
        <StatCard title="Zaplatené" value={`${zaplatene.toFixed(2)} €`} color="var(--success)" />
        <StatCard title="Nezaplatené" value={`${nezaplatene.toFixed(2)} €`} color="var(--warning)" />
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden" }}>
        <div className="table-header" style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 2fr 1fr 1fr 1fr 1fr auto",
          gap: "12px",
          padding: "12px 16px",
          background: "var(--bg-elevated)",
          fontSize: "11px",
          fontWeight: 700,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}>
          <div>Číslo</div>
          <div>Odberateľ</div>
          <div>Vystavená</div>
          <div>Splatná</div>
          <div>Suma</div>
          <div>Stav</div>
          <div></div>
        </div>
        {loading ? (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>Načítavam…</div>
        ) : list.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>Žiadne faktúry. Vytvor prvú.</div>
        ) : (
          list.map((f) => (
            <div key={f.id} className="table-row" style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 2fr 1fr 1fr 1fr 1fr auto",
              gap: "12px",
              padding: "14px 16px",
              borderTop: "1px solid var(--border-subtle)",
              fontSize: "13px",
              alignItems: "center",
            }}>
              <div style={{ fontWeight: 600, color: "#374151" }}>{f.cislo_faktury}</div>
              <div className="table-cell-hide">{f.odberatel_snapshot?.nazov || "—"}</div>
              <div className="table-cell-hide">{f.datum_vystavenia}</div>
              <div className="table-cell-hide">{f.datum_splatnosti || "—"}</div>
              <div style={{ fontWeight: 600 }}>{Number(f.suma_celkom).toFixed(2)} €</div>
              <div>
                <button
                  onClick={() => togglePaid(f)}
                  style={{
                    background: f.zaplatene ? "var(--success-light)" : "var(--warning-light)",
                    color: f.zaplatene ? "var(--success)" : "var(--warning)",
                    border: "none",
                    borderRadius: "999px",
                    padding: "4px 10px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {f.zaplatene ? "✓ Zaplatená" : "Nezaplatená"}
                </button>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <Link href={`/faktury/${f.id}`} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px 10px", fontSize: "12px", textDecoration: "none", color: "var(--text-primary)" }}>Otvoriť</Link>
                <button onClick={() => remove(f.id)} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "12px", color: "var(--danger)" }}>×</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px 18px" }}>
      <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: "22px", fontWeight: 700, color: color || "#374151", marginTop: "4px" }}>{value}</div>
    </div>
  );
}
