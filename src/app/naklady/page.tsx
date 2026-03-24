"use client";

import { useState, useEffect, useMemo } from "react";

interface Naklad {
  id: string;
  nehnutelnost?: string;
  kategoria: "foto" | "pravnik" | "marketing" | "opravy" | "ine";
  popis: string;
  suma: number;
  datum: string;
}

type Kategoria = Naklad["kategoria"];

const KATEGORIA_CONFIG: Record<Kategoria, { label: string; icon: string }> = {
  foto:      { label: "Foto / video",  icon: "📷" },
  pravnik:   { label: "Právnik",       icon: "⚖️" },
  marketing: { label: "Marketing",     icon: "📣" },
  opravy:    { label: "Opravy",        icon: "🔧" },
  ine:       { label: "Iné",           icon: "📦" },
};

const LS_KEY = "os-machovic-naklady";

function loadNaklady(): Naklad[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveNaklady(data: Naklad[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function formatEur(v: number) {
  return v.toLocaleString("sk-SK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export default function NakladyPage() {
  const [items, setItems] = useState<Naklad[]>([]);
  const [showForm, setShowForm] = useState(false);

  /* form */
  const [nehnutelnost, setNehnutelnost] = useState("");
  const [kategoria, setKategoria] = useState<Kategoria>("foto");
  const [popis, setPopis] = useState("");
  const [suma, setSuma] = useState("");
  const [datum, setDatum] = useState("");

  useEffect(() => {
    setItems(loadNaklady());
  }, []);

  function persist(next: Naklad[]) {
    setItems(next);
    saveNaklady(next);
  }

  function handleAdd() {
    if (!popis.trim() || !suma || !datum) return;
    const novy: Naklad = {
      id: crypto.randomUUID(),
      nehnutelnost: nehnutelnost.trim() || undefined,
      kategoria,
      popis: popis.trim(),
      suma: parseFloat(suma),
      datum,
    };
    persist([novy, ...items]);
    setNehnutelnost("");
    setKategoria("foto");
    setPopis("");
    setSuma("");
    setDatum("");
    setShowForm(false);
  }

  function handleDelete(id: string) {
    persist(items.filter(n => n.id !== id));
  }

  /* summary */
  const summary = useMemo(() => {
    const celkom = items.reduce((s, n) => s + n.suma, 0);
    const now = new Date();
    const mesiac = items
      .filter(n => {
        const d = new Date(n.datum);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, n) => s + n.suma, 0);

    const byCat: Record<string, number> = {};
    items.forEach(n => {
      byCat[n.kategoria] = (byCat[n.kategoria] || 0) + n.suma;
    });
    let topKat = "—";
    let topVal = 0;
    for (const [k, v] of Object.entries(byCat)) {
      if (v > topVal) { topVal = v; topKat = KATEGORIA_CONFIG[k as Kategoria]?.label || k; }
    }

    return { celkom, mesiac, topKat };
  }, [items]);

  /* grouped by category */
  const grouped = useMemo(() => {
    const map: Record<Kategoria, Naklad[]> = { foto: [], pravnik: [], marketing: [], opravy: [], ine: [] };
    const sorted = [...items].sort((a, b) => (b.datum > a.datum ? 1 : -1));
    sorted.forEach(n => map[n.kategoria].push(n));
    return (Object.entries(map) as [Kategoria, Naklad[]][]).filter(([, v]) => v.length > 0);
  }, [items]);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontSize: "13px",
    color: "var(--text-primary)",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: "600",
    color: "var(--text-secondary)",
    marginBottom: "4px",
    display: "block",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: "none" as const,
    cursor: "pointer",
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    paddingRight: "30px",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>Nákladové položky</h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" }}>
            {items.length} {items.length === 1 ? "položka" : items.length < 5 ? "položky" : "položiek"}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: "10px 20px", background: "#374151", color: "#fff", borderRadius: "10px",
            fontSize: "13px", fontWeight: "600", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "6px",
          }}
        >
          {showForm ? "Zrušiť" : "+ Nový náklad"}
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
        {([
          { label: "Celkové náklady", value: formatEur(summary.celkom) },
          { label: "Tento mesiac", value: formatEur(summary.mesiac) },
          { label: "Top kategória", value: summary.topKat },
        ]).map(s => (
          <div key={s.label} style={{ padding: "16px", background: "var(--bg-surface)", borderRadius: "12px", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "500" }}>{s.label}</div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: "#374151" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Inline form */}
      {showForm && (
        <div style={{
          padding: "20px", background: "var(--bg-surface)", borderRadius: "14px",
          border: "1px solid var(--border)", marginBottom: "20px",
        }}>
          <h3 style={{ fontSize: "15px", fontWeight: "600", color: "var(--text-primary)", margin: "0 0 16px" }}>Nový náklad</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Popis *</label>
              <input value={popis} onChange={e => setPopis(e.target.value)} placeholder="Fotenie bytu na Hlavnej" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Suma (€) *</label>
              <input type="number" min="0" step="0.01" value={suma} onChange={e => setSuma(e.target.value)} placeholder="150.00" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Kategória *</label>
              <select value={kategoria} onChange={e => setKategoria(e.target.value as Kategoria)} style={selectStyle}>
                {(Object.entries(KATEGORIA_CONFIG) as [Kategoria, { label: string; icon: string }][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Dátum *</label>
              <input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Nehnuteľnosť</label>
              <input value={nehnutelnost} onChange={e => setNehnutelnost(e.target.value)} placeholder="Voliteľné — napr. Hlavná 12, Bratislava" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={handleAdd}
              disabled={!popis.trim() || !suma || !datum}
              style={{
                padding: "10px 24px", background: "#374151", color: "#fff", borderRadius: "10px",
                fontSize: "13px", fontWeight: "600", border: "none", cursor: "pointer",
                opacity: (!popis.trim() || !suma || !datum) ? 0.4 : 1,
              }}
            >
              Pridať náklad
            </button>
          </div>
        </div>
      )}

      {/* Grouped list */}
      {items.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 20px", background: "var(--bg-surface)", borderRadius: "16px", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>💰</div>
          <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>Zatiaľ žiadne náklady</div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Pridajte prvú položku tlačidlom vyššie.</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {grouped.map(([kat, naklady]) => {
          const cfg = KATEGORIA_CONFIG[kat];
          const catTotal = naklady.reduce((s, n) => s + n.suma, 0);
          return (
            <div key={kat}>
              {/* Category header */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: "8px", padding: "0 4px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "16px" }}>{cfg.icon}</span>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>{cfg.label}</span>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>({naklady.length})</span>
                </div>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#374151" }}>{formatEur(catTotal)}</span>
              </div>

              {/* Items */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {naklady.map(n => {
                  const dStr = new Date(n.datum).toLocaleDateString("sk-SK", { day: "numeric", month: "short", year: "numeric" });
                  return (
                    <div key={n.id} style={{
                      display: "flex", alignItems: "center", gap: "14px",
                      padding: "12px 16px", background: "var(--bg-surface)",
                      borderRadius: "10px", border: "1px solid var(--border)",
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "14px", fontWeight: "500", color: "var(--text-primary)", marginBottom: "2px" }}>{n.popis}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                          <span>{dStr}</span>
                          {n.nehnutelnost && <span>• {n.nehnutelnost}</span>}
                        </div>
                      </div>
                      <div style={{ fontSize: "15px", fontWeight: "700", color: "#374151", whiteSpace: "nowrap" }}>
                        {formatEur(n.suma)}
                      </div>
                      <button
                        onClick={() => handleDelete(n.id)}
                        title="Odstrániť"
                        style={{
                          width: "30px", height: "30px", borderRadius: "8px",
                          background: "transparent", border: "1px solid var(--border)",
                          color: "var(--text-muted)", cursor: "pointer", fontSize: "14px",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
