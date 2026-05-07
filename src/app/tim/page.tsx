"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

type Role = "super_admin" | "majitel" | "manazer" | "makler";

interface Pobocka { id: string; nazov: string; mesto: string; }
interface Member {
  id: string; name: string; email: string; role: Role;
  pobocka_id: string | null; klientCount: number; naberCount: number; nehnutelnostCount: number;
}

const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super admin", majitel: "Majiteľ", manazer: "Manažér", makler: "Maklér",
};
const ROLE_COLORS: Record<Role, { bg: string; color: string }> = {
  super_admin: { bg: "#f5f3ff", color: "#7c3aed" },
  majitel:     { bg: "#fef3c7", color: "#d97706" },
  manazer:     { bg: "#dbeafe", color: "#2563eb" },
  makler:      { bg: "#f3f4f6", color: "#374151" },
};
const ROLE_ORDER: Role[] = ["super_admin", "majitel", "manazer", "makler"];

function avatarInitials(name: string) {
  return name.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2) || "??";
}

export default function TimPage() {
  const { user } = useAuth();
  const role = (user?.role ?? "makler") as Role;
  const canEditRole = role === "super_admin" || role === "majitel";
  const canEditBranch = role === "super_admin" || role === "majitel" || role === "manazer";

  const [members, setMembers] = useState<Member[]>([]);
  const [pobocky, setPobocky] = useState<Pobocka[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<Role>("makler");
  const [formPobocka, setFormPobocka] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: users }, { data: klienti }, { data: nabery }, { data: nehn }, { data: pb }] = await Promise.all([
      supabase.from("users").select("id, name, email, role, pobocka_id"),
      supabase.from("klienti").select("id, makler_id"),
      supabase.from("naberove_listy").select("id, makler_id"),
      supabase.from("nehnutelnosti").select("id, makler_id"),
      supabase.from("pobocky").select("id, nazov, mesto").order("nazov"),
    ]);

    setPobocky(pb ?? []);

    let filtered = users ?? [];
    // Manazer vidí len svoju pobočku + seba
    if (role === "manazer") {
      const myPobocka = (user as unknown as { pobocka_id?: string })?.pobocka_id;
      filtered = filtered.filter(u => u.id === user?.id || u.pobocka_id === myPobocka);
    }

    setMembers(filtered.map(u => ({
      id: u.id,
      name: u.name || u.email,
      email: u.email,
      role: (u.role || "makler") as Role,
      pobocka_id: u.pobocka_id,
      klientCount: (klienti ?? []).filter(k => k.makler_id === u.id).length,
      naberCount: (nabery ?? []).filter(n => n.makler_id === u.id).length,
      nehnutelnostCount: (nehn ?? []).filter(n => n.makler_id === u.id).length,
    })));
    setLoading(false);
  }, [role, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function updateUser(id: string, patch: { role?: Role; pobocka_id?: string | null }) {
    setSaving(id);
    const res = await fetch("/api/tim/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (res.ok) {
      setMembers(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
    }
    setSaving(null);
  }

  async function handleAddMember() {
    if (!formName.trim() || !formEmail.trim()) return;
    setFormSaving(true);
    const { error } = await supabase.from("users").insert({
      name: formName.trim(),
      email: formEmail.trim(),
      role: formRole,
      pobocka_id: formPobocka || null,
    });
    if (!error) {
      setFormName(""); setFormEmail(""); setFormRole("makler"); setFormPobocka("");
      setShowForm(false);
      fetchData();
    }
    setFormSaving(false);
  }

  // Group by role
  const grouped = ROLE_ORDER.map(r => ({
    role: r,
    members: members.filter(m => m.role === r),
  })).filter(g => g.members.length > 0);

  const pobockaName = (id: string | null) => {
    if (!id) return "—";
    return pobocky.find(p => p.id === id)?.nazov ?? id;
  };

  const inputS: React.CSSProperties = {
    width: "100%", padding: "9px 12px", background: "var(--bg-elevated)",
    border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px",
    color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
  };
  const selectS: React.CSSProperties = { ...inputS, cursor: "pointer" };

  return (
    <div style={{ maxWidth: "1000px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 4px", color: "var(--text-primary)" }}>Správa tímu</h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
            {members.length} členov · {pobocky.length} pobočiek
          </p>
        </div>
        {canEditRole && (
          <button onClick={() => setShowForm(!showForm)} style={{
            padding: "9px 18px", background: "var(--text-primary)", color: "var(--bg-base)",
            borderRadius: "10px", fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer",
          }}>
            + Pridať člena
          </button>
        )}
      </div>

      {/* Summary chips */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        {ROLE_ORDER.map(r => {
          const count = members.filter(m => m.role === r).length;
          if (!count) return null;
          const c = ROLE_COLORS[r];
          return (
            <div key={r} style={{ padding: "5px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, background: c.bg, color: c.color }}>
              {ROLE_LABELS[r]} · {count}
            </div>
          );
        })}
        {pobocky.map(p => {
          const count = members.filter(m => m.pobocka_id === p.id).length;
          if (!count) return null;
          return (
            <div key={p.id} style={{ padding: "5px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 500, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              {p.nazov} · {count}
            </div>
          );
        })}
      </div>

      {/* Add form */}
      {showForm && canEditRole && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
          <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "14px" }}>Nový člen tímu</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px", marginBottom: "14px" }}>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "5px" }}>Meno</label>
              <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ján Novák" style={inputS} />
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "5px" }}>Email</label>
              <input value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="jan@vianema.eu" style={inputS} />
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "5px" }}>Rola</label>
              <select value={formRole} onChange={e => setFormRole(e.target.value as Role)} style={selectS}>
                {(role === "super_admin" ? ROLE_ORDER : ROLE_ORDER.filter(r => r !== "super_admin")).map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "5px" }}>Pobočka</label>
              <select value={formPobocka} onChange={e => setFormPobocka(e.target.value)} style={selectS}>
                <option value="">— bez pobočky —</option>
                {pobocky.map(p => <option key={p.id} value={p.id}>{p.nazov}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button onClick={() => setShowForm(false)} style={{ padding: "7px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", cursor: "pointer", color: "var(--text-secondary)" }}>Zrušiť</button>
            <button onClick={handleAddMember} disabled={formSaving || !formName.trim() || !formEmail.trim()} style={{ padding: "7px 14px", background: "var(--text-primary)", color: "var(--bg-base)", borderRadius: "8px", fontSize: "12px", fontWeight: 600, border: "none", cursor: "pointer", opacity: formSaving ? 0.5 : 1 }}>
              {formSaving ? "Ukladám..." : "Pridať"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>Načítavam...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {grouped.map(group => (
            <div key={group.role} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
              {/* Group header */}
              <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "10px", background: "var(--bg-elevated)" }}>
                <div style={{ padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 700, background: ROLE_COLORS[group.role].bg, color: ROLE_COLORS[group.role].color }}>
                  {ROLE_LABELS[group.role]}
                </div>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{group.members.length} {group.members.length === 1 ? "člen" : "členov"}</span>
              </div>

              {/* Column headers */}
              <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1.5fr 1.5fr 80px 80px 80px", padding: "8px 20px", fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)" }}>
                <span>Člen</span>
                <span>Rola</span>
                <span>Pobočka</span>
                <span style={{ textAlign: "center" }}>Klienti</span>
                <span style={{ textAlign: "center" }}>Nábery</span>
                <span style={{ textAlign: "center" }}>Nehn.</span>
              </div>

              {group.members.map((m, i) => {
                const isMe = user?.id === m.id;
                const isSuperAdmin = m.role === "super_admin";
                const canEditThisRole = canEditRole && !isMe && !(isSuperAdmin && role !== "super_admin");
                const canEditThisBranch = canEditBranch && !isMe && !isSuperAdmin;
                const isSaving = saving === m.id;

                return (
                  <div key={m.id} style={{
                    display: "grid", gridTemplateColumns: "2.5fr 1.5fr 1.5fr 80px 80px 80px",
                    padding: "12px 20px", alignItems: "center",
                    borderBottom: i < group.members.length - 1 ? "1px solid var(--border)" : "none",
                    background: isMe ? "var(--sidebar-active, rgba(0,122,255,0.04))" : "transparent",
                    opacity: isSaving ? 0.6 : 1, transition: "opacity 0.2s",
                  }}>
                    {/* Meno */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <div style={{ width: "34px", height: "34px", borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#fff", background: isSuperAdmin ? "#7c3aed" : m.role === "majitel" ? "#d97706" : m.role === "manazer" ? "#2563eb" : "#374151" }}>
                        {avatarInitials(m.name)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                          {m.name}
                          {isMe && <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 400 }}>(vy)</span>}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</div>
                      </div>
                    </div>

                    {/* Rola */}
                    <div>
                      {canEditThisRole ? (
                        <select
                          value={m.role}
                          onChange={e => updateUser(m.id, { role: e.target.value as Role })}
                          disabled={isSaving}
                          style={{ padding: "4px 8px", borderRadius: "8px", border: `1px solid ${ROLE_COLORS[m.role].color}40`, background: ROLE_COLORS[m.role].bg, color: ROLE_COLORS[m.role].color, fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                        >
                          {(role === "super_admin" ? ROLE_ORDER : ROLE_ORDER.filter(r => r !== "super_admin")).map(r => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 600, background: ROLE_COLORS[m.role].bg, color: ROLE_COLORS[m.role].color }}>
                          {ROLE_LABELS[m.role]}
                        </span>
                      )}
                    </div>

                    {/* Pobočka */}
                    <div>
                      {canEditThisBranch ? (
                        <select
                          value={m.pobocka_id ?? ""}
                          onChange={e => updateUser(m.id, { pobocka_id: e.target.value || null })}
                          disabled={isSaving}
                          style={{ padding: "4px 8px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "11px", cursor: "pointer" }}
                        >
                          <option value="">— bez pobočky —</option>
                          {pobocky.map(p => <option key={p.id} value={p.id}>{p.nazov}</option>)}
                        </select>
                      ) : (
                        <span style={{ fontSize: "12px", color: m.pobocka_id ? "var(--text-primary)" : "var(--text-muted)" }}>
                          {pobockaName(m.pobocka_id)}
                        </span>
                      )}
                    </div>

                    {/* Stats */}
                    <div style={{ textAlign: "center", fontWeight: 600, fontSize: "13px" }}>{m.klientCount}</div>
                    <div style={{ textAlign: "center", fontWeight: 600, fontSize: "13px" }}>{m.naberCount}</div>
                    <div style={{ textAlign: "center", fontWeight: 600, fontSize: "13px" }}>{m.nehnutelnostCount}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
