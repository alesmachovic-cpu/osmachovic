"use client";

import { useEffect, useState } from "react";

interface HistoryEntry {
  id: string;
  action: string;
  dovod: string | null;
  from_makler_name: string | null;
  to_makler_name: string | null;
  by_user_name: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  uvolneny:        { label: "Uvoľnený do voľného poolu", color: "#F59E0B", icon: "↗" },
  prebraty:        { label: "Prebratý maklerom", color: "#10B981", icon: "↘" },
  sla_warning:     { label: "SLA Warning (48h)", color: "#F59E0B", icon: "!" },
  sla_last_chance: { label: "Posledná šanca (1h)", color: "#F97316", icon: "⏱" },
  sla_critical:    { label: "SLA Critical (72h)", color: "#DC2626", icon: "‼" },
  manager_presun:  { label: "Manažér presunul", color: "#3B82F6", icon: "→" },
  napomenuty:      { label: "Napomenutý manažérom", color: "#DC2626", icon: "⚠" },
  vrateny_novy:    { label: "Vrátený ako Nový", color: "#10B981", icon: "↻" },
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("sk", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function KlientHistoryTab({ klientId }: { klientId: string }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/klienti/history?klient_id=${klientId}`)
      .then(r => r.json())
      .then(d => setHistory(d.history || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [klientId]);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
        Načítavam históriu...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
        Žiadne historické záznamy
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      {history.map((h, i) => {
        const meta = ACTION_LABELS[h.action] || { label: h.action, color: "#6B7280", icon: "•" };
        const isLast = i === history.length - 1;
        return (
          <div key={h.id} style={{ display: "flex", gap: "14px", padding: "12px 0" }}>
            {/* Timeline gutter */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%",
                background: `${meta.color}15`, color: meta.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "14px", fontWeight: 700, border: `1.5px solid ${meta.color}40`,
              }}>{meta.icon}</div>
              {!isLast && (
                <div style={{ flex: 1, width: "2px", background: "var(--border)", marginTop: "4px", minHeight: "12px" }} />
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{
                  fontSize: "13px", fontWeight: 600, color: "var(--text-primary)",
                }}>{meta.label}</span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {fmtTime(h.created_at)}
                </span>
              </div>
              {h.dovod && (
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px", lineHeight: 1.5 }}>
                  {h.dovod}
                </div>
              )}
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
                {h.from_makler_name && <>od {h.from_makler_name} </>}
                {h.to_makler_name && <>→ {h.to_makler_name} </>}
                {h.by_user_name && <>· vykonal: {h.by_user_name}</>}
                {!h.by_user_name && (h.action === "uvolneny" || h.action === "sla_warning" || h.action === "sla_critical" || h.action === "sla_last_chance") && <>· (automaticky)</>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
