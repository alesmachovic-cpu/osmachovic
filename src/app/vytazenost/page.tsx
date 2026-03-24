"use client";

import { useState, useEffect } from "react";

interface ClenTimu {
  id: string;
  osoba: string;
  rola: "fotograf" | "pravnik" | "technik";
  stav: "volny" | "pracuje" | "dovolenka";
  aktualnaZakazka?: string;
  kapacitaDenne: number;
  obsadene: number;
}

const ROLA_LABELS: Record<ClenTimu["rola"], string> = {
  fotograf: "Fotograf",
  pravnik: "Právnik",
  technik: "Technik",
};

const STAV_CONFIG: Record<ClenTimu["stav"], { label: string; color: string; bg: string }> = {
  volny: { label: "Voľný", color: "#34C759", bg: "#34C75918" },
  pracuje: { label: "Pracuje", color: "#FF9500", bg: "#FF950018" },
  dovolenka: { label: "Dovolenka", color: "#8E8E93", bg: "#8E8E9318" },
};

const DEFAULT_TEAM: ClenTimu[] = [
  { id: "1", osoba: "Marek", rola: "fotograf", stav: "volny", kapacitaDenne: 4, obsadene: 0 },
  { id: "2", osoba: "JUDr. Horváth", rola: "pravnik", stav: "volny", kapacitaDenne: 3, obsadene: 0 },
  { id: "3", osoba: "Peter", rola: "technik", stav: "volny", kapacitaDenne: 5, obsadene: 0 },
];

const LS_KEY = "os_machovic_vytazenost";

const DNI = ["Po", "Ut", "St", "Št", "Pi"];

export default function VytazenostPage() {
  const [tim, setTim] = useState<ClenTimu[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ stav: "" as ClenTimu["stav"], aktualnaZakazka: "", obsadene: 0 });

  useEffect(() => {
    const data = localStorage.getItem(LS_KEY);
    if (data) {
      setTim(JSON.parse(data));
    } else {
      setTim(DEFAULT_TEAM);
      localStorage.setItem(LS_KEY, JSON.stringify(DEFAULT_TEAM));
    }
  }, []);

  const save = (items: ClenTimu[]) => {
    setTim(items);
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  };

  const startEdit = (clen: ClenTimu) => {
    setEditId(clen.id);
    setEditForm({ stav: clen.stav, aktualnaZakazka: clen.aktualnaZakazka || "", obsadene: clen.obsadene });
  };

  const saveEdit = (id: string) => {
    save(
      tim.map((c) =>
        c.id === id
          ? {
              ...c,
              stav: editForm.stav,
              aktualnaZakazka: editForm.aktualnaZakazka.trim() || undefined,
              obsadene: editForm.obsadene,
            }
          : c
      )
    );
    setEditId(null);
  };

  const celkovaKapacita = tim.reduce((s, c) => s + c.kapacitaDenne, 0);
  const celkoveObsadene = tim.reduce((s, c) => s + c.obsadene, 0);
  const percentVyuzitie = celkovaKapacita > 0 ? Math.round((celkoveObsadene / celkovaKapacita) * 100) : 0;

  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

  return (
    <div style={{ minHeight: "100vh", background: "#F2F2F7", padding: "24px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1C1C1E", margin: 0 }}>
            Vyťaženosť tímu
          </h1>
          <p style={{ fontSize: 15, color: "#8E8E93", marginTop: 4 }}>
            Kapacita fotografa, právnika a technika
          </p>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 20,
              textAlign: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <p style={{ fontSize: 13, color: "#8E8E93", margin: 0 }}>Celková kapacita</p>
            <p style={{ fontSize: 32, fontWeight: 700, color: "#1C1C1E", margin: "4px 0 0" }}>
              {celkovaKapacita}
            </p>
            <p style={{ fontSize: 12, color: "#AEAEB2", margin: 0 }}>zákaziek/deň</p>
          </div>
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 20,
              textAlign: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <p style={{ fontSize: 13, color: "#8E8E93", margin: 0 }}>Obsadené</p>
            <p style={{ fontSize: 32, fontWeight: 700, color: "#FF9500", margin: "4px 0 0" }}>
              {celkoveObsadene}
            </p>
            <p style={{ fontSize: 12, color: "#AEAEB2", margin: 0 }}>aktuálne</p>
          </div>
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 20,
              textAlign: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <p style={{ fontSize: 13, color: "#8E8E93", margin: 0 }}>Vyťaženosť</p>
            <p
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: percentVyuzitie > 80 ? "#FF3B30" : percentVyuzitie > 50 ? "#FF9500" : "#34C759",
                margin: "4px 0 0",
              }}
            >
              {percentVyuzitie}%
            </p>
            <p style={{ fontSize: 12, color: "#AEAEB2", margin: 0 }}>využitie</p>
          </div>
        </div>

        {/* Team members */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tim.map((clen) => {
            const pct = clen.kapacitaDenne > 0 ? Math.round((clen.obsadene / clen.kapacitaDenne) * 100) : 0;
            const barColor = pct > 80 ? "#FF3B30" : pct > 50 ? "#FF9500" : "#34C759";
            const stavConf = STAV_CONFIG[clen.stav];
            const isEditing = editId === clen.id;

            return (
              <div
                key={clen.id}
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: 20,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        background: `${stavConf.color}20`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                        fontWeight: 700,
                        color: stavConf.color,
                      }}
                    >
                      {clen.osoba[0]}
                    </div>
                    <div>
                      <p style={{ fontSize: 17, fontWeight: 600, color: "#1C1C1E", margin: 0 }}>
                        {clen.osoba}
                      </p>
                      <p style={{ fontSize: 13, color: "#8E8E93", margin: "2px 0 0" }}>
                        {ROLA_LABELS[clen.rola]}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: stavConf.color,
                        background: stavConf.bg,
                        padding: "4px 10px",
                        borderRadius: 8,
                      }}
                    >
                      {stavConf.label}
                    </span>
                    <button
                      onClick={() => (isEditing ? saveEdit(clen.id) : startEdit(clen))}
                      style={{
                        background: isEditing ? "#34C759" : "#F2F2F7",
                        color: isEditing ? "#fff" : "#636366",
                        border: "none",
                        borderRadius: 8,
                        padding: "6px 14px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {isEditing ? "Uložiť" : "Upraviť"}
                    </button>
                  </div>
                </div>

                {/* Capacity bar */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: "#636366" }}>
                      Kapacita: {clen.obsadene}/{clen.kapacitaDenne} zákaziek
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: barColor }}>{pct}%</span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      background: "#F2F2F7",
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(pct, 100)}%`,
                        background: barColor,
                        borderRadius: 4,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>

                {clen.aktualnaZakazka && !isEditing && (
                  <p style={{ fontSize: 13, color: "#636366", margin: "10px 0 0", fontStyle: "italic" }}>
                    Aktuálne: {clen.aktualnaZakazka}
                  </p>
                )}

                {/* Edit form */}
                {isEditing && (
                  <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <label style={{ fontSize: 12, color: "#8E8E93", display: "block", marginBottom: 3 }}>Stav</label>
                      <select
                        value={editForm.stav}
                        onChange={(e) => setEditForm({ ...editForm, stav: e.target.value as ClenTimu["stav"] })}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid #E5E5EA",
                          fontSize: 14,
                          outline: "none",
                        }}
                      >
                        <option value="volny">Voľný</option>
                        <option value="pracuje">Pracuje</option>
                        <option value="dovolenka">Dovolenka</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: "#8E8E93", display: "block", marginBottom: 3 }}>Obsadené</label>
                      <input
                        type="number"
                        min={0}
                        max={clen.kapacitaDenne}
                        value={editForm.obsadene}
                        onChange={(e) => setEditForm({ ...editForm, obsadene: Number(e.target.value) })}
                        style={{
                          width: 70,
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid #E5E5EA",
                          fontSize: 14,
                          outline: "none",
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <label style={{ fontSize: 12, color: "#8E8E93", display: "block", marginBottom: 3 }}>Aktuálna zákazka</label>
                      <input
                        value={editForm.aktualnaZakazka}
                        onChange={(e) => setEditForm({ ...editForm, aktualnaZakazka: e.target.value })}
                        placeholder="Názov zákazky..."
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid #E5E5EA",
                          fontSize: 14,
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Weekly overview */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 24,
            marginTop: 24,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <h3 style={{ fontSize: 17, fontWeight: 600, color: "#1C1C1E", margin: "0 0 16px" }}>
            Týždenný prehľad
          </h3>
          <p style={{ fontSize: 13, color: "#8E8E93", margin: "0 0 16px" }}>
            Týždeň od {monday.toLocaleDateString("sk-SK")}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: `120px repeat(${DNI.length}, 1fr)`, gap: 2 }}>
            {/* Header row */}
            <div style={{ padding: 8 }} />
            {DNI.map((d) => (
              <div
                key={d}
                style={{
                  padding: 8,
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#8E8E93",
                }}
              >
                {d}
              </div>
            ))}
            {/* Rows per person */}
            {tim.map((clen) => {
              const stavConf = STAV_CONFIG[clen.stav];
              return (
                <div key={clen.id} style={{ display: "contents" }}>
                  <div
                    style={{
                      padding: "8px 10px",
                      fontSize: 14,
                      fontWeight: 500,
                      color: "#1C1C1E",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {clen.osoba}
                  </div>
                  {DNI.map((d, i) => {
                    const isDovolenka = clen.stav === "dovolenka";
                    const cellColor = isDovolenka
                      ? "#F2F2F7"
                      : clen.obsadene >= clen.kapacitaDenne
                        ? "#FF3B3018"
                        : clen.obsadene > 0
                          ? "#FF950018"
                          : "#34C75918";
                    const isToday = (dayOfWeek + 6) % 7 === i;
                    return (
                      <div
                        key={d}
                        style={{
                          padding: 8,
                          textAlign: "center",
                          background: cellColor,
                          borderRadius: 8,
                          fontSize: 13,
                          color: "#636366",
                          border: isToday ? "2px solid #007AFF" : "2px solid transparent",
                        }}
                      >
                        {isDovolenka ? "—" : `${clen.obsadene}/${clen.kapacitaDenne}`}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
