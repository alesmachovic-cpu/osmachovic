"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";

// ─── Typy ────────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  klientCount: number;
  naberCount: number;
}

type ClenTimu = {
  id: string;
  osoba: string;
  rola: "fotograf" | "pravnik" | "technik";
  stav: "volny" | "pracuje" | "dovolenka";
  aktualnaZakazka?: string;
  kapacitaDenne: number;
  obsadene: number;
};

type Makler = { id: string; meno: string; percento: number };
type Faktura = {
  id: string;
  cislo_faktury: string;
  datum_vystavenia: string;
  suma_celkom: number;
  zaplatene: boolean;
  poznamka: string | null;
  odberatel_snapshot: { nazov?: string } | null;
};

// ─── Konštanty ───────────────────────────────────────────────────────────────

const STAV_CONFIG: Record<ClenTimu["stav"], { label: string; color: string; bg: string }> = {
  volny:     { label: "Voľný",     color: "#34C759", bg: "#34C75918" },
  pracuje:   { label: "Pracuje",   color: "#FF9500", bg: "#FF950018" },
  dovolenka: { label: "Dovolenka", color: "#8E8E93", bg: "#8E8E9318" },
};
const ROLA_LABELS: Record<ClenTimu["rola"], string> = { fotograf: "Fotograf", pravnik: "Právnik", technik: "Technik" };
const DEFAULT_TEAM: ClenTimu[] = [
  { id: "1", osoba: "Marek",          rola: "fotograf", stav: "volny", kapacitaDenne: 4, obsadene: 0 },
  { id: "2", osoba: "JUDr. Horváth",  rola: "pravnik",  stav: "volny", kapacitaDenne: 3, obsadene: 0 },
  { id: "3", osoba: "Peter",          rola: "technik",  stav: "volny", kapacitaDenne: 5, obsadene: 0 },
];
const LS_KEY = "os_machovic_vytazenost";
const DNI = ["Po", "Ut", "St", "Št", "Pi"];

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
  padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "10px",
  background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "14px", width: "100%",
  boxSizing: "border-box",
};
const labelSt: React.CSSProperties = {
  fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "5px",
};

// ─── Access guard ─────────────────────────────────────────────────────────────

export default function TimPage() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const canAccess = role === "super_admin" || role === "majitel" || role === "manazer";

  if (user && !canAccess) {
    return (
      <div style={{ maxWidth: "480px", margin: "80px auto", textAlign: "center", padding: "0 24px" }}>
        <div style={{ fontSize: "40px", marginBottom: "16px" }}>🔒</div>
        <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>Nemáš prístup</div>
        <div style={{ fontSize: "14px", color: "var(--text-muted)" }}>Táto sekcia je dostupná len pre manažérov a vedenie.</div>
      </div>
    );
  }
  return <TimContent />;
}

// ─── Hlavný obsah ─────────────────────────────────────────────────────────────

function TimContent() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"tim" | "vytazenost" | "provizie">("tim");

  const tabs = [
    { id: "tim" as const,        label: "👥 Tím" },
    { id: "vytazenost" as const, label: "👷 Vyťaženosť" },
    { id: "provizie" as const,   label: "💼 Provízie" },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
          Správa tímu
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
          {user?.name} · {user?.role}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--bg-elevated)", borderRadius: 12, padding: 4, width: "fit-content" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 600, transition: "all 0.15s",
            background: tab === t.id ? "var(--bg-surface)" : "transparent",
            color: tab === t.id ? "var(--text-primary)" : "var(--text-muted)",
            boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "tim"        && <TabTim />}
      {tab === "vytazenost" && <TabVytazenost />}
      {tab === "provizie"   && <TabProvizie />}
    </div>
  );
}

// ─── Tab: Tím ─────────────────────────────────────────────────────────────────

function TabTim() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName]   = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole]   = useState("makler");
  const [saving, setSaving]       = useState(false);
  const [inviteSending, setInviteSending] = useState<string | null>(null);
  const [inviteSentFor, setInviteSentFor] = useState<string | null>(null);

  useEffect(() => { fetchTeam(); }, []);

  async function fetchTeam() {
    setLoading(true);
    const [usersData, klienti, nabery] = await Promise.all([
      fetch("/api/users").then(r => r.json()),
      fetch("/api/klienti").then(r => r.json()),
      fetch("/api/nabery").then(r => r.json()),
    ]);
    const users = usersData.users ?? [];
    setMembers(users.map((u: { id: string; name: string; email: string; role: string }) => ({
      id: u.id, name: u.name, email: u.email, role: u.role || "makler",
      klientCount: (klienti ?? []).filter((k: { makler_id: string }) => k.makler_id === u.id).length,
      naberCount:  (nabery  ?? []).filter((n: { makler_id: string }) => n.makler_id === u.id).length,
    })));
    setLoading(false);
  }

  async function handleCreate() {
    if (!formName.trim() || !formEmail.trim()) return;
    setSaving(true);
    const id = formName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const parts = formName.trim().split(" ");
    const initials = `${(parts[0] || "")[0] || ""}${(parts[1] || "")[0] || ""}`.toUpperCase();
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: formName.trim(), initials, email: formEmail.trim(), role: formRole, password: "" }),
    });
    if (res.ok) {
      setFormName(""); setFormEmail(""); setFormRole("makler"); setShowForm(false);
      fetchTeam();
    }
    setSaving(false);
  }

  async function sendInvite(memberId: string) {
    if (inviteSending) return;
    setInviteSending(memberId);
    const res = await fetch("/api/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: memberId }),
    });
    setInviteSending(null);
    if (res.ok) {
      setInviteSentFor(memberId);
      setTimeout(() => setInviteSentFor(null), 5000);
    } else {
      alert("Pozvánku sa nepodarilo odoslať.");
    }
  }

  const roleLabel = (r: string) => {
    if (r === "super_admin") return "Admin";
    if (r === "majitel")    return "Majiteľ";
    if (r === "manazer")    return "Manažér";
    return "Maklér";
  };

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Členov tímu",    value: members.length },
          { label: "Klienti spolu",  value: members.reduce((s, m) => s + m.klientCount, 0) },
          { label: "Nábery spolu",   value: members.reduce((s, m) => s + m.naberCount, 0) },
        ].map(s => (
          <div key={s.label} style={{ padding: 16, background: "var(--bg-surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: "9px 18px", background: "#374151", color: "#fff",
          borderRadius: 10, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
        }}>
          + Nový účet
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ padding: 20, background: "var(--bg-surface)", borderRadius: 14, border: "1px solid var(--border)", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>Nový účet</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }} className="naber-grid">
            <div>
              <label style={labelSt}>Meno a priezvisko</label>
              <input style={inputSt} value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ján Novák" />
            </div>
            <div>
              <label style={labelSt}>Email</label>
              <input type="email" style={inputSt} value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="jan@vianema.eu" />
            </div>
            <div>
              <label style={labelSt}>Rola</label>
              <select style={inputSt} value={formRole} onChange={e => setFormRole(e.target.value)}>
                <option value="makler">Maklér</option>
                <option value="manazer">Manažér</option>
                <option value="majitel">Majiteľ</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowForm(false)} style={{ padding: "8px 16px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
              Zrušiť
            </button>
            <button onClick={handleCreate} disabled={saving || !formName.trim() || !formEmail.trim()} style={{ padding: "8px 16px", background: "#374151", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", opacity: saving || !formName.trim() || !formEmail.trim() ? 0.5 : 1 }}>
              {saving ? "Ukladám…" : "Vytvoriť"}
            </button>
          </div>
        </div>
      )}

      {/* Team list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: 14 }}>Načítavam…</div>
      ) : (
        <div style={{ background: "var(--bg-surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 120px 110px", padding: "10px 20px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            <span>Člen tímu</span>
            <span style={{ textAlign: "center" }}>Klienti</span>
            <span style={{ textAlign: "center" }}>Nábery</span>
            <span style={{ textAlign: "center" }}>Rola</span>
            <span style={{ textAlign: "right" }}>Pozvánka</span>
          </div>
          {members.map((m, i) => {
            const initials = m.name.split(" ").map(w => w[0] || "").join("").toUpperCase().slice(0, 2);
            const isMe = user?.id === m.id;
            const sent = inviteSentFor === m.id;
            return (
              <div key={m.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 120px 110px", padding: "13px 20px", alignItems: "center", borderBottom: i < members.length - 1 ? "1px solid var(--border)" : "none", fontSize: 13, background: isMe ? "rgba(55,65,81,0.03)" : "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: isMe ? "#374151" : "#6B7280", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                    {initials}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      {m.name} {isMe && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>(vy)</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.email}</div>
                  </div>
                </div>
                <div style={{ textAlign: "center", fontWeight: 600 }}>{m.klientCount}</div>
                <div style={{ textAlign: "center", fontWeight: 600 }}>{m.naberCount}</div>
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 600, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                    {roleLabel(m.role)}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <button
                    onClick={() => sendInvite(m.id)}
                    disabled={!!inviteSending || sent}
                    style={{
                      padding: "5px 12px", fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: inviteSending || sent ? "default" : "pointer",
                      background: sent ? "#D1FAE5" : "var(--bg-elevated)",
                      border: `1px solid ${sent ? "#6EE7B7" : "var(--border)"}`,
                      color: sent ? "#065F46" : "var(--text-secondary)",
                      opacity: inviteSending === m.id ? 0.6 : 1,
                    }}
                  >
                    {inviteSending === m.id ? "…" : sent ? "✓ Odoslané" : "✉ Pozvánka"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Vyťaženosť ─────────────────────────────────────────────────────────

function TabVytazenost() {
  const [tim, setTim] = useState<ClenTimu[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ stav: "volny" as ClenTimu["stav"], aktualnaZakazka: "", obsadene: 0 });

  useEffect(() => {
    const data = localStorage.getItem(LS_KEY);
    setTim(data ? JSON.parse(data) : DEFAULT_TEAM);
    if (!data) localStorage.setItem(LS_KEY, JSON.stringify(DEFAULT_TEAM));
  }, []);

  const save = (items: ClenTimu[]) => { setTim(items); localStorage.setItem(LS_KEY, JSON.stringify(items)); };
  const startEdit = (c: ClenTimu) => { setEditId(c.id); setEditForm({ stav: c.stav, aktualnaZakazka: c.aktualnaZakazka || "", obsadene: c.obsadene }); };
  const saveEdit = (id: string) => {
    save(tim.map(c => c.id === id ? { ...c, stav: editForm.stav, aktualnaZakazka: editForm.aktualnaZakazka.trim() || undefined, obsadene: editForm.obsadene } : c));
    setEditId(null);
  };

  const celkovaKap   = tim.reduce((s, c) => s + c.kapacitaDenne, 0);
  const celkoveObs   = tim.reduce((s, c) => s + c.obsadene, 0);
  const pct          = celkovaKap > 0 ? Math.round((celkoveObs / celkovaKap) * 100) : 0;
  const today        = new Date();
  const dayOfWeek    = today.getDay();
  const monday       = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

  return (
    <div>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Celková kapacita", value: String(celkovaKap), sub: "zákaziek/deň", color: "var(--text-primary)" },
          { label: "Obsadené",         value: String(celkoveObs), sub: "aktuálne",     color: "#FF9500" },
          { label: "Vyťaženosť",       value: `${pct}%`,          sub: "využitie",     color: pct > 80 ? "#FF3B30" : pct > 50 ? "#FF9500" : "#34C759" },
        ].map(s => (
          <div key={s.label} style={{ padding: 18, background: "var(--bg-surface)", borderRadius: 14, border: "1px solid var(--border)", textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Členovia */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {tim.map(c => {
          const p = c.kapacitaDenne > 0 ? Math.round((c.obsadene / c.kapacitaDenne) * 100) : 0;
          const barColor = p > 80 ? "#FF3B30" : p > 50 ? "#FF9500" : "#34C759";
          const sc = STAV_CONFIG[c.stav];
          const isEditing = editId === c.id;
          return (
            <div key={c.id} style={{ background: "var(--bg-surface)", borderRadius: 14, padding: 18, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: `${sc.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, color: sc.color }}>
                    {c.osoba[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{c.osoba}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{ROLA_LABELS[c.rola]}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: sc.color, background: sc.bg, padding: "4px 10px", borderRadius: 8 }}>{sc.label}</span>
                  <button onClick={() => isEditing ? saveEdit(c.id) : startEdit(c)} style={{ background: isEditing ? "#34C759" : "var(--bg-elevated)", color: isEditing ? "#fff" : "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {isEditing ? "Uložiť" : "Upraviť"}
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12, color: "var(--text-secondary)" }}>
                  <span>Kapacita: {c.obsadene}/{c.kapacitaDenne}</span>
                  <span style={{ fontWeight: 600, color: barColor }}>{p}%</span>
                </div>
                <div style={{ height: 7, background: "var(--bg-elevated)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(p, 100)}%`, background: barColor, borderRadius: 4, transition: "width 0.3s" }} />
                </div>
              </div>
              {c.aktualnaZakazka && !isEditing && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, fontStyle: "italic" }}>Aktuálne: {c.aktualnaZakazka}</div>}
              {isEditing && (
                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <label style={labelSt}>Stav</label>
                    <select value={editForm.stav} onChange={e => setEditForm({ ...editForm, stav: e.target.value as ClenTimu["stav"] })} style={{ ...inputSt, width: "auto" }}>
                      <option value="volny">Voľný</option>
                      <option value="pracuje">Pracuje</option>
                      <option value="dovolenka">Dovolenka</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelSt}>Obsadené</label>
                    <input type="number" min={0} max={c.kapacitaDenne} value={editForm.obsadene} onChange={e => setEditForm({ ...editForm, obsadene: Number(e.target.value) })} style={{ ...inputSt, width: 70 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <label style={labelSt}>Aktuálna zákazka</label>
                    <input value={editForm.aktualnaZakazka} onChange={e => setEditForm({ ...editForm, aktualnaZakazka: e.target.value })} placeholder="Názov zákazky…" style={inputSt} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Týždenný prehľad */}
      <div style={{ background: "var(--bg-surface)", borderRadius: 14, padding: 20, border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Týždenný prehľad</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>Týždeň od {monday.toLocaleDateString("sk-SK")}</div>
        <div style={{ display: "grid", gridTemplateColumns: `130px repeat(${DNI.length}, 1fr)`, gap: 2 }}>
          <div />
          {DNI.map(d => <div key={d} style={{ padding: 8, textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{d}</div>)}
          {tim.map(c => {
            const sc = STAV_CONFIG[c.stav];
            return (
              <div key={c.id} style={{ display: "contents" }}>
                <div style={{ padding: "8px 10px", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", display: "flex", alignItems: "center" }}>{c.osoba}</div>
                {DNI.map((d, i) => {
                  const isDovolenka = c.stav === "dovolenka";
                  const cellBg = isDovolenka ? "var(--bg-elevated)" : c.obsadene >= c.kapacitaDenne ? "#FF3B3015" : c.obsadene > 0 ? "#FF950015" : "#34C75915";
                  const isToday = (dayOfWeek + 6) % 7 === i;
                  return (
                    <div key={d} style={{ padding: 8, textAlign: "center", background: cellBg, borderRadius: 7, fontSize: 12, color: "var(--text-secondary)", border: isToday ? "2px solid #007AFF" : "2px solid transparent" }}>
                      {isDovolenka ? "—" : `${c.obsadene}/${c.kapacitaDenne}`}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Provízie ────────────────────────────────────────────────────────────

function StatCard({ title, value, sub, color }: { title: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || "var(--text-primary)", marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function TabProvizie() {
  const { user } = useAuth();
  const [maklery, setMaklery]       = useState<Makler[]>([]);
  const [faktury, setFaktury]       = useState<Faktura[]>([]);
  const [novyMeno, setNovyMeno]     = useState("");
  const [novyPct, setNovyPct]       = useState("");
  const [selectedMakler, setSelectedMakler] = useState("");
  const [mesiac, setMesiac]         = useState(new Date().toISOString().slice(0, 7));

  async function loadMaklery() { const r = await fetch("/api/maklerske-provizie"); setMaklery(await r.json()); }
  async function loadFaktury(uid: string) { const r = await fetch(`/api/faktury?user_id=${uid}`); const d = await r.json(); setFaktury(Array.isArray(d) ? d : []); }

  useEffect(() => { loadMaklery(); if (user?.id) loadFaktury(user.id); }, [user?.id]);

  async function addMakler() {
    if (!novyMeno.trim()) return;
    await fetch("/api/maklerske-provizie", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meno: novyMeno, percento: parseFloat(novyPct.replace(",", ".")) || 0 }) });
    setNovyMeno(""); setNovyPct(""); loadMaklery();
  }
  async function updatePct(m: Makler, value: string) {
    await fetch("/api/maklerske-provizie", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: m.id, percento: parseFloat(value.replace(",", ".")) || 0 }) });
    loadMaklery();
  }
  async function removeMakler(id: string) {
    if (!confirm("Zmazať makléra?")) return;
    await fetch(`/api/maklerske-provizie?id=${id}`, { method: "DELETE" }); loadMaklery();
  }

  const selectedM    = maklery.find(m => m.id === selectedMakler);
  const monthFaktury = faktury.filter(f => f.datum_vystavenia.startsWith(mesiac));
  const maklerFakt   = selectedM ? monthFaktury.filter(f => (f.poznamka || "").toLowerCase().includes(selectedM.meno.toLowerCase())) : [];
  const sumaFakt     = maklerFakt.reduce((s, f) => s + Number(f.suma_celkom), 0);
  const sumaZapl     = maklerFakt.filter(f => f.zaplatene).reduce((s, f) => s + Number(f.suma_celkom), 0);
  const provizia     = selectedM ? sumaZapl * (selectedM.percento / 100) : 0;

  return (
    <div>
      {/* Makléri a percentá */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.04em" }}>Makléri a percentá</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {maklery.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "4px 0" }}>Žiadni makléri.</div>}
          {maklery.map(m => (
            <div key={m.id} style={{ display: "grid", gridTemplateColumns: "1fr 140px auto", gap: 8, alignItems: "center" }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{m.meno}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input style={inputSt} defaultValue={m.percento} onBlur={e => updatePct(m, e.target.value)} />
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>%</span>
              </div>
              <button onClick={() => removeMakler(m.id)} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", color: "var(--danger)", fontSize: 12 }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 140px auto", gap: 8, alignItems: "center", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          <input style={inputSt} placeholder="Meno makléra" value={novyMeno} onChange={e => setNovyMeno(e.target.value)} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input style={inputSt} placeholder="0" value={novyPct} onChange={e => setNovyPct(e.target.value)} />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>%</span>
          </div>
          <button onClick={addMakler} style={{ background: "#374151", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>+ Pridať</button>
        </div>
      </div>

      {/* Výpočet */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.04em" }}>Výpočet provízie</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 16 }}>
          <select style={inputSt} value={selectedMakler} onChange={e => setSelectedMakler(e.target.value)}>
            <option value="">— vyber makléra —</option>
            {maklery.map(m => <option key={m.id} value={m.id}>{m.meno} ({m.percento} %)</option>)}
          </select>
          <input type="month" style={inputSt} value={mesiac} onChange={e => setMesiac(e.target.value)} />
        </div>
        {selectedM && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }} className="dash-grid">
              <StatCard title="Faktúry celkom" value={`${sumaFakt.toFixed(2)} €`} sub={`${maklerFakt.length} ks`} />
              <StatCard title="Zaplatené" value={`${sumaZapl.toFixed(2)} €`} color="var(--success)" />
              <StatCard title={`Provízia (${selectedM.percento} %)`} value={`${provizia.toFixed(2)} €`} color="#374151" />
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr 100px", gap: 12, padding: "10px 14px", background: "var(--bg-elevated)", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                <div>Číslo</div><div>Odberateľ</div><div>Dátum</div><div style={{ textAlign: "right" }}>Suma</div><div>Stav</div>
              </div>
              {maklerFakt.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Žiadne faktúry za tento mesiac.</div>
              ) : maklerFakt.map(f => (
                <div key={f.id} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr 100px", gap: 12, padding: "12px 14px", borderTop: "1px solid var(--border)", fontSize: 13, alignItems: "center" }}>
                  <div style={{ fontWeight: 600 }}>{f.cislo_faktury}</div>
                  <div>{f.odberatel_snapshot?.nazov || "—"}</div>
                  <div style={{ color: "var(--text-muted)" }}>{f.datum_vystavenia}</div>
                  <div style={{ textAlign: "right", fontWeight: 600 }}>{Number(f.suma_celkom).toFixed(2)} €</div>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, background: f.zaplatene ? "var(--success-light)" : "var(--warning-light)", color: f.zaplatene ? "var(--success)" : "var(--warning)", padding: "3px 8px", borderRadius: 999 }}>
                      {f.zaplatene ? "✓" : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
