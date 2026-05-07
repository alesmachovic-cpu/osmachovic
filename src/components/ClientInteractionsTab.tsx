"use client";

import { useState, useEffect } from "react";

interface Interaction {
  id: string;
  klient_id: string;
  typ: "call" | "email" | "meeting" | "note" | "whatsapp" | "other";
  subject: string | null;
  body: string | null;
  occurred_at: string;
  created_by: string;
  created_at: string;
}

const TYP_CFG: Record<string, { icon: string; label: string; color: string }> = {
  call:     { icon: "📞", label: "Hovor",    color: "#3B82F6" },
  email:    { icon: "✉️", label: "Email",    color: "#8B5CF6" },
  meeting:  { icon: "🤝", label: "Stretnutie", color: "#059669" },
  note:     { icon: "📝", label: "Poznámka", color: "#F59E0B" },
  whatsapp: { icon: "💬", label: "WhatsApp", color: "#25D366" },
  other:    { icon: "📌", label: "Iné",      color: "#6B7280" },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("sk-SK", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ClientInteractionsTab({ klientId, userId }: { klientId: string; userId: string }) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [typ, setTyp] = useState<string>("call");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/client-interactions?klient_id=${klientId}`);
    if (r.ok) {
      const d = await r.json();
      setInteractions(d.interactions ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [klientId]);

  async function handleSave() {
    if (!subject.trim() && !body.trim()) return;
    setSaving(true);
    await fetch("/api/client-interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ klient_id: klientId, typ, subject: subject.trim() || null, body: body.trim() || null, occurred_at: new Date(occurredAt).toISOString() }),
    });
    setShowForm(false);
    setSubject(""); setBody("");
    setOccurredAt(new Date().toISOString().slice(0, 16));
    setSaving(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Odstrániť interakciu?")) return;
    await fetch(`/api/client-interactions?id=${id}`, { method: "DELETE" });
    setInteractions(prev => prev.filter(i => i.id !== id));
  }

  const inputSt: React.CSSProperties = {
    width: "100%", padding: "9px 12px", background: "var(--bg-elevated)",
    border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px",
    color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
  };
  const labelSt: React.CSSProperties = {
    fontSize: "11px", fontWeight: "600", color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.03em", display: "block", marginBottom: "4px",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-muted)" }}>
          {interactions.length} interakcií
        </div>
        <button onClick={() => setShowForm(v => !v)} style={{
          padding: "7px 16px", background: "#374151", color: "#fff", border: "none",
          borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer",
        }}>
          {showForm ? "Zrušiť" : "+ Nová interakcia"}
        </button>
      </div>

      {showForm && (
        <div style={{
          padding: "16px", borderRadius: "12px", background: "var(--bg-elevated)",
          border: "1px solid var(--border)", marginBottom: "20px",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label style={labelSt}>Typ</label>
              <select value={typ} onChange={e => setTyp(e.target.value)} style={inputSt}>
                {Object.entries(TYP_CFG).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelSt}>Dátum & čas</label>
              <input type="datetime-local" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} style={inputSt} />
            </div>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label style={labelSt}>Predmet</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} style={inputSt}
              placeholder="napr. Dohoda o cene, Záujem o byt..." />
          </div>
          <div style={{ marginBottom: "14px" }}>
            <label style={labelSt}>Poznámky</label>
            <textarea value={body} onChange={e => setBody(e.target.value)}
              rows={3} style={{ ...inputSt, resize: "vertical" }}
              placeholder="Čo sa riešilo, ďalší krok..." />
          </div>
          <button onClick={handleSave} disabled={saving || (!subject.trim() && !body.trim())} style={{
            padding: "9px 20px", background: saving ? "#9CA3AF" : "#374151", color: "#fff",
            border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600",
            cursor: saving ? "not-allowed" : "pointer",
          }}>
            {saving ? "Ukladám..." : "Uložiť"}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Načítavam...</div>
      ) : interactions.length === 0 ? (
        <div style={{
          padding: "32px", textAlign: "center", borderRadius: "12px",
          border: "1px dashed var(--border)", color: "var(--text-muted)", fontSize: "13px",
        }}>
          Žiadne interakcie. Zaznamenaj prvý kontakt s klientom.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {interactions.map(item => {
            const cfg = TYP_CFG[item.typ] ?? TYP_CFG.other;
            return (
              <div key={item.id} style={{
                padding: "14px 16px", borderRadius: "10px",
                background: "var(--bg-surface)", border: "1px solid var(--border)",
                display: "flex", gap: "12px", alignItems: "flex-start",
              }}>
                <div style={{
                  width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                  background: cfg.color + "18", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "15px",
                }}>{cfg.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: cfg.color }}>{cfg.label}</span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{formatDate(item.occurred_at)}</span>
                  </div>
                  {item.subject && (
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "4px" }}>
                      {item.subject}
                    </div>
                  )}
                  {item.body && (
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", whiteSpace: "pre-line", lineHeight: 1.5 }}>
                      {item.body}
                    </div>
                  )}
                </div>
                <button onClick={() => handleDelete(item.id)} title="Odstrániť" style={{
                  width: "24px", height: "24px", borderRadius: "6px", border: "none",
                  background: "transparent", cursor: "pointer", color: "var(--text-muted)",
                  fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
