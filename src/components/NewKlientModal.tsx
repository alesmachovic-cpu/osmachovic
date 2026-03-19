"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { STATUS_LABELS, KRAJE } from "@/lib/database.types";
import type { TypNehnutelnosti, StatusKlienta, Priorita } from "@/lib/database.types";

const LABEL: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: "700",
  color: "var(--text-muted)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  marginBottom: "5px",
  display: "block",
};

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  background: "#fff",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  fontSize: "13.5px",
  color: "var(--text-primary)",
  outline: "none",
};

interface Props {
  initialPhone?: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function NewKlientModal({ initialPhone = "", onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    mobil: initialPhone,
    meno: "",
    email: "",
    status: "novy_kontakt" as StatusKlienta,
    typ: "" as TypNehnutelnosti | "",
    lokalita: "",
    ulica: "",
    datum_stretnutia: "",
    poznamka: "",
    priorita: "stredna" as Priorita,
    rozpocet_max: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiFilling, setAiFilling] = useState(false);

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleAiFill() {
    if (!aiText.trim()) return;
    setAiFilling(true);
    try {
      const res = await fetch("/api/ai-fill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: aiText }) });
      const data = await res.json();
      if (data.meno)          set("meno", data.meno);
      if (data.mobil)         set("mobil", data.mobil);
      if (data.email)         set("email", data.email);
      if (data.typ)           set("typ", data.typ);
      if (data.lokalita)      set("lokalita", data.lokalita);
      if (data.poznamka)      set("poznamka", data.poznamka);
      if (data.rozpocet_max)  setForm(f => ({ ...f, rozpocet_max: String(data.rozpocet_max) }));
      setAiText("");
    } catch {
      setError("AI Fast-fill zlyhalo");
    }
    setAiFilling(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.meno.trim()) { setError("Meno a priezvisko je povinné"); return; }
    setSaving(true);
    const { error: err } = await supabase.from("klienti").insert({
      meno: form.meno.trim(),
      mobil: form.mobil || null,
      email: form.email || null,
      status: form.status,
      typ: (form.typ || null) as TypNehnutelnosti | null,
      lokalita: form.lokalita || null,
      ulica: form.ulica || null,
      datum_stretnutia: form.datum_stretnutia || null,
      poznamka: form.poznamka || null,
      priorita: form.priorita,
      rozpocet_min: null,
      rozpocet_max: form.rozpocet_max ? Number(form.rozpocet_max) : null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 200, padding: "20px",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          borderRadius: "12px",
          border: "1px solid var(--border)",
          width: "100%",
          maxWidth: "560px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--bg-elevated)",
          }}
        >
          <span style={{ fontWeight: "700", fontSize: "15px", color: "var(--text-primary)" }}>
            + Nový klient
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "22px", lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "20px 22px 22px", maxHeight: "75vh", overflowY: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

            {/* AI Fast-fill */}
            <div style={{ padding: "12px 14px", background: "#EBF0FF", border: "1px solid #C7D2FE", borderRadius: "8px" }}>
              <div style={{ fontWeight: "700", fontSize: "13px", color: "#3730A3", marginBottom: "4px" }}>✨ AI Fast-fill</div>
              <div style={{ fontSize: "12px", color: "#4338CA", marginBottom: "8px" }}>Vlož text z emailu alebo správy — AI vyplní polia automaticky.</div>
              <textarea
                placeholder="Napr: Dobrý deň, volám sa Ján Novák, hľadám 3-izbový byt v Bratislave do 200 000€, tel: 0900 123 456"
                value={aiText}
                onChange={e => setAiText(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #C7D2FE", borderRadius: "6px", fontSize: "12.5px", resize: "none", height: "60px", outline: "none", background: "#fff" }}
              />
              <button type="button" onClick={handleAiFill} disabled={aiFilling || !aiText.trim()}
                style={{ marginTop: "6px", padding: "7px 16px", background: aiFilling ? "#A5B4FC" : "#6366F1", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12.5px", fontWeight: "600", cursor: aiFilling ? "not-allowed" : "pointer" }}>
                {aiFilling ? "Vypĺňam..." : "Vyplniť formulár"}
              </button>
            </div>

            {/* Telefón */}
            <div>
              <label style={LABEL}>Telefón *</label>
              <input style={INPUT} placeholder="+421 900 000 000" value={form.mobil}
                onChange={e => set("mobil", e.target.value)} />
            </div>

            {/* Meno */}
            <div>
              <label style={LABEL}>Meno a Priezvisko *</label>
              <input style={INPUT} placeholder="Ján Novák" value={form.meno}
                onChange={e => set("meno", e.target.value)} />
            </div>

            {/* Email */}
            <div>
              <label style={LABEL}>Email</label>
              <input style={INPUT} type="email" placeholder="jan@email.sk" value={form.email}
                onChange={e => set("email", e.target.value)} />
            </div>

            {/* Status + Typ */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={LABEL}>Status *</label>
                <select style={INPUT} value={form.status} onChange={e => set("status", e.target.value)}>
                  {(Object.entries(STATUS_LABELS) as [StatusKlienta, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={LABEL}>Typ Nehnuteľnosti *</label>
                <select style={INPUT} value={form.typ} onChange={e => set("typ", e.target.value)}>
                  <option value="">— vyberte —</option>
                  <option value="byt">Byt</option>
                  <option value="dom">Dom</option>
                  <option value="pozemok">Pozemok</option>
                </select>
              </div>
            </div>

            {/* Lokalita */}
            <div>
              <label style={LABEL}>Lokalita *</label>
              <select style={INPUT} value={form.lokalita} onChange={e => set("lokalita", e.target.value)}>
                <option value="">— vyberte kraj —</option>
                {KRAJE.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>

            {/* Ulica */}
            <div>
              <label style={LABEL}>Ulica</label>
              <input style={INPUT} placeholder="napr. Hlavná 12, Bratislava" value={form.ulica}
                onChange={e => set("ulica", e.target.value)} />
            </div>

            {/* Dátum stretnutia */}
            <div>
              <label style={LABEL}>Dátum Stretnutia</label>
              <input style={INPUT} type="date" value={form.datum_stretnutia}
                onChange={e => set("datum_stretnutia", e.target.value)} />
            </div>

            {/* Poznámka */}
            <div>
              <label style={LABEL}>Poznámka</label>
              <textarea
                style={{ ...INPUT, resize: "none", height: "80px" }}
                placeholder="Napr. hľadá od jari, preferuje tiché prostredie..."
                value={form.poznamka}
                onChange={e => set("poznamka", e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div style={{ marginTop: "12px", padding: "10px 12px", background: "#FEE2E2", borderRadius: "7px", fontSize: "13px", color: "#991B1B" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13.5px", fontWeight: "500", cursor: "pointer", color: "var(--text-secondary)" }}>
              Zrušiť
            </button>
            <button type="submit" disabled={saving}
              style={{ flex: 2, padding: "10px", background: saving ? "#93C5FD" : "var(--accent)", border: "none", borderRadius: "8px", fontSize: "13.5px", fontWeight: "600", cursor: saving ? "not-allowed" : "pointer", color: "#fff" }}>
              {saving ? "Ukladám..." : "Uložiť klienta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
