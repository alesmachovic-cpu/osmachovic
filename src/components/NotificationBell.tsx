"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

interface InAppNotif {
  id: string;
  type: "info" | "success" | "warning" | "danger" | "sla" | "manager" | "match" | "kolizia";
  title: string;
  body: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
}

const TYPE_CONFIG: Record<InAppNotif["type"], { color: string; icon: string }> = {
  info:    { color: "#3B82F6", icon: "ℹ" },
  success: { color: "#10B981", icon: "✓" },
  warning: { color: "#F59E0B", icon: "!" },
  danger:  { color: "#DC2626", icon: "‼" },
  sla:     { color: "#F59E0B", icon: "⏱" },
  manager: { color: "#7C3AED", icon: "👤" },
  match:   { color: "#7C3AED", icon: "🔗" },
  kolizia: { color: "#DC2626", icon: "⚠" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "teraz";
  if (mins < 60) return `pred ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `pred ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `pred ${days} ${days === 1 ? "dňom" : "dňami"}`;
}

/**
 * Notifikačný zvonček v navbare:
 *   - Polling každých 30s na unread count
 *   - Klik = dropdown s posledných 8 notifikácií
 *   - Klik na notifikáciu = otvorí URL + označí ako prečítanú
 *   - "Označiť všetko ako prečítané" tlačidlo
 *   - Browser native notification ak prišla nová a permission je granted
 */
export default function NotificationBell() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<InAppNotif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lastSeenIds = useRef<Set<string>>(new Set());

  // Polling
  useEffect(() => {
    if (!user?.id) return;
    let stopped = false;

    async function fetchNotifs() {
      try {
        const res = await fetch(`/api/notifikacie?user_id=${user!.id}&limit=15`);
        if (!res.ok) return;
        const d = await res.json();
        const list: InAppNotif[] = d.notifications || [];
        if (stopped) return;
        setItems(list);
        setUnreadCount(d.unread_count || 0);

        // Browser native notification pri novom unread (ak permission a tab nie je active)
        const newOnes = list.filter(n => !n.read_at && !lastSeenIds.current.has(n.id));
        if (newOnes.length > 0 && lastSeenIds.current.size > 0 && typeof Notification !== "undefined" && Notification.permission === "granted") {
          for (const n of newOnes.slice(0, 3)) {
            try {
              const notif = new Notification(n.title, {
                body: n.body || "",
                tag: `vianema-${n.id}`,
                icon: "/icon-192.png",
              });
              if (n.url) notif.onclick = () => { window.focus(); router.push(n.url!); };
            } catch { /* ignore */ }
          }
        }
        // Update seen IDs cache
        lastSeenIds.current = new Set(list.map(n => n.id));
      } catch { /* silent */ }
    }

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    function onVisibility() { if (document.visibilityState === "visible") fetchNotifs(); }
    document.addEventListener("visibilitychange", onVisibility);

    // Žiadosť o browser permission ak default
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      // Nepýtame sa hneď — len keď klikne na bell
    }

    return () => { stopped = true; clearInterval(interval); document.removeEventListener("visibilitychange", onVisibility); };
  }, [user?.id, router]);

  // Click outside na zatvorenie
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    }
    setTimeout(() => document.addEventListener("click", onClick), 50);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  async function markAllRead() {
    if (!user?.id) return;
    await fetch("/api/notifikacie", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", user_id: user.id }),
    });
    setItems(items.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    setUnreadCount(0);
  }

  async function openNotif(n: InAppNotif) {
    if (!user?.id) return;
    if (!n.read_at) {
      await fetch("/api/notifikacie", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", user_id: user.id, ids: [n.id] }),
      });
      setUnreadCount(c => Math.max(0, c - 1));
      setItems(items.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x));
    }
    setOpen(false);
    if (n.url) router.push(n.url);
  }

  function toggleOpen() {
    if (!open && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    setOpen(!open);
  }

  if (!user?.id) return null;

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button onClick={toggleOpen} style={{
        position: "relative", width: "36px", height: "36px", borderRadius: "50%",
        background: "var(--bg-elevated)", border: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", flexShrink: 0,
      }} aria-label="Notifikácie">
        <span style={{ fontSize: "16px", color: "var(--text-secondary)" }}>🔔</span>
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: "-4px", right: "-4px",
            minWidth: "18px", height: "18px", padding: "0 4px",
            background: "#DC2626", color: "#fff",
            borderRadius: "9px", fontSize: "10px", fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid var(--bg-base)",
          }}>{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "44px", right: 0, width: "360px", maxWidth: "calc(100vw - 24px)",
          maxHeight: "500px", overflow: "hidden", display: "flex", flexDirection: "column",
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          zIndex: 1000,
        }}>
          {/* Header */}
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
              Notifikácie {unreadCount > 0 && <span style={{ color: "#DC2626" }}>({unreadCount})</span>}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{
                background: "none", border: "none", color: "var(--accent, #3B82F6)",
                fontSize: "11px", fontWeight: 600, cursor: "pointer", padding: 0,
              }}>Označiť všetko</button>
            )}
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {items.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                Žiadne notifikácie
              </div>
            ) : (
              items.slice(0, 8).map(n => {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
                const isUnread = !n.read_at;
                return (
                  <button key={n.id} onClick={() => openNotif(n)} style={{
                    width: "100%", display: "flex", alignItems: "flex-start", gap: "10px",
                    padding: "12px 14px", border: "none", borderBottom: "1px solid var(--border-subtle)",
                    background: isUnread ? "var(--bg-elevated)" : "transparent",
                    cursor: "pointer", textAlign: "left",
                  }}>
                    <div style={{
                      width: "28px", height: "28px", borderRadius: "50%",
                      background: `${cfg.color}15`, color: cfg.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "13px", fontWeight: 700, flexShrink: 0,
                    }}>{cfg.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: "13px", fontWeight: isUnread ? 700 : 500,
                        color: "var(--text-primary)", marginBottom: "2px",
                      }}>{n.title}</div>
                      {n.body && (
                        <div style={{
                          fontSize: "12px", color: "var(--text-secondary)",
                          lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis",
                          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
                        }}>{n.body}</div>
                      )}
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                        {timeAgo(n.created_at)}
                      </div>
                    </div>
                    {isUnread && <div style={{
                      width: "8px", height: "8px", borderRadius: "50%", background: cfg.color,
                      flexShrink: 0, marginTop: "10px",
                    }} />}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <button onClick={() => { setOpen(false); router.push("/notifikacie"); }} style={{
            padding: "12px 16px", borderTop: "1px solid var(--border)",
            background: "transparent", border: "none", borderTopWidth: "1px", borderTopStyle: "solid", borderTopColor: "var(--border)",
            color: "var(--accent, #3B82F6)", fontSize: "12px", fontWeight: 600, cursor: "pointer",
            textAlign: "center",
          }}>
            Zobraziť všetky →
          </button>
        </div>
      )}
    </div>
  );
}
