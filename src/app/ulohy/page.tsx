"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

interface Uloha {
  id: string;
  nazov: string;
  hotovo: boolean;
  priorita: "vysoka" | "stredna" | "nizka";
  deadline: string | null;
  klient_id: string | null;
  assigned_to: string | null;
  kanban_status: "todo" | "in_progress" | "done";
  deleted_at: string | null;
  created_at: string;
}

const PRIORITY_CFG = {
  vysoka: { label: "Vysoká",  color: "#991B1B", bg: "#FEE2E2", dot: "#EF4444" },
  stredna:{ label: "Stredná", color: "#92400E", bg: "#FEF3C7", dot: "#F59E0B" },
  nizka:  { label: "Nízka",   color: "#374151", bg: "#F3F4F6", dot: "#9CA3AF" },
};

const CHECKLIST_TEMPLATES = [
  { label: "📸 Nafotiť nehnuteľnosť",     priorita: "vysoka"  },
  { label: "📝 Podpísať zmluvu o spolupráci", priorita: "vysoka" },
  { label: "📢 Topovať inzerát",           priorita: "stredna" },
  { label: "📞 Zavolať klientovi",         priorita: "stredna" },
  { label: "🏠 Zorganizovať obhliadku",    priorita: "stredna" },
  { label: "📊 Spraviť cenovú analýzu",    priorita: "nizka"   },
  { label: "✉️ Poslať ponuku emailom",     priorita: "nizka"   },
];

const KANBAN_COLS: Array<{ key: Uloha["kanban_status"]; label: string; color: string }> = [
  { key: "todo",        label: "Čaká",       color: "#6B7280" },
  { key: "in_progress", label: "V riešení",  color: "#3B82F6" },
  { key: "done",        label: "Hotovo",     color: "#059669" },
];

export default function UlohyPage() {
  const { user } = useAuth();
  const [ulohy, setUlohy]     = useState<Uloha[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNazov, setNewNazov]       = useState("");
  const [newPriorita, setNewPriorita] = useState<"vysoka" | "stredna" | "nizka">("stredna");
  const [newDeadline, setNewDeadline] = useState("");
  const [filter, setFilter]   = useState<"all" | "open" | "done">("open");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase
      .from("ulohy")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setUlohy((data ?? []) as Uloha[]);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  async function addUloha(nazov?: string, priorita?: string) {
    const n = nazov ?? newNazov.trim();
    if (!n) return;
    const row: Partial<Uloha> = {
      nazov: n,
      priorita: (priorita ?? newPriorita) as Uloha["priorita"],
      deadline: newDeadline || null,
      kanban_status: "todo",
      assigned_to: user?.id ?? null,
    };
    await supabase.from("ulohy").insert(row);
    setNewNazov(""); setNewDeadline("");
    fetchData();
  }

  async function toggleHotovo(id: string, hotovo: boolean) {
    const next = !hotovo;
    await supabase.from("ulohy").update({ hotovo: next, kanban_status: next ? "done" : "todo" }).eq("id", id);
    setUlohy(prev => prev.map(u => u.id === id ? { ...u, hotovo: next, kanban_status: next ? "done" : "todo" } : u));
  }

  async function setKanbanStatus(id: string, status: Uloha["kanban_status"]) {
    await supabase.from("ulohy").update({ kanban_status: status, hotovo: status === "done" }).eq("id", id);
    setUlohy(prev => prev.map(u => u.id === id ? { ...u, kanban_status: status, hotovo: status === "done" } : u));
  }

  async function deleteUloha(id: string) {
    await supabase.from("ulohy").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    setUlohy(prev => prev.filter(u => u.id !== id));
  }

  const filtered = ulohy.filter(u =>
    filter === "all" ? true : filter === "open" ? !u.hotovo : u.hotovo
  );
  const openCount = ulohy.filter(u => !u.hotovo).length;
  const doneCount = ulohy.filter(u => u.hotovo).length;

  return (
    <div style={{ maxWidth: viewMode === "kanban" ? "1100px" : "760px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 4px", color: "var(--text-primary)" }}>Úlohy & Checklisty</h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
            {openCount} otvorených · {doneCount} hotových
          </p>
        </div>
        <div style={{ display: "flex", gap: "4px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "9px", padding: "3px" }}>
          {(["list", "kanban"] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={{
              padding: "6px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: "600",
              border: "none", cursor: "pointer",
              background: viewMode === m ? "var(--accent)" : "transparent",
              color: viewMode === m ? "#fff" : "var(--text-secondary)",
            }}>
              {m === "list" ? "≡ Zoznam" : "⬛ Kanban"}
            </button>
          ))}
        </div>
      </div>

      {/* Add form */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 20px", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
          <input
            placeholder="Nová úloha..."
            value={newNazov}
            onChange={e => setNewNazov(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addUloha()}
            style={{ flex: 1, minWidth: "180px", padding: "9px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13.5px", color: "var(--text-primary)", outline: "none" }}
          />
          <select value={newPriorita} onChange={e => setNewPriorita(e.target.value as Uloha["priorita"])}
            style={{ padding: "9px 10px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px", background: "var(--bg-elevated)", color: "var(--text-primary)", outline: "none" }}>
            <option value="vysoka">🔴 Vysoká</option>
            <option value="stredna">🟡 Stredná</option>
            <option value="nizka">⚪ Nízka</option>
          </select>
          <input type="date" value={newDeadline} onChange={e => setNewDeadline(e.target.value)}
            style={{ padding: "9px 10px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px", background: "var(--bg-elevated)", color: "var(--text-primary)", outline: "none" }} />
          <button onClick={() => addUloha()}
            style={{ padding: "9px 18px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13.5px", fontWeight: "600", cursor: "pointer" }}>
            + Pridať
          </button>
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {CHECKLIST_TEMPLATES.map(t => (
            <button key={t.label} onClick={() => addUloha(t.label, t.priorita)}
              style={{ padding: "4px 10px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "20px", fontSize: "11.5px", cursor: "pointer", color: "var(--text-secondary)" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter tabs (list only) */}
      {viewMode === "list" && (
        <div style={{ display: "flex", gap: "4px", marginBottom: "14px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "9px", padding: "3px", width: "fit-content" }}>
          {(["open", "all", "done"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: "6px 16px", borderRadius: "7px", fontSize: "13px", fontWeight: "500", border: "none", cursor: "pointer", background: filter === f ? "var(--accent)" : "transparent", color: filter === f ? "#fff" : "var(--text-secondary)" }}>
              {f === "open" ? `Otvorené (${openCount})` : f === "done" ? `Hotové (${doneCount})` : "Všetky"}
            </button>
          ))}
        </div>
      )}

      {loading && <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>Načítavam...</div>}

      {/* ═══ LIST VIEW ═══ */}
      {!loading && viewMode === "list" && (
        <>
          {filtered.length === 0 && (
            <div style={{ padding: "50px", textAlign: "center", color: "var(--text-muted)", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>✅</div>
              {filter === "open" ? "Žiadne otvorené úlohy!" : "Žiadne úlohy."}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {filtered.map(u => {
              const cfg = PRIORITY_CFG[u.priorita] ?? PRIORITY_CFG.stredna;
              const isOverdue = u.deadline && !u.hotovo && new Date(u.deadline) < new Date();
              return (
                <div key={u.id} style={{
                  background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px",
                  padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px",
                  opacity: u.hotovo ? 0.6 : 1,
                }}>
                  <button onClick={() => toggleHotovo(u.id, u.hotovo)} style={{
                    width: "22px", height: "22px", borderRadius: "6px", flexShrink: 0,
                    border: u.hotovo ? "none" : "2px solid var(--border)",
                    background: u.hotovo ? "var(--success)" : "transparent",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "12px", color: "#fff",
                  }}>{u.hotovo && "✓"}</button>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: "13.5px", color: "var(--text-primary)", fontWeight: "500", textDecoration: u.hotovo ? "line-through" : "none" }}>
                      {u.nazov}
                    </span>
                    {u.deadline && (
                      <span style={{ marginLeft: "10px", fontSize: "11.5px", color: isOverdue ? "var(--danger)" : "var(--text-muted)", fontWeight: isOverdue ? "600" : "400" }}>
                        {isOverdue ? "⚠️ " : "📅 "}{new Date(u.deadline).toLocaleDateString("sk")}
                      </span>
                    )}
                  </div>
                  <select value={u.kanban_status} onChange={e => setKanbanStatus(u.id, e.target.value as Uloha["kanban_status"])}
                    style={{ padding: "4px 8px", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "11px", background: "var(--bg-elevated)", color: "var(--text-primary)", outline: "none" }}>
                    {KANBAN_COLS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "600", color: cfg.color, background: cfg.bg }}>
                    {cfg.label}
                  </span>
                  <button onClick={() => deleteUloha(u.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "16px", padding: "0 2px", lineHeight: 1 }}>×</button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ═══ KANBAN VIEW ═══ */}
      {!loading && viewMode === "kanban" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
          {KANBAN_COLS.map(col => {
            const colItems = ulohy.filter(u => u.kanban_status === col.key);
            return (
              <div key={col.key} style={{
                background: "var(--bg-surface)", border: "1px solid var(--border)",
                borderRadius: "12px", padding: "14px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: col.color }} />
                    <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>{col.label}</span>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)",
                    background: "var(--bg-elevated)", borderRadius: "10px", padding: "2px 8px" }}>
                    {colItems.length}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", minHeight: "60px" }}>
                  {colItems.map(u => {
                    const cfg = PRIORITY_CFG[u.priorita] ?? PRIORITY_CFG.stredna;
                    const isOverdue = u.deadline && !u.hotovo && new Date(u.deadline) < new Date();
                    return (
                      <div key={u.id} style={{
                        padding: "10px 12px", borderRadius: "8px",
                        background: "var(--bg-elevated)", border: "1px solid var(--border)",
                      }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                          <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: cfg.dot, marginTop: "4px", flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "12.5px", color: "var(--text-primary)", fontWeight: "500", lineHeight: 1.4 }}>
                              {u.nazov}
                            </div>
                            {u.deadline && (
                              <div style={{ fontSize: "11px", color: isOverdue ? "var(--danger)" : "var(--text-muted)", marginTop: "4px" }}>
                                {isOverdue ? "⚠️ " : "📅 "}{new Date(u.deadline).toLocaleDateString("sk")}
                              </div>
                            )}
                          </div>
                          <button onClick={() => deleteUloha(u.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "14px", flexShrink: 0, lineHeight: 1, padding: 0 }}>×</button>
                        </div>
                        <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                          {KANBAN_COLS.filter(c => c.key !== col.key).map(c => (
                            <button key={c.key} onClick={() => setKanbanStatus(u.id, c.key)} style={{
                              padding: "3px 10px", background: "var(--bg-surface)", border: "1px solid var(--border)",
                              borderRadius: "6px", fontSize: "10.5px", cursor: "pointer", color: c.color, fontWeight: "600",
                            }}>→ {c.label}</button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {colItems.length === 0 && (
                    <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px", opacity: 0.5 }}>
                      Prázdne
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
