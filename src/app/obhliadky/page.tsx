"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Obhliadka {
  id: string;
  nehnutelnostId?: string;
  klientId?: string | null;
  klientMeno: string;
  datum: string;
  cas: string;
  adresa: string;
  poznamka: string;
  stav: "planovana" | "dokoncena" | "zrusena";
}

interface KlientOption {
  id: string;
  meno: string;
  telefon?: string | null;
}

type FilterStav = "vsetky" | "planovana" | "dokoncena" | "zrusena";

const STAV_CONFIG: Record<Obhliadka["stav"], { label: string; bg: string; color: string }> = {
  planovana: { label: "Plánovaná", bg: "#F3F4F6", color: "#374151" },
  dokoncena: { label: "Dokončená", bg: "#E5E7EB", color: "#374151" },
  zrusena:   { label: "Zrušená",   bg: "#F9FAFB", color: "#9CA3AF" },
};

function stavToStatus(stav: Obhliadka["stav"]): string {
  return stav === "dokoncena" ? "prebehla" : stav;
}

function fromApi(r: Record<string, unknown>): Obhliadka {
  const dt = new Date(r.datum as string);
  const status = String(r.status || "planovana");
  return {
    id: r.id as string,
    klientId: (r.kupujuci_klient_id as string | null) ?? null,
    klientMeno: (r.kupujuci_meno as string) || "—",
    datum: dt.toISOString().slice(0, 10),
    cas: dt.toISOString().slice(11, 16),
    adresa: (r.miesto as string) || "",
    poznamka: (r.poznamka as string) || "",
    stav: (["prebehla", "obhliadka_zaujem", "obhliadka_bez_zaujmu"].includes(status)
      ? "dokoncena" : status === "zrusena" ? "zrusena" : "planovana") as Obhliadka["stav"],
  };
}

async function fetchObhliadky(): Promise<Obhliadka[]> {
  const r = await fetch("/api/obhliadky");
  const d = await r.json();
  return ((d.obhliadky ?? []) as Record<string, unknown>[]).map(fromApi);
}

export default function ObhliadkyPage() {
  const [items, setItems] = useState<Obhliadka[]>([]);
  const [filter, setFilter] = useState<FilterStav>("vsetky");
  const [showForm, setShowForm] = useState(false);

  /* form fields */
  const [klientMeno, setKlientMeno] = useState("");
  const [klientId, setKlientId] = useState<string | null>(null);
  const [datum, setDatum] = useState("");
  const [cas, setCas] = useState("");
  const [adresa, setAdresa] = useState("");
  const [poznamka, setPoznamka] = useState("");

  /* klient autocomplete (TASK 9) */
  const [klientiList, setKlientiList] = useState<KlientOption[]>([]);
  const [klientQuery, setKlientQuery] = useState("");
  const [showKlientDropdown, setShowKlientDropdown] = useState(false);

  /* edit modal (TASK 6) */
  const [editing, setEditing] = useState<Obhliadka | null>(null);

  useEffect(() => {
    fetchObhliadky().then(setItems);
    supabase.from("klienti").select("id, meno, telefon").order("meno", { ascending: true })
      .then(({ data }) => { if (data) setKlientiList(data as KlientOption[]); });
  }, []);

  async function handleAdd() {
    if (!klientMeno.trim() || !datum || !cas || !adresa.trim()) return;
    const datumIso = new Date(`${datum}T${cas}`).toISOString();
    await fetch("/api/obhliadky", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datum: datumIso, miesto: adresa.trim(),
        kupujuci_meno: klientMeno.trim(), kupujuci_klient_id: klientId || null,
        poznamka: poznamka.trim() || null, status: "planovana",
      }),
    });
    setKlientMeno(""); setKlientId(null); setKlientQuery(""); setDatum(""); setCas(""); setAdresa(""); setPoznamka(""); setShowForm(false);
    fetchObhliadky().then(setItems);
  }

  async function handleSaveEdit(updated: Obhliadka) {
    const datumIso = new Date(`${updated.datum}T${updated.cas}`).toISOString();
    await fetch("/api/obhliadky", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: updated.id, datum: datumIso, miesto: updated.adresa,
        kupujuci_meno: updated.klientMeno, kupujuci_klient_id: updated.klientId || null,
        poznamka: updated.poznamka, status: stavToStatus(updated.stav),
      }),
    });
    setEditing(null);
    fetchObhliadky().then(setItems);
  }

  async function cycleStav(id: string) {
    const order: Obhliadka["stav"][] = ["planovana", "dokoncena", "zrusena"];
    const cur = items.find(o => o.id === id);
    const nextStav = order[(order.indexOf(cur?.stav ?? "planovana") + 1) % order.length];
    setItems(prev => prev.map(o => o.id === id ? { ...o, stav: nextStav } : o));
    await fetch("/api/obhliadky", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: stavToStatus(nextStav) }),
    });
  }

  async function handleDelete(id: string) {
    setItems(prev => prev.filter(o => o.id !== id));
    await fetch(`/api/obhliadky?id=${id}`, { method: "DELETE" });
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
            <div style={{ position: "relative" }}>
              <label style={labelStyle}>Meno klienta *</label>
              <input
                value={klientQuery || klientMeno}
                onChange={e => { setKlientQuery(e.target.value); setKlientMeno(e.target.value); setKlientId(null); setShowKlientDropdown(true); }}
                onFocus={() => setShowKlientDropdown(true)}
                onBlur={() => setTimeout(() => setShowKlientDropdown(false), 150)}
                placeholder="Hľadaj klienta alebo zadaj meno..."
                style={inputStyle}
              />
              {showKlientDropdown && klientQuery.trim().length >= 1 && (() => {
                const q = klientQuery.toLowerCase();
                const matches = klientiList.filter(k =>
                  k.meno.toLowerCase().includes(q) || (k.telefon || "").includes(q)
                ).slice(0, 6);
                if (matches.length === 0) return null;
                return (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0,
                    marginTop: "4px", background: "var(--bg-surface)",
                    border: "1px solid var(--border)", borderRadius: "8px",
                    boxShadow: "0 8px 16px rgba(0,0,0,0.08)", zIndex: 100,
                    maxHeight: "240px", overflowY: "auto",
                  }}>
                    {matches.map(k => (
                      <button key={k.id} type="button"
                        onMouseDown={() => {
                          setKlientId(k.id);
                          setKlientMeno(k.meno);
                          setKlientQuery(k.meno);
                          setShowKlientDropdown(false);
                        }}
                        style={{
                          display: "block", width: "100%", textAlign: "left",
                          padding: "10px 12px", border: "none", background: "transparent",
                          cursor: "pointer", fontSize: "13px", color: "var(--text-primary)",
                        }}>
                        <strong>{k.meno}</strong>
                        {k.telefon && <span style={{ color: "var(--text-muted)", marginLeft: "8px", fontSize: "12px" }}>{k.telefon}</span>}
                      </button>
                    ))}
                  </div>
                );
              })()}
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
            <div key={o.id}
              onClick={() => setEditing(o)}
              style={{
                display: "flex", alignItems: "center", gap: "14px",
                padding: "14px 18px", background: "var(--bg-surface)",
                borderRadius: "12px", border: "1px solid var(--border)",
                transition: "background .12s", cursor: "pointer",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-elevated)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--bg-surface)")}>
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
                onClick={(e) => { e.stopPropagation(); cycleStav(o.id); }}
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
                onClick={(e) => { e.stopPropagation(); handleDelete(o.id); }}
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

      {/* Edit modal (TASK 6) */}
      {editing && (
        <ObhliadkaEditModal
          obhliadka={editing}
          klientiList={klientiList}
          onClose={() => setEditing(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}

function ObhliadkaEditModal({ obhliadka, klientiList, onClose, onSave }: {
  obhliadka: Obhliadka;
  klientiList: KlientOption[];
  onClose: () => void;
  onSave: (o: Obhliadka) => void;
}) {
  const [klientMeno, setKlientMeno] = useState(obhliadka.klientMeno);
  const [klientId, setKlientId] = useState<string | null>(obhliadka.klientId ?? null);
  const [klientQuery, setKlientQuery] = useState(obhliadka.klientMeno);
  const [showDropdown, setShowDropdown] = useState(false);
  const [datum, setDatum] = useState(obhliadka.datum);
  const [cas, setCas] = useState(obhliadka.cas);
  const [adresa, setAdresa] = useState(obhliadka.adresa);
  const [poznamka, setPoznamka] = useState(obhliadka.poznamka);
  const [stav, setStav] = useState<Obhliadka["stav"]>(obhliadka.stav);

  const inputSt: React.CSSProperties = {
    width: "100%", padding: "10px 14px", background: "var(--bg-elevated)",
    border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px",
    color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
  };
  const labelSt: React.CSSProperties = {
    fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)",
    marginBottom: "4px", display: "block",
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "40px 20px", zIndex: 1500,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg-surface)", borderRadius: "16px", padding: "24px",
        maxWidth: "560px", width: "100%", boxShadow: "0 24px 48px rgba(0,0,0,0.3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Upraviť obhliadku
          </h3>
          <button onClick={onClose} style={{
            width: "28px", height: "28px", borderRadius: "50%", border: "none",
            background: "var(--bg-elevated)", cursor: "pointer", color: "var(--text-muted)",
          }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div style={{ position: "relative" }}>
            <label style={labelSt}>Meno klienta</label>
            <input
              value={klientQuery}
              onChange={e => { setKlientQuery(e.target.value); setKlientMeno(e.target.value); setKlientId(null); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              style={inputSt}
            />
            {showDropdown && klientQuery.trim().length >= 1 && (() => {
              const q = klientQuery.toLowerCase();
              const m = klientiList.filter(k => k.meno.toLowerCase().includes(q) || (k.telefon || "").includes(q)).slice(0, 6);
              if (m.length === 0) return null;
              return (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, marginTop: "4px",
                  background: "var(--bg-surface)", border: "1px solid var(--border)",
                  borderRadius: "8px", boxShadow: "0 8px 16px rgba(0,0,0,0.08)", zIndex: 100,
                  maxHeight: "200px", overflowY: "auto",
                }}>
                  {m.map(k => (
                    <button key={k.id} type="button"
                      onMouseDown={() => {
                        setKlientId(k.id); setKlientMeno(k.meno); setKlientQuery(k.meno); setShowDropdown(false);
                      }}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "10px 12px", border: "none", background: "transparent",
                        cursor: "pointer", fontSize: "13px", color: "var(--text-primary)",
                      }}>
                      <strong>{k.meno}</strong>
                      {k.telefon && <span style={{ color: "var(--text-muted)", marginLeft: "8px", fontSize: "12px" }}>{k.telefon}</span>}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
          <div>
            <label style={labelSt}>Adresa</label>
            <input value={adresa} onChange={e => setAdresa(e.target.value)} style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Dátum</label>
            <input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Čas</label>
            <input type="time" value={cas} onChange={e => setCas(e.target.value)} style={inputSt} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelSt}>Stav</label>
            <select value={stav} onChange={e => setStav(e.target.value as Obhliadka["stav"])} style={inputSt}>
              <option value="planovana">Plánovaná</option>
              <option value="dokoncena">Dokončená</option>
              <option value="zrusena">Zrušená</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelSt}>Poznámka</label>
            <textarea value={poznamka} onChange={e => setPoznamka(e.target.value)}
              style={{ ...inputSt, minHeight: "80px", resize: "vertical", fontFamily: "inherit" }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "20px" }}>
          <button onClick={onClose} style={{
            padding: "10px 16px", borderRadius: "8px", border: "1px solid var(--border)",
            background: "var(--bg-elevated)", color: "var(--text-primary)",
            fontSize: "13px", fontWeight: 600, cursor: "pointer",
          }}>Zrušiť</button>
          <button onClick={() => onSave({ ...obhliadka, klientId, klientMeno, datum, cas, adresa, poznamka, stav })} style={{
            padding: "10px 18px", borderRadius: "8px", border: "none",
            background: "#374151", color: "#fff",
            fontSize: "13px", fontWeight: 700, cursor: "pointer",
          }}>Uložiť</button>
        </div>
      </div>
    </div>
  );
}
