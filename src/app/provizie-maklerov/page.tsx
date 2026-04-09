"use client";

import { useEffect, useState } from "react";

type Makler = { id: string; meno: string; percento: number };
type Faktura = {
  id: string;
  cislo_faktury: string;
  datum_vystavenia: string;
  suma_celkom: number;
  zaplatene: boolean;
  poznamka: string | null;
  odberatel_snapshot: { nazov?: string } | null;
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

export default function ProvizieMaklerovPage() {
  const [maklery, setMaklery] = useState<Makler[]>([]);
  const [faktury, setFaktury] = useState<Faktura[]>([]);
  const [novyMeno, setNovyMeno] = useState("");
  const [novyPct, setNovyPct] = useState("");
  const [selectedMakler, setSelectedMakler] = useState<string>("");
  const [mesiac, setMesiac] = useState(new Date().toISOString().slice(0, 7));

  async function loadMaklery() {
    const r = await fetch("/api/maklerske-provizie");
    setMaklery(await r.json());
  }
  async function loadFaktury() {
    const r = await fetch("/api/faktury");
    setFaktury(await r.json());
  }
  useEffect(() => { loadMaklery(); loadFaktury(); }, []);

  async function addMakler() {
    if (!novyMeno.trim()) return;
    await fetch("/api/maklerske-provizie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meno: novyMeno, percento: parseFloat(novyPct.replace(",", ".")) || 0 }),
    });
    setNovyMeno(""); setNovyPct("");
    loadMaklery();
  }

  async function updatePct(m: Makler, value: string) {
    const pct = parseFloat(value.replace(",", ".")) || 0;
    await fetch("/api/maklerske-provizie", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, percento: pct }),
    });
    loadMaklery();
  }

  async function removeMakler(id: string) {
    if (!confirm("Zmazať makléra?")) return;
    await fetch(`/api/maklerske-provizie?id=${id}`, { method: "DELETE" });
    loadMaklery();
  }

  // Filter faktúry pre vybratého makléra (cez poznámku - obsahuje meno makléra)
  const selectedM = maklery.find((m) => m.id === selectedMakler);
  const monthFaktury = faktury.filter((f) => f.datum_vystavenia.startsWith(mesiac));
  const maklerFaktury = selectedM
    ? monthFaktury.filter((f) => (f.poznamka || "").toLowerCase().includes(selectedM.meno.toLowerCase()))
    : [];
  const sumaFakt = maklerFaktury.reduce((s, f) => s + Number(f.suma_celkom), 0);
  const sumaZapl = maklerFaktury.filter((f) => f.zaplatene).reduce((s, f) => s + Number(f.suma_celkom), 0);
  const provizia = selectedM ? sumaZapl * (selectedM.percento / 100) : 0;

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#374151" }}>Provízie maklérov</h1>
        <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>Správa percent a výpočet provízie z faktúr</div>
      </div>

      {/* Maklery */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", marginBottom: "20px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#374151", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Makléri a percentá</div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
          {maklery.length === 0 && (
            <div style={{ color: "var(--text-secondary)", fontSize: "13px", padding: "8px 0" }}>Žiadni makléri. Pridaj prvého nižšie.</div>
          )}
          {maklery.map((m) => (
            <div key={m.id} style={{ display: "grid", gridTemplateColumns: "1fr 140px auto", gap: "8px", alignItems: "center" }}>
              <div style={{ fontWeight: 600, fontSize: "14px" }}>{m.meno}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  style={inputSt}
                  defaultValue={m.percento}
                  onBlur={(e) => updatePct(m, e.target.value)}
                />
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>%</span>
              </div>
              <button onClick={() => removeMakler(m.id)} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", color: "var(--danger)", fontSize: "12px" }}>×</button>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 140px auto", gap: "8px", alignItems: "center", paddingTop: "12px", borderTop: "1px solid var(--border-subtle)" }}>
          <input style={inputSt} placeholder="Meno makléra" value={novyMeno} onChange={(e) => setNovyMeno(e.target.value)} />
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <input style={inputSt} placeholder="0" value={novyPct} onChange={(e) => setNovyPct(e.target.value)} />
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>%</span>
          </div>
          <button onClick={addMakler} style={{ background: "#374151", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 16px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>+ Pridať</button>
        </div>
      </div>

      {/* Výpočet provízie */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#374151", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Výpočet provízie</div>
        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "12px" }}>
          Vyberie faktúry, ktorých <b>poznámka obsahuje meno makléra</b>. Provízia sa počíta zo zaplatených.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <select style={inputSt} value={selectedMakler} onChange={(e) => setSelectedMakler(e.target.value)}>
            <option value="">— vyber makléra —</option>
            {maklery.map((m) => (
              <option key={m.id} value={m.id}>{m.meno} ({m.percento} %)</option>
            ))}
          </select>
          <input type="month" style={inputSt} value={mesiac} onChange={(e) => setMesiac(e.target.value)} />
        </div>

        {selectedM && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }} className="dash-grid">
              <Stat title="Faktúry celkom" value={`${sumaFakt.toFixed(2)} €`} sub={`${maklerFaktury.length} ks`} />
              <Stat title="Zaplatené" value={`${sumaZapl.toFixed(2)} €`} color="var(--success)" />
              <Stat title={`Provízia (${selectedM.percento} %)`} value={`${provizia.toFixed(2)} €`} color="#374151" />
            </div>

            <div style={{ border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
              <div className="table-header" style={{
                display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr 100px",
                gap: "12px", padding: "10px 14px",
                background: "var(--bg-elevated)", fontSize: "11px", fontWeight: 700,
                color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em",
              }}>
                <div>Číslo</div>
                <div>Odberateľ</div>
                <div>Dátum</div>
                <div style={{ textAlign: "right" }}>Suma</div>
                <div>Stav</div>
              </div>
              {maklerFaktury.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--text-secondary)", fontSize: "13px" }}>
                  Žiadne faktúry s menom „{selectedM.meno}" v poznámke za tento mesiac.
                </div>
              ) : (
                maklerFaktury.map((f) => (
                  <div key={f.id} className="table-row" style={{
                    display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr 100px",
                    gap: "12px", padding: "12px 14px",
                    borderTop: "1px solid var(--border-subtle)", fontSize: "13px", alignItems: "center",
                  }}>
                    <div style={{ fontWeight: 600, color: "#374151" }}>{f.cislo_faktury}</div>
                    <div className="table-cell-hide">{f.odberatel_snapshot?.nazov || "—"}</div>
                    <div className="table-cell-hide">{f.datum_vystavenia}</div>
                    <div style={{ textAlign: "right", fontWeight: 600 }}>{Number(f.suma_celkom).toFixed(2)} €</div>
                    <div>
                      <span style={{
                        fontSize: "11px", fontWeight: 700,
                        background: f.zaplatene ? "var(--success-light)" : "var(--warning-light)",
                        color: f.zaplatene ? "var(--success)" : "var(--warning)",
                        padding: "3px 8px", borderRadius: "999px",
                      }}>{f.zaplatene ? "✓" : "—"}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ title, value, sub, color }: { title: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px 16px" }}>
      <div style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{title}</div>
      <div style={{ fontSize: "20px", fontWeight: 700, color: color || "#374151", marginTop: "4px" }}>{value}</div>
      {sub && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{sub}</div>}
    </div>
  );
}
