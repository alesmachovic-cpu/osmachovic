"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface LogEntry {
  id: string;
  table: string;
  action: string;
  count: number;
  time: string;
}

export default function LogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    setLoading(true);
    const tables = ["klienti", "naberove_listy", "objednavky", "nehnutelnosti"];
    const entries: LogEntry[] = [];

    for (const table of tables) {
      try {
        const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
        entries.push({
          id: table,
          table,
          action: "Celkový počet záznamov",
          count: count ?? 0,
          time: new Date().toLocaleString("sk"),
        });
      } catch { /* skip */ }
    }

    setLogs(entries);
    setLoading(false);
  }

  const TABLE_LABELS: Record<string, string> = {
    klienti: "Klienti",
    naberove_listy: "Náberové listy",
    objednavky: "Objednávky",
    nehnutelnosti: "Nehnuteľnosti",
  };

  const TABLE_ICONS: Record<string, string> = {
    klienti: "👥",
    naberove_listy: "📝",
    objednavky: "📋",
    nehnutelnosti: "🏠",
  };

  return (
    <div style={{ maxWidth: "700px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>System Log</h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" }}>Prehľad databázy a systémových záznamov</p>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Načítavam...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {logs.map(log => (
            <div key={log.id} style={{
              display: "flex", alignItems: "center", gap: "14px", padding: "16px 20px",
              background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px",
            }}>
              <div style={{
                width: "44px", height: "44px", borderRadius: "12px",
                background: "var(--bg-elevated)", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: "20px", flexShrink: 0,
              }}>{TABLE_ICONS[log.table] || "📊"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>
                  {TABLE_LABELS[log.table] || log.table}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{log.action}</div>
              </div>
              <div style={{
                fontSize: "20px", fontWeight: "800", color: "var(--text-primary)",
                background: "var(--bg-elevated)", padding: "8px 16px", borderRadius: "10px",
              }}>{log.count}</div>
            </div>
          ))}
        </div>
      )}

      <button onClick={loadLogs} style={{
        marginTop: "20px", padding: "10px 20px", background: "#374151", color: "#fff",
        border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
      }}>🔄 Obnoviť</button>
    </div>
  );
}
