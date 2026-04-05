"use client";

import { useState } from "react";

interface Notif {
  id: string;
  type: "info" | "warning" | "success" | "action";
  title: string;
  detail: string;
  time: string;
  read: boolean;
}

const MOCK: Notif[] = [
  { id: "1", type: "action", title: "Klient čaká na odpoveď", detail: "Ales Machovic — posledný kontakt pred 3 dňami", time: "dnes", read: false },
  { id: "2", type: "success", title: "Nový náber uložený", detail: "Byt, Bratislava II — 65 m², 185 000 €", time: "včera", read: false },
  { id: "3", type: "info", title: "Nová zhoda nájdená", detail: "3-izbový byt v Ružinove zodpovedá objednávke klienta Test", time: "21.3.2026", read: true },
  { id: "4", type: "warning", title: "Chýba energetický certifikát", detail: "Nehnuteľnosť na Dunajskej — dokument treba doplniť", time: "20.3.2026", read: true },
];

const TYPE_CONFIG = {
  info: { bg: "#EFF6FF", border: "#BFDBFE", color: "#2563EB", icon: "ℹ️" },
  warning: { bg: "#FEF3C7", border: "#FDE68A", color: "#D97706", icon: "⚠️" },
  success: { bg: "#F0FDF4", border: "#BBF7D0", color: "#059669", icon: "✓" },
  action: { bg: "#FEF2F2", border: "#FECACA", color: "#DC2626", icon: "❗" },
};

export default function NotifikaciePage() {
  const [notifs, setNotifs] = useState(MOCK);

  function markAllRead() {
    setNotifs(ns => ns.map(n => ({ ...n, read: true })));
  }

  const unread = notifs.filter(n => !n.read).length;

  return (
    <div style={{ maxWidth: "700px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>Notifikácie</h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" }}>
            {unread > 0 ? `${unread} neprečítané` : "Všetko prečítané"}
          </p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} style={{
            padding: "8px 16px", background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "10px", fontSize: "12px", fontWeight: "600", cursor: "pointer", color: "var(--text-primary)",
          }}>Označiť všetko</button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {notifs.map(n => {
          const c = TYPE_CONFIG[n.type];
          return (
            <div key={n.id} onClick={() => setNotifs(ns => ns.map(x => x.id === n.id ? { ...x, read: true } : x))} style={{
              display: "flex", gap: "14px", padding: "16px",
              background: n.read ? "var(--bg-surface)" : c.bg,
              border: `1px solid ${n.read ? "var(--border)" : c.border}`,
              borderRadius: "12px", cursor: "pointer", transition: "all 0.15s",
              opacity: n.read ? 0.7 : 1,
            }}>
              <div style={{
                width: "40px", height: "40px", borderRadius: "12px",
                background: n.read ? "var(--bg-elevated)" : `${c.color}15`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px", flexShrink: 0,
              }}>{c.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                  <div style={{ fontSize: "14px", fontWeight: n.read ? "500" : "700", color: "var(--text-primary)" }}>{n.title}</div>
                  {!n.read && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: c.color, flexShrink: 0, marginTop: "6px" }} />}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{n.detail}</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>{n.time}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
