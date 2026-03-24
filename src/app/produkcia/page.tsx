"use client";

import { useState, useEffect } from "react";

interface Objednavka {
  id: string;
  typ: "zmluva" | "fotograf" | "pravnik" | "energeticky_certifikat" | "podorys";
  klientMeno: string;
  nehnutelnost?: string;
  stav: "nova" | "v_procese" | "dokoncena";
  poznamka: string;
  datum: string;
  deadline?: string;
}

const TYP_LABELS: Record<Objednavka["typ"], string> = {
  zmluva: "Zmluva",
  fotograf: "Fotograf",
  pravnik: "Právnik",
  energeticky_certifikat: "Energetický certifikát",
  podorys: "Pôdorys",
};

const STAV_LABELS: Record<Objednavka["stav"], string> = {
  nova: "Nové",
  v_procese: "V procese",
  dokoncena: "Dokončené",
};

const STAV_COLORS: Record<Objednavka["stav"], string> = {
  nova: "#007AFF",
  v_procese: "#FF9500",
  dokoncena: "#34C759",
};

const LS_KEY = "os_machovic_produkcia";

export default function ProdukciaPAge() {
  const [objednavky, setObjednavky] = useState<Objednavka[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    typ: "zmluva" as Objednavka["typ"],
    klientMeno: "",
    nehnutelnost: "",
    poznamka: "",
    deadline: "",
  });

  useEffect(() => {
    const data = localStorage.getItem(LS_KEY);
    if (data) setObjednavky(JSON.parse(data));
  }, []);

  const save = (items: Objednavka[]) => {
    setObjednavky(items);
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  };

  const addOrder = () => {
    if (!form.klientMeno.trim()) return;
    const nova: Objednavka = {
      id: crypto.randomUUID(),
      typ: form.typ,
      klientMeno: form.klientMeno.trim(),
      nehnutelnost: form.nehnutelnost.trim() || undefined,
      stav: "nova",
      poznamka: form.poznamka.trim(),
      datum: new Date().toISOString(),
      deadline: form.deadline || undefined,
    };
    save([nova, ...objednavky]);
    setForm({ typ: "zmluva", klientMeno: "", nehnutelnost: "", poznamka: "", deadline: "" });
    setShowForm(false);
  };

  const moveOrder = (id: string, newStav: Objednavka["stav"]) => {
    save(objednavky.map((o) => (o.id === id ? { ...o, stav: newStav } : o)));
  };

  const deleteOrder = (id: string) => {
    save(objednavky.filter((o) => o.id !== id));
  };

  const columns: Objednavka["stav"][] = ["nova", "v_procese", "dokoncena"];

  return (
    <div style={{ minHeight: "100vh", background: "#F2F2F7", padding: "24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1C1C1E", margin: 0 }}>
              Objednávky produkcie
            </h1>
            <p style={{ fontSize: 15, color: "#8E8E93", marginTop: 4 }}>
              Správa zmlúv, fotografov, právnikov a certifikátov
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              background: "#007AFF",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "12px 24px",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {showForm ? "Zavrieť" : "+ Nová objednávka"}
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            <h3 style={{ fontSize: 17, fontWeight: 600, color: "#1C1C1E", margin: "0 0 16px" }}>
              Nová objednávka
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, color: "#8E8E93", display: "block", marginBottom: 4 }}>Typ</label>
                <select
                  value={form.typ}
                  onChange={(e) => setForm({ ...form, typ: e.target.value as Objednavka["typ"] })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #E5E5EA",
                    fontSize: 15,
                    background: "#F9F9F9",
                    outline: "none",
                  }}
                >
                  {Object.entries(TYP_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, color: "#8E8E93", display: "block", marginBottom: 4 }}>Meno klienta</label>
                <input
                  value={form.klientMeno}
                  onChange={(e) => setForm({ ...form, klientMeno: e.target.value })}
                  placeholder="Ján Novák"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #E5E5EA",
                    fontSize: 15,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: "#8E8E93", display: "block", marginBottom: 4 }}>Nehnuteľnosť</label>
                <input
                  value={form.nehnutelnost}
                  onChange={(e) => setForm({ ...form, nehnutelnost: e.target.value })}
                  placeholder="3-izb. byt, Ružinov (voliteľné)"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #E5E5EA",
                    fontSize: 15,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: "#8E8E93", display: "block", marginBottom: 4 }}>Deadline</label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #E5E5EA",
                    fontSize: 15,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 13, color: "#8E8E93", display: "block", marginBottom: 4 }}>Poznámka</label>
                <textarea
                  value={form.poznamka}
                  onChange={(e) => setForm({ ...form, poznamka: e.target.value })}
                  placeholder="Špeciálne požiadavky..."
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #E5E5EA",
                    fontSize: 15,
                    outline: "none",
                    resize: "vertical",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
            <button
              onClick={addOrder}
              style={{
                marginTop: 16,
                background: "#34C759",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px 28px",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Pridať objednávku
            </button>
          </div>
        )}

        {/* Kanban */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {columns.map((stav) => {
            const items = objednavky.filter((o) => o.stav === stav);
            return (
              <div key={stav}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                    padding: "0 4px",
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: STAV_COLORS[stav],
                    }}
                  />
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#1C1C1E" }}>
                    {STAV_LABELS[stav]}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: "#8E8E93",
                      background: "#E5E5EA",
                      borderRadius: 8,
                      padding: "2px 8px",
                      fontWeight: 500,
                    }}
                  >
                    {items.length}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 200 }}>
                  {items.length === 0 && (
                    <div
                      style={{
                        padding: 24,
                        textAlign: "center",
                        color: "#C7C7CC",
                        fontSize: 14,
                        background: "#fff",
                        borderRadius: 14,
                        border: "2px dashed #E5E5EA",
                      }}
                    >
                      Žiadne objednávky
                    </div>
                  )}
                  {items.map((o) => (
                    <div
                      key={o.id}
                      style={{
                        background: "#fff",
                        borderRadius: 14,
                        padding: 16,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                        borderLeft: `4px solid ${STAV_COLORS[stav]}`,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: STAV_COLORS[stav],
                            background: `${STAV_COLORS[stav]}18`,
                            padding: "3px 8px",
                            borderRadius: 6,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          {TYP_LABELS[o.typ]}
                        </span>
                        <button
                          onClick={() => deleteOrder(o.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#C7C7CC",
                            cursor: "pointer",
                            fontSize: 16,
                            padding: 0,
                            lineHeight: 1,
                          }}
                          title="Odstrániť"
                        >
                          ×
                        </button>
                      </div>
                      <p style={{ fontSize: 16, fontWeight: 600, color: "#1C1C1E", margin: "10px 0 2px" }}>
                        {o.klientMeno}
                      </p>
                      {o.nehnutelnost && (
                        <p style={{ fontSize: 13, color: "#8E8E93", margin: "0 0 4px" }}>{o.nehnutelnost}</p>
                      )}
                      {o.poznamka && (
                        <p style={{ fontSize: 13, color: "#636366", margin: "4px 0", fontStyle: "italic" }}>
                          {o.poznamka}
                        </p>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                        <span style={{ fontSize: 12, color: "#AEAEB2" }}>
                          {new Date(o.datum).toLocaleDateString("sk-SK")}
                        </span>
                        {o.deadline && (
                          <span style={{ fontSize: 12, color: "#FF3B30", fontWeight: 500 }}>
                            do {new Date(o.deadline).toLocaleDateString("sk-SK")}
                          </span>
                        )}
                      </div>
                      {/* Move buttons */}
                      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                        {stav !== "nova" && (
                          <button
                            onClick={() =>
                              moveOrder(o.id, stav === "dokoncena" ? "v_procese" : "nova")
                            }
                            style={{
                              flex: 1,
                              padding: "6px 0",
                              fontSize: 12,
                              fontWeight: 600,
                              border: "1px solid #E5E5EA",
                              borderRadius: 8,
                              background: "#F9F9F9",
                              color: "#636366",
                              cursor: "pointer",
                            }}
                          >
                            ← {stav === "dokoncena" ? "V procese" : "Nové"}
                          </button>
                        )}
                        {stav !== "dokoncena" && (
                          <button
                            onClick={() =>
                              moveOrder(o.id, stav === "nova" ? "v_procese" : "dokoncena")
                            }
                            style={{
                              flex: 1,
                              padding: "6px 0",
                              fontSize: 12,
                              fontWeight: 600,
                              border: "none",
                              borderRadius: 8,
                              background: STAV_COLORS[stav === "nova" ? "v_procese" : "dokoncena"],
                              color: "#fff",
                              cursor: "pointer",
                            }}
                          >
                            {stav === "nova" ? "V procese" : "Dokončené"} →
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
