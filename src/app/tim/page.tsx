"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  klientCount: number;
  naberCount: number;
  nehnutelnostCount: number;
}

export default function TimPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTeam();
  }, []);

  async function fetchTeam() {
    setLoading(true);

    const [{ data: users }, { data: klienti }, { data: nabery }, { data: nehnutelnosti }] = await Promise.all([
      supabase.from("users").select("id, name, email, role"),
      supabase.from("klienti").select("id, makler_id"),
      supabase.from("naberove_listy").select("id, makler_id"),
      supabase.from("nehnutelnosti").select("id, makler"),
    ]);

    const teamMembers: TeamMember[] = (users ?? []).map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role || "makler",
      klientCount: (klienti ?? []).filter((k) => k.makler_id === u.id).length,
      naberCount: (nabery ?? []).filter((n) => n.makler_id === u.id).length,
      nehnutelnostCount: (nehnutelnosti ?? []).filter((n) => n.makler === u.id).length,
    }));

    setMembers(teamMembers);
    setLoading(false);
  }

  async function handleAddMember() {
    if (!formName.trim() || !formEmail.trim()) return;
    setSaving(true);

    const { error } = await supabase.from("users").insert({
      name: formName.trim(),
      email: formEmail.trim(),
      role: "makler",
    });

    if (!error) {
      setFormName("");
      setFormEmail("");
      setFormPhone("");
      setShowForm(false);
      fetchTeam();
    }
    setSaving(false);
  }

  const totalKlienti = members.reduce((s, m) => s + m.klientCount, 0);
  const totalNabery = members.reduce((s, m) => s + m.naberCount, 0);
  const totalNehnutelnosti = members.reduce((s, m) => s + m.nehnutelnostCount, 0);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontSize: "13px",
    color: "var(--text-primary)",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px" }}>
            Tímový pohľad
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
            {user ? `Prihlásený: ${user.name}` : "Správa tímu maklérov"}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: "10px 20px",
            background: "#374151",
            color: "#fff",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: "600",
            border: "none",
            cursor: "pointer",
          }}
        >
          + Pridať makléra
        </button>
      </div>

      {/* Current user card */}
      {user && (
        <div
          style={{
            padding: "20px",
            background: "var(--bg-surface)",
            borderRadius: "14px",
            border: "2px solid #374151",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "#374151",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              fontWeight: "700",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {user.initials || user.name.split(" ").map((w) => w[0]).join("").toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)" }}>{user.name}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {user.email} &middot; {user.role === "admin" ? "Administrátor" : "Maklér"}
            </div>
          </div>
          <div
            style={{
              padding: "4px 12px",
              borderRadius: "20px",
              fontSize: "11px",
              fontWeight: "600",
              color: "#059669",
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
            }}
          >
            Aktívny
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "Makléri", value: members.length },
          { label: "Klienti spolu", value: totalKlienti },
          { label: "Nábery spolu", value: totalNabery },
          { label: "Nehnuteľnosti", value: totalNehnutelnosti },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding: "16px",
              background: "var(--bg-surface)",
              borderRadius: "12px",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "500" }}>
              {s.label}
            </div>
            <div style={{ fontSize: "24px", fontWeight: "700", color: "#374151" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Add member form */}
      {showForm && (
        <div
          style={{
            padding: "24px",
            background: "var(--bg-surface)",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            marginBottom: "20px",
          }}
        >
          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 16px" }}>
            Pridať nového makléra
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <div>
              <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                Meno a priezvisko
              </label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ján Novák" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                Email
              </label>
              <input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="jan@firma.sk" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                Telefón
              </label>
              <input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="+421 900 000 000" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button
              onClick={() => setShowForm(false)}
              style={{
                padding: "8px 16px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              Zrušiť
            </button>
            <button
              onClick={handleAddMember}
              disabled={saving || !formName.trim() || !formEmail.trim()}
              style={{
                padding: "8px 16px",
                background: "#374151",
                color: "#fff",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "600",
                border: "none",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving || !formName.trim() || !formEmail.trim() ? 0.5 : 1,
              }}
            >
              {saving ? "Ukladám..." : "Pridať"}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: "14px" }}>
          Načítavam tím...
        </div>
      )}

      {/* Team list */}
      {!loading && members.length > 0 && (
        <div style={{ background: "var(--bg-surface)", borderRadius: "14px", border: "1px solid var(--border)", overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 100px",
              padding: "12px 20px",
              fontSize: "11px",
              fontWeight: "600",
              color: "var(--text-muted)",
              borderBottom: "1px solid var(--border)",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            <span>Maklér</span>
            <span style={{ textAlign: "center" }}>Klienti</span>
            <span style={{ textAlign: "center" }}>Nábery</span>
            <span style={{ textAlign: "center" }}>Nehnuteľnosti</span>
            <span style={{ textAlign: "right" }}>Rola</span>
          </div>
          {members.map((m, i) => {
            const initials = m.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .toUpperCase();
            const isCurrentUser = user?.id === m.id;
            return (
              <div
                key={m.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 100px",
                  padding: "14px 20px",
                  alignItems: "center",
                  borderBottom: i < members.length - 1 ? "1px solid var(--border)" : "none",
                  fontSize: "13px",
                  background: isCurrentUser ? "rgba(55, 65, 81, 0.03)" : "transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: isCurrentUser ? "#374151" : "#6B7280",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: "700",
                      color: "#fff",
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>
                  <div>
                    <div style={{ fontWeight: "600", color: "var(--text-primary)" }}>
                      {m.name} {isCurrentUser && <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>(vy)</span>}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{m.email}</div>
                  </div>
                </div>
                <div style={{ textAlign: "center", fontWeight: "600", color: "var(--text-primary)" }}>{m.klientCount}</div>
                <div style={{ textAlign: "center", fontWeight: "600", color: "var(--text-primary)" }}>{m.naberCount}</div>
                <div style={{ textAlign: "center", fontWeight: "600", color: "var(--text-primary)" }}>{m.nehnutelnostCount}</div>
                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      padding: "3px 10px",
                      borderRadius: "20px",
                      fontWeight: "600",
                      color: m.role === "admin" ? "#7C3AED" : "#374151",
                      background: m.role === "admin" ? "#F5F3FF" : "#F3F4F6",
                    }}
                  >
                    {m.role === "admin" ? "Admin" : "Maklér"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty */}
      {!loading && members.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "80px 20px",
            background: "var(--bg-surface)",
            borderRadius: "16px",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>&#128101;</div>
          <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>
            Zatiaľ žiadni členovia tímu
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Pridajte prvého makléra do tímu</div>
        </div>
      )}
    </div>
  );
}
