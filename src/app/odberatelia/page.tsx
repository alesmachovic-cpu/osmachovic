"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";

type Odberatel = {
  id: string;
  nazov: string;
  adresa: string | null;
  ico: string | null;
  dic: string | null;
  ic_dph: string | null;
  email: string | null;
  telefon: string | null;
};

const inputSt: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  background: "var(--bg-surface)",
  color: "var(--text-primary)",
  fontSize: "14px",
};
const labelSt: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: "4px",
};

export default function OdberateliaPage() {
  const { user } = useAuth();
  const [list, setList] = useState<Odberatel[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Odberatel | null>(null);
  const [q, setQ] = useState("");
  const [icoLooking, setIcoLooking] = useState(false);
  const [icoErr, setIcoErr] = useState("");

  const [form, setForm] = useState({
    nazov: "",
    adresa: "",
    ico: "",
    dic: "",
    ic_dph: "",
    email: "",
    telefon: "",
  });

  const load = useCallback(async () => {
    if (!user?.id) { setList([]); setLoading(false); return; }
    setLoading(true);
    const r = await fetch(`/api/odberatelia?user_id=${user.id}`);
    const d = await r.json();
    setList(Array.isArray(d) ? d : []);
    setLoading(false);
  }, [user?.id]);
  useEffect(() => { load(); }, [load]);

  async function lookupIco() {
    const ico = form.ico.replace(/\s/g, "");
    if (!ico) return;
    setIcoLooking(true);
    setIcoErr("");
    try {
      const r = await fetch(`/api/ico-lookup?ico=${encodeURIComponent(ico)}`);
      const d = await r.json();
      if (!r.ok) { setIcoErr(d.error || "Nenájdené"); return; }
      setForm((prev) => ({
        ...prev,
        nazov: d.nazov || prev.nazov,
        adresa: d.adresa || prev.adresa,
        dic: d.dic || prev.dic,
        ic_dph: d.ic_dph || prev.ic_dph,
      }));
    } catch {
      setIcoErr("Chyba siete");
    } finally {
      setIcoLooking(false);
    }
  }

  function openNew() {
    setEditing(null);
    setForm({ nazov: "", adresa: "", ico: "", dic: "", ic_dph: "", email: "", telefon: "" });
    setIcoErr("");
    setModalOpen(true);
  }
  function openEdit(o: Odberatel) {
    setEditing(o);
    setIcoErr("");
    setForm({
      nazov: o.nazov || "",
      adresa: o.adresa || "",
      ico: o.ico || "",
      dic: o.dic || "",
      ic_dph: o.ic_dph || "",
      email: o.email || "",
      telefon: o.telefon || "",
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.nazov.trim()) return alert("Názov je povinný");
    if (!user?.id) return alert("Nie si prihlásený");
    const method = editing ? "PATCH" : "POST";
    const body = editing ? { id: editing.id, ...form } : { user_id: user.id, ...form };
    const r = await fetch("/api/odberatelia", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const e = await r.json();
      return alert("Chyba: " + (e.error || ""));
    }
    setModalOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Zmazať odberateľa?")) return;
    await fetch(`/api/odberatelia?id=${id}`, { method: "DELETE" });
    load();
  }

  const filtered = list.filter((o) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      o.nazov.toLowerCase().includes(s) ||
      (o.ico || "").toLowerCase().includes(s) ||
      (o.dic || "").toLowerCase().includes(s)
    );
  });

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#374151" }}>Odberatelia</h1>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
            Databáza odberateľov pre fakturáciu
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            placeholder="Hľadať…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ ...inputSt, width: "240px" }}
          />
          <button
            onClick={openNew}
            style={{
              background: "#374151",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              padding: "10px 16px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Nový odberateľ
          </button>
        </div>
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr auto",
          gap: "12px",
          padding: "12px 16px",
          background: "var(--bg-elevated)",
          fontSize: "11px",
          fontWeight: 700,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }} className="table-header">
          <div>Názov</div>
          <div>Adresa</div>
          <div>IČO</div>
          <div>DIČ</div>
          <div>IČ DPH</div>
          <div></div>
        </div>
        {loading ? (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>Načítavam…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>
            Žiadni odberatelia. Pridaj prvého kliknutím na „+ Nový odberateľ".
          </div>
        ) : (
          filtered.map((o) => (
            <div
              key={o.id}
              className="table-row"
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr auto",
                gap: "12px",
                padding: "14px 16px",
                borderTop: "1px solid var(--border-subtle)",
                fontSize: "13px",
                color: "var(--text-primary)",
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 600 }}>{o.nazov}</div>
              <div className="table-cell-hide" style={{ color: "var(--text-secondary)" }}>{o.adresa || "—"}</div>
              <div className="table-cell-hide">{o.ico || "—"}</div>
              <div className="table-cell-hide">{o.dic || "—"}</div>
              <div className="table-cell-hide">{o.ic_dph || "—"}</div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => openEdit(o)}
                  style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "12px" }}
                >
                  Upraviť
                </button>
                <button
                  onClick={() => remove(o.id)}
                  style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "12px", color: "var(--danger)" }}
                >
                  Zmazať
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--bg-surface)", borderRadius: "16px", width: "560px", maxWidth: "100%", padding: "24px", maxHeight: "90vh", overflow: "auto" }}
          >
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#374151", marginBottom: "16px" }}>
              {editing ? "Upraviť odberateľa" : "Nový odberateľ"}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <div style={labelSt}>Názov *</div>
                <input style={inputSt} value={form.nazov} onChange={(e) => setForm({ ...form, nazov: e.target.value })} />
              </div>
              <div>
                <div style={labelSt}>Adresa</div>
                <input style={inputSt} value={form.adresa} onChange={(e) => setForm({ ...form, adresa: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <div>
                  <div style={labelSt}>IČO</div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input style={inputSt} value={form.ico} onChange={(e) => setForm({ ...form, ico: e.target.value })} />
                    <button
                      onClick={lookupIco}
                      disabled={icoLooking || !form.ico.trim()}
                      title="Nájsť údaje podľa IČO"
                      style={{
                        flexShrink: 0,
                        padding: "0 10px",
                        border: "1px solid var(--border)",
                        borderRadius: "10px",
                        background: "var(--bg-elevated)",
                        color: "var(--text-primary)",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: icoLooking || !form.ico.trim() ? "not-allowed" : "pointer",
                        opacity: icoLooking || !form.ico.trim() ? 0.5 : 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {icoLooking ? "…" : "Nájsť"}
                    </button>
                  </div>
                  {icoErr && <div style={{ fontSize: "11px", color: "var(--danger)", marginTop: "4px" }}>{icoErr}</div>}
                </div>
                <div>
                  <div style={labelSt}>DIČ</div>
                  <input style={inputSt} value={form.dic} onChange={(e) => setForm({ ...form, dic: e.target.value })} />
                </div>
                <div>
                  <div style={labelSt}>IČ DPH</div>
                  <input style={inputSt} value={form.ic_dph} onChange={(e) => setForm({ ...form, ic_dph: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <div style={labelSt}>Email</div>
                  <input style={inputSt} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <div style={labelSt}>Telefón</div>
                  <input style={inputSt} value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.target.value })} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px 16px", cursor: "pointer", fontSize: "14px", fontWeight: 600 }}
              >
                Zrušiť
              </button>
              <button
                onClick={save}
                style={{ background: "#374151", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", cursor: "pointer", fontSize: "14px", fontWeight: 600 }}
              >
                Uložiť
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
