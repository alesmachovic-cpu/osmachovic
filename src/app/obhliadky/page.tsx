"use client";

import { useState, useEffect } from "react";

interface Obhliadka {
  id: string;
  nehnutelnostId?: string;
  klientMeno: string;
  datum: string;
  cas: string;
  adresa: string;
  poznamka: string;
  stav: "planovana" | "dokoncena" | "zrusena";
}

type FilterStav = "vsetky" | "planovana" | "dokoncena" | "zrusena";

const STAV_CONFIG: Record<Obhliadka["stav"], { label: string; bg: string; color: string }> = {
  planovana: { label: "Plánovaná", bg: "#F3F4F6", color: "#374151" },
  dokoncena: { label: "Dokončená", bg: "#E5E7EB", color: "#374151" },
  zrusena:   { label: "Zrušená",   bg: "#F9FAFB", color: "#9CA3AF" },
};

const LS_KEY = "os-machovic-obhliadky";

function loadObhliadky(): Obhliadka[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveObhliadky(data: Obhliadka[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

export default function ObhliadkyPage() {
  const [items, setItems] = useState<Obhliadka[]>([]);
  const [filter, setFilter] = useState<FilterStav>("vsetky");
  const [showForm, setShowForm] = useState(false);

  /* form fields */
  const [klientMeno, setKlientMeno] = useState("");
  const [datum, setDatum] = useState("");
  const [cas, setCas] = useState("");
  const [adresa, setAdresa] = useState("");
  const [poznamka, setPoznamka] = useState("");

  useEffect(() => {
    setItems(loadObhliadky());
  }, []);

  function persist(next: Obhliadka[]) {
    setItems(next);
    saveObhliadky(next);
  }

  function handleAdd() {
    if (!klientMeno.trim() || !datum || !cas || !adresa.trim()) return;
    const nova: Obhliadka = {
      id: crypto.randomUUID(),
      klientMeno: klientMeno.trim(),
      datum,
      cas,
      adresa: adresa.trim(),
      poznamka: poznamka.trim(),
      stav: "planovana",
    };
    persist([nova, ...items]);
    setKlientMeno("");
    setDatum("");
    setCas("");
    setAdresa("");
    setPoznamka("");
    setShowForm(false);
  }

  function cycleStav(id: string) {
    const order: Obhliadka["stav"][] = ["planovana", "dokoncena", "zrusena"];
    persist(
      items.map(o => {
        if (o.id !== id) return o;
        const idx = order.indexOf(o.stav);
        return { ...o, stav: order[(idx + 1) % order.length] };
      })
    );
  }

  function handleDelete(id: string) {
    persist(items.filter(o => o.id !== id));
  }

  const sorted = [...items].sort((a, b) => {
    const da = `${a.datum}T${a.cas}`;
    const db = `${b.datum}T${b.cas}`;
    return da < db ? -1 : da > db ? 1 : 0;
  });

  const filtered = filter === "vsetky" ? sorted : sorted.filter(o => o.stav === filter);

  const counts = {
    vsetky: items.length,
    planovana: items.filter(o => o.stav === "planovana").length,
    dokoncena: items.filter(o => o.stav === "dokoncena").length,
    zrusena: items.filter(o => o.stav === "zrusena").length,
  };

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: "7px 16px",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: active ? "600" : "500",
    border: "1px solid var(--border)",
    background: active ? "#374151" : "var(--bg-surface)",
    color: active ? "#fff" : "var(--text-secondary)",
    cursor: "pointer",
    transition: "all .15s",
  });

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

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>Obhliadky a termíny</h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" }}>
            {filtered.length} {filtered.length === 1 ? "obhliadka" : filtered.length < 5 ? "obhliadky" : "obhliadok"}
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
          {showForm ? "Zrušiť" : "+ Nová obhliadka"}
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
        {([
          { label: "Celkom", value: counts.vsetky, color: "#374151" },
          { label: "Plánované", value: counts.planovana, color: "#374151" },
          { label: "Dokončené", value: counts.dokoncena, color: "#374151" },
          { label: "Zrušené", value: counts.zrusena, color: "#9CA3AF" },
        ] as const).map(s => (
          <div key={s.label} style={{ padding: "16px", background: "var(--bg-surface)", borderRadius: "12px", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "500" }}>{s.label}</div>
            <div style={{ fontSize: "24px", fontWeight: "700", color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Inline form */}
      {showForm && (
        <div style={{
          padding: "20px", background: "var(--bg-surface)", borderRadius: "14px",
          border: "1px solid var(--border)", marginBottom: "20px",
        }}>
          <h3 style={{ fontSize: "15px", fontWeight: "600", color: "var(--text-primary)", margin: "0 0 16px" }}>Nová obhliadka</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Meno klienta *</label>
              <input value={klientMeno} onChange={e => setKlientMeno(e.target.value)} placeholder="Ján Novák" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Adresa *</label>
              <input value={adresa} onChange={e => setAdresa(e.target.value)} placeholder="Hlavná 12, Bratislava" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Dátum *</label>
              <input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Čas *</label>
              <input type="time" value={cas} onChange={e => setCas(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Poznámka</label>
              <input value={poznamka} onChange={e => setPoznamka(e.target.value)} placeholder="Voliteľná poznámka..." style={inputStyle} />
            </div>
          </div>
          <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={handleAdd}
              disabled={!klientMeno.trim() || !datum || !cas || !adresa.trim()}
              style={{
                padding: "10px 24px", background: "#374151", color: "#fff", borderRadius: "10px",
                fontSize: "13px", fontWeight: "600", border: "none", cursor: "pointer",
                opacity: (!klientMeno.trim() || !datum || !cas || !adresa.trim()) ? 0.4 : 1,
              }}
            >
              Pridať obhliadku
            </button>
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "18px", flexWrap: "wrap" }}>
        {([
          { key: "vsetky" as FilterStav, label: "Všetky" },
          { key: "planovana" as FilterStav, label: "Plánované" },
          { key: "dokoncena" as FilterStav, label: "Dokončené" },
          { key: "zrusena" as FilterStav, label: "Zrušené" },
        ]).map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={chipStyle(filter === f.key)}>
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 20px", background: "var(--bg-surface)", borderRadius: "16px", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📅</div>
          <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>Zatiaľ žiadne obhliadky</div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Pridajte prvú obhliadku tlačidlom vyššie.</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filtered.map(o => {
          const cfg = STAV_CONFIG[o.stav];
          const dStr = new Date(o.datum).toLocaleDateString("sk-SK", { day: "numeric", month: "short", year: "numeric" });
          return (
            <div key={o.id} style={{
              display: "flex", alignItems: "center", gap: "14px",
              padding: "14px 18px", background: "var(--bg-surface)",
              borderRadius: "12px", border: "1px solid var(--border)",
              transition: "background .12s",
            }}>
              {/* date block */}
              <div style={{
                minWidth: "56px", textAlign: "center", padding: "8px 6px",
                background: "var(--bg-elevated)", borderRadius: "10px",
              }}>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>
                  {new Date(o.datum).getDate()}
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "500", textTransform: "uppercase" }}>
                  {new Date(o.datum).toLocaleDateString("sk-SK", { month: "short" })}
                </div>
              </div>

              {/* info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>{o.klientMeno}</span>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{o.cas}</span>
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {o.adresa}
                </div>
                {o.poznamka && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{o.poznamka}</div>
                )}
              </div>

              {/* badge - click to cycle */}
              <button
                onClick={() => cycleStav(o.id)}
                title="Kliknite pre zmenu stavu"
                style={{
                  padding: "5px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: "600",
                  background: cfg.bg, color: cfg.color, border: "none", cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {cfg.label}
              </button>

              {/* delete */}
              <button
                onClick={() => handleDelete(o.id)}
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
}
