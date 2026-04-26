"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface CriticalKlient {
  id: string;
  meno: string;
  telefon: string;
  status: string;
  datum_naberu: string | null;
  makler_id: string | null;
  sla_warning_at: string | null;
  sla_critical_at: string | null;
  napomenutia_count: number;
  manager_action_type: string | null;
  manager_action_at: string | null;
}

interface Makler {
  id: string;
  meno: string;
}

/**
 * Manažérska sekcia "Porušené SLA" — zoznam klientov v 72h+ stave bez
 * vyriešenia. Každý riadok má 3 akcie: Presunúť (vyber makléra), Napomenúť,
 * Ponechať (manažér rozhodol nezasahovať, ale critical sa zruší).
 */
export default function SlaPoruseni({ byUserId, onUpdated }: { byUserId: string | null; onUpdated?: () => void }) {
  const [list, setList] = useState<CriticalKlient[]>([]);
  const [makleri, setMakleri] = useState<Makler[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [slaRes, { data: ms }] = await Promise.all([
      fetch("/api/manazer/sla").then(r => r.json()).catch(() => ({ critical: [] })),
      supabase.from("makleri").select("id, meno").order("meno"),
    ]);
    setList(slaRes.critical || []);
    setMakleri(ms || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function doAction(klientId: string, action: "presunut" | "napomenut" | "ponechat") {
    setWorking(klientId + action);
    let body: Record<string, unknown> = { action, klient_id: klientId, by_user_id: byUserId };
    if (action === "presunut") {
      const target = (document.getElementById(`makler-select-${klientId}`) as HTMLSelectElement)?.value;
      if (!target) { alert("Vyber makléra"); setWorking(null); return; }
      const dovod = window.prompt("Dôvod presunu (voliteľné):") || undefined;
      body = { ...body, to_makler_id: target, dovod };
    } else if (action === "napomenut") {
      const dovod = window.prompt("Za čo bol napomenutý?", "Nedodržanie SLA — chýba inzerát po 72h");
      if (!dovod || !dovod.trim()) { setWorking(null); return; }
      body = { ...body, dovod };
    } else if (action === "ponechat") {
      if (!confirm("Ponechať klienta u tohto makléra bez napomenutia?")) { setWorking(null); return; }
    }
    const res = await fetch("/api/manazer/sla", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Chyba pri akcii");
    }
    setWorking(null);
    await load();
    onUpdated?.();
  }

  if (loading) return null;
  if (list.length === 0) return null;

  return (
    <div id="sla-poruseni" style={{
      padding: "20px", background: "var(--bg-surface)",
      borderRadius: "14px", border: "1px solid var(--border)", marginBottom: "24px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Porušené SLA (72h+)
          </h3>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0" }}>
            Klienti čakajú viac ako 72h na vytvorenie inzerátu
          </p>
        </div>
        <span style={{
          padding: "4px 10px", background: "#FEE2E2", color: "#991B1B",
          borderRadius: "8px", fontSize: "12px", fontWeight: 600,
        }}>{list.length}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {list.map(k => {
          const naberDate = k.datum_naberu ? new Date(k.datum_naberu) : null;
          const hoursSince = naberDate ? Math.floor((Date.now() - naberDate.getTime()) / 3600000) : null;
          const otherMakleri = makleri.filter(m => m.id !== k.makler_id);
          const isWorking = working?.startsWith(k.id);
          return (
            <div key={k.id} style={{
              padding: "14px", background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)", borderRadius: "10px",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                    {k.meno}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                    📞 {k.telefon || "—"}
                    {hoursSince !== null && <> · od náberu {hoursSince}h</>}
                    {k.napomenutia_count > 0 && <> · napomenutí: {k.napomenutia_count}×</>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  <select id={`makler-select-${k.id}`} disabled={isWorking} style={{
                    height: "32px", padding: "0 10px",
                    borderRadius: "8px", border: "1px solid var(--border)",
                    background: "var(--bg-surface)", fontSize: "12px",
                  }}>
                    <option value="">Vyber makléra...</option>
                    {otherMakleri.map(m => (
                      <option key={m.id} value={m.id}>{m.meno}</option>
                    ))}
                  </select>
                  <button onClick={() => doAction(k.id, "presunut")} disabled={isWorking}
                    style={btnStyle("#374151", "#fff")}>
                    Presunúť
                  </button>
                  <button onClick={() => doAction(k.id, "napomenut")} disabled={isWorking}
                    style={btnStyle("#FEF3C7", "#92400E")}>
                    Napomenúť
                  </button>
                  <button onClick={() => doAction(k.id, "ponechat")} disabled={isWorking}
                    style={btnStyle("var(--bg-surface)", "var(--text-secondary)", true)}>
                    Ponechať
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function btnStyle(bg: string, color: string, border = false): React.CSSProperties {
  return {
    height: "32px", padding: "0 12px", borderRadius: "8px",
    background: bg, color, border: border ? "1px solid var(--border)" : "none",
    fontSize: "12px", fontWeight: 600, cursor: "pointer",
  };
}
