"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

interface InAppNotif {
  id: string;
  type: "info" | "success" | "warning" | "danger" | "sla" | "manager" | "match" | "kolizia";
  title: string;
  body: string | null;
  url: string | null;
  meta: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

const TYPE_LABEL: Record<InAppNotif["type"], string> = {
  info: "Info", success: "Úspech", warning: "Upozornenie", danger: "Dôležité",
  sla: "SLA", manager: "Manažér", match: "Zhoda", kolizia: "Kolízia",
};

const TYPE_COLOR: Record<InAppNotif["type"], { bg: string; color: string; icon: string }> = {
  info:    { bg: "#EFF6FF", color: "#2563EB", icon: "ℹ" },
  success: { bg: "#F0FDF4", color: "#10B981", icon: "✓" },
  warning: { bg: "#FEF3C7", color: "#F59E0B", icon: "!" },
  danger:  { bg: "#FEE2E2", color: "#DC2626", icon: "‼" },
  sla:     { bg: "#FEF3C7", color: "#F59E0B", icon: "⏱" },
  manager: { bg: "#F5F3FF", color: "#7C3AED", icon: "👤" },
  match:   { bg: "#F5F3FF", color: "#7C3AED", icon: "🔗" },
  kolizia: { bg: "#FEE2E2", color: "#DC2626", icon: "⚠" },
};

const FILTERS = [
  { value: "all", label: "Všetky" },
  { value: "unread", label: "Neprečítané" },
  { value: "sla", label: "SLA" },
  { value: "manager", label: "Manažér" },
  { value: "kolizia", label: "Kolízie" },
];

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("sk", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function NotifikaciePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<InAppNotif[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/notifikacie?user_id=${user.id}&limit=200`);
      const d = await res.json();
      setItems(d.notifications || []);
    } finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  async function markRead(ids: string[]) {
    if (!user?.id || ids.length === 0) return;
    await fetch("/api/notifikacie", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", user_id: user.id, ids }),
    });
    load();
  }

  async function markAllRead() {
    if (!user?.id) return;
    await fetch("/api/notifikacie", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", user_id: user.id }),
    });
    load();
  }

  async function deleteNotif(id: string) {
    if (!user?.id) return;
    if (!confirm("Zmazať notifikáciu?")) return;
    await fetch("/api/notifikacie", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", user_id: user.id, ids: [id] }),
    });
    load();
  }

  const filtered = items.filter(n => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.read_at;
    return n.type === filter;
  });

  const unreadCount = items.filter(n => !n.read_at).length;

  return (
    <div style={{ maxWidth: "880px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>
            Notifikácie
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: "4px 0 0" }}>
            {unreadCount > 0 ? `${unreadCount} neprečítaných` : "Všetky prečítané"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{
            height: "36px", padding: "0 16px", background: "#374151",
            color: "#fff", border: "none", borderRadius: "8px",
            fontSize: "13px", fontWeight: 600, cursor: "pointer",
          }}>Označiť všetky ako prečítané</button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)} style={{
            height: "32px", padding: "0 12px", borderRadius: "8px",
            background: filter === f.value ? "#374151" : "var(--bg-elevated)",
            color: filter === f.value ? "#fff" : "var(--text-secondary)",
            border: "1px solid " + (filter === f.value ? "#374151" : "var(--border)"),
            fontSize: "12px", fontWeight: 600, cursor: "pointer",
          }}>{f.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
          Načítavam...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: "80px 32px", textAlign: "center",
          background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px",
        }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🔔</div>
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px" }}>
            Žiadne notifikácie
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
            {filter === "all" ? "Nič tu zatiaľ nie je. Notifikácie sa objavia pri SLA porušeniach, kolíziách a iných udalostiach." : "Skús zmeniť filter."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map(n => {
            const cfg = TYPE_COLOR[n.type] || TYPE_COLOR.info;
            const isUnread = !n.read_at;
            return (
              <div key={n.id} style={{
                display: "flex", alignItems: "flex-start", gap: "12px",
                padding: "14px 16px", background: "var(--bg-surface)",
                border: isUnread ? `1px solid ${cfg.color}40` : "1px solid var(--border-subtle)",
                borderLeft: `3px solid ${cfg.color}`,
                borderRadius: "10px",
                transition: "all 0.15s",
              }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "50%",
                  background: cfg.bg, color: cfg.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "16px", fontWeight: 700, flexShrink: 0,
                }}>{cfg.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <h3 style={{
                      fontSize: "14px", fontWeight: isUnread ? 700 : 500,
                      color: "var(--text-primary)", margin: 0,
                    }}>{n.title}</h3>
                    <span style={{
                      fontSize: "10px", padding: "2px 6px", borderRadius: "4px",
                      background: cfg.bg, color: cfg.color, fontWeight: 600,
                      textTransform: "uppercase", letterSpacing: "0.04em",
                    }}>{TYPE_LABEL[n.type]}</span>
                    {isUnread && <span style={{
                      width: "6px", height: "6px", borderRadius: "50%", background: cfg.color,
                    }} />}
                  </div>
                  {n.body && (
                    <p style={{
                      fontSize: "13px", color: "var(--text-secondary)",
                      lineHeight: 1.5, margin: "6px 0 0",
                    }}>{n.body}</p>
                  )}
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px" }}>
                    {fmtTime(n.created_at)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px", flexDirection: "column", alignItems: "flex-end" }}>
                  {n.url && (
                    <button onClick={() => { if (isUnread) markRead([n.id]); router.push(n.url!); }} style={{
                      padding: "6px 12px", background: "var(--bg-elevated)",
                      border: "1px solid var(--border)", borderRadius: "6px",
                      fontSize: "11px", fontWeight: 600, color: "var(--text-primary)",
                      cursor: "pointer",
                    }}>Otvoriť →</button>
                  )}
                  {isUnread && (
                    <button onClick={() => markRead([n.id])} style={{
                      padding: "4px 8px", background: "transparent",
                      border: "1px solid var(--border-subtle)", borderRadius: "6px",
                      fontSize: "10px", fontWeight: 500, color: "var(--text-muted)",
                      cursor: "pointer",
                    }}>Označiť prečítané</button>
                  )}
                  <button onClick={() => deleteNotif(n.id)} style={{
                    padding: "4px 8px", background: "transparent",
                    border: "none", color: "var(--text-muted)",
                    fontSize: "11px", cursor: "pointer",
                  }} title="Zmazať">🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
