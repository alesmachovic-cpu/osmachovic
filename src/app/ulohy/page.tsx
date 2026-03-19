"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Uloha {
  id: string;
  nazov: string;
  hotovo: boolean;
  priorita: "vysoka" | "stredna" | "nizka";
  deadline: string | null;
  created_at: string;
}

const PRIORITY_CFG = {
  vysoka: { label: "Vysoká", color: "#991B1B", bg: "#FEE2E2", dot: "#EF4444" },
  stredna: { label: "Stredná", color: "#92400E", bg: "#FEF3C7", dot: "#F59E0B" },
  nizka: { label: "Nízka", color: "#374151", bg: "#F3F4F6", dot: "#9CA3AF" },
};

const CHECKLIST_TEMPLATES = [
  { label: "📸 Nafotiť nehnuteľnosť", priorita: "vysoka" },
  { label: "📝 Podpísať zmluvu o spolupráci", priorita: "vysoka" },
  { label: "📢 Topovať inzerát", priorita: "stredna" },
  { label: "📞 Zavolať klientovi", priorita: "stredna" },
  { label: "🏠 Zorganizovať obhliadku", priorita: "stredna" },
  { label: "📊 Spraviť cenovú analýzu", priorita: "nizka" },
  { label: "✉️ Poslať ponuku emailom", priorita: "nizka" },
];

export default function UlohyPage() {
  const [ulohy, setUlohy] = useState<Uloha[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNazov, setNewNazov] = useState("");
  const [newPriorita, setNewPriorita] = useState<"vysoka" | "stredna" | "nizka">("stredna");
  const [newDeadline, setNewDeadline] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "done">("open");

  async function fetch() {
    setLoading(true);
    const { data } = await supabase.from("ulohy").select("*").order("created_at", { ascending: false });
    setUlohy(data ?? []);
    setLoading(false);
  }

  useEffect(() => { fetch(); }, []);

  async function addUloha(nazov?: string, priorita?: string) {
    const n = nazov ?? newNazov.trim();
    if (!n) return;
    await supabase.from("ulohy").insert({ nazov: n, priorita: (priorita ?? newPriorita) as "vysoka" | "stredna" | "nizka", deadline: newDeadline || null });
    setNewNazov("");
    setNewDeadline("");
    fetch();
  }

  async function toggleHotovo(id: string, hotovo: boolean) {
    await supabase.from("ulohy").update({ hotovo: !hotovo }).eq("id", id);
    setUlohy(prev => prev.map(u => u.id === id ? { ...u, hotovo: !hotovo } : u));
  }

  async function deleteUloha(id: string) {
    await supabase.from("ulohy").delete().eq("id", id);
    setUlohy(prev => prev.filter(u => u.id !== id));
  }

  const filtered = ulohy.filter(u =>
    filter === "all" ? true : filter === "open" ? !u.hotovo : u.hotovo
  );
  const openCount = ulohy.filter(u => !u.hotovo).length;
  const doneCount = ulohy.filter(u => u.hotovo).length;

  return (
    <div style={{ maxWidth: "760px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 4px", color: "var(--text-primary)" }}>Úlohy & Checklisty</h2>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
          {openCount} otvorených · {doneCount} hotových
        </p>
      </div>

      {/* Add form */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 20px", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <input
            placeholder="Nová úloha..."
            value={newNazov}
            onChange={e => setNewNazov(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addUloha()}
            style={{ flex: 1, padding: "9px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13.5px", color: "var(--text-primary)", outline: "none" }}
          />
          <select value={newPriorita} onChange={e => setNewPriorita(e.target.value as "vysoka" | "stredna" | "nizka")}
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

        {/* Templates */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {CHECKLIST_TEMPLATES.map(t => (
            <button key={t.label} onClick={() => addUloha(t.label, t.priorita)}
              style={{ padding: "4px 10px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "20px", fontSize: "11.5px", cursor: "pointer", color: "var(--text-secondary)" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "14px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "9px", padding: "3px", width: "fit-content" }}>
        {(["open", "all", "done"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: "6px 16px", borderRadius: "7px", fontSize: "13px", fontWeight: "500", border: "none", cursor: "pointer", background: filter === f ? "var(--accent)" : "transparent", color: filter === f ? "#fff" : "var(--text-secondary)" }}>
            {f === "open" ? `Otvorené (${openCount})` : f === "done" ? `Hotové (${doneCount})` : "Všetky"}
          </button>
        ))}
      </div>

      {/* List */}
      {loading && <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>Načítavam...</div>}
      {!loading && filtered.length === 0 && (
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
              {/* Checkbox */}
              <button onClick={() => toggleHotovo(u.id, u.hotovo)}
                style={{
                  width: "22px", height: "22px", borderRadius: "6px", flexShrink: 0,
                  border: u.hotovo ? "none" : "2px solid var(--border)",
                  background: u.hotovo ? "var(--success)" : "transparent",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "12px", color: "#fff",
                }}>
                {u.hotovo && "✓"}
              </button>

              {/* Priority dot */}
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />

              {/* Title */}
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

              {/* Priority badge */}
              <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "600", color: cfg.color, background: cfg.bg }}>
                {cfg.label}
              </span>

              {/* Delete */}
              <button onClick={() => deleteUloha(u.id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "16px", padding: "0 2px", lineHeight: 1 }}>
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
