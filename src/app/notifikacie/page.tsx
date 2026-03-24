"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface Notif {
  id: string;
  type: "info" | "warning" | "success" | "action" | "match";
  title: string;
  detail: string;
  time: string;
  read: boolean;
  link?: string;
}

const TYPE_CONFIG: Record<string, { bg: string; border: string; color: string; icon: string }> = {
  info: { bg: "#EFF6FF", border: "#BFDBFE", color: "#2563EB", icon: "ℹ️" },
  warning: { bg: "#FEF3C7", border: "#FDE68A", color: "#D97706", icon: "⚠️" },
  success: { bg: "#F0FDF4", border: "#BBF7D0", color: "#059669", icon: "✓" },
  action: { bg: "#FEF2F2", border: "#FECACA", color: "#DC2626", icon: "❗" },
  match: { bg: "#F5F3FF", border: "#DDD6FE", color: "#7C3AED", icon: "🔗" },
};

export default function NotifikaciePage() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { generateNotifications(); }, []);

  async function generateNotifications() {
    setLoading(true);
    const notifications: Notif[] = [];

    // 1. Matching zhody — kupujúci vs nehnuteľnosti
    const [{ data: kupujuci }, { data: nehnutelnosti }, { data: objednavky }] = await Promise.all([
      supabase.from("klienti").select("id,meno,rozpocet_max,lokalita").eq("typ", "kupujuci").limit(50),
      supabase.from("nehnutelnosti").select("id,nazov,typ,cena,lokalita,created_at").neq("stav", "predane").limit(50),
      supabase.from("objednavky").select("id,klient_id,druh,cena_do,lokalita,created_at").limit(50),
    ]);

    // Generuj match notifikácie
    (objednavky ?? []).forEach(obj => {
      const klient = (kupujuci ?? []).find(k => k.id === obj.klient_id);
      if (!klient) return;

      const matches = (nehnutelnosti ?? []).filter(n => {
        if (obj.druh && n.typ && obj.druh !== n.typ) return false;
        if (obj.cena_do && n.cena && n.cena > obj.cena_do) return false;
        return true;
      });

      if (matches.length > 0) {
        notifications.push({
          id: `match-${obj.id}`,
          type: "match",
          title: `${matches.length} zhôd pre ${klient.meno}`,
          detail: `Objednávka na ${obj.druh || "nehnuteľnosť"}${obj.cena_do ? ` do ${Number(obj.cena_do).toLocaleString("sk")} €` : ""} — nájdené ponuky v portfóliu`,
          time: new Date(obj.created_at).toLocaleDateString("sk"),
          read: false,
          link: "/matching",
        });
      }
    });

    // 2. Nové nábery za posledných 7 dní
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: recentNabery } = await supabase
      .from("naberove_listy")
      .select("id,typ_nehnutelnosti,obec,predajna_cena,created_at,klient_id")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false });

    (recentNabery ?? []).forEach(n => {
      notifications.push({
        id: `naber-${n.id}`,
        type: "success",
        title: "Nový náber uložený",
        detail: `${n.typ_nehnutelnosti || "Nehnuteľnosť"}, ${n.obec || "—"}${n.predajna_cena ? ` — ${Number(n.predajna_cena).toLocaleString("sk")} €` : ""}`,
        time: new Date(n.created_at).toLocaleDateString("sk"),
        read: true,
        link: n.klient_id ? `/klienti/${n.klient_id}` : undefined,
      });
    });

    // 3. Klienti bez aktivity > 7 dní (typ predavajuci, aktívny)
    const { data: staleKlienti } = await supabase
      .from("klienti")
      .select("id,meno,created_at")
      .in("status", ["aktivny", "novy_kontakt", "dohodnuty_naber"])
      .lte("created_at", weekAgo)
      .order("created_at", { ascending: true })
      .limit(5);

    (staleKlienti ?? []).forEach(k => {
      const daysSince = Math.floor((Date.now() - new Date(k.created_at).getTime()) / 86400000);
      notifications.push({
        id: `stale-${k.id}`,
        type: "action",
        title: "Ozvať sa klientovi",
        detail: `${k.meno} — posledný kontakt pred ${daysSince} dňami`,
        time: new Date(k.created_at).toLocaleDateString("sk"),
        read: false,
        link: `/klienti/${k.id}`,
      });
    });

    // 4. Nehnuteľnosti bez dokumentov (warning)
    const { data: noDocProps } = await supabase
      .from("nehnutelnosti")
      .select("id,nazov")
      .is("energeticky_certifikat", null)
      .neq("stav", "predane")
      .limit(3);

    (noDocProps ?? []).forEach(n => {
      notifications.push({
        id: `doc-${n.id}`,
        type: "warning",
        title: "Chýba energetický certifikát",
        detail: `${n.nazov || "Nehnuteľnosť"} — dokument treba doplniť`,
        time: "systém",
        read: true,
        link: "/portfolio",
      });
    });

    // Sort: unread first, then by time
    notifications.sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return 0;
    });

    setNotifs(notifications);
    setLoading(false);
  }

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
            {loading ? "Načítavam..." : unread > 0 ? `${unread} neprečítaných` : "Všetko prečítané"}
          </p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} style={{
            padding: "8px 16px", background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "10px", fontSize: "12px", fontWeight: "600", cursor: "pointer", color: "var(--text-primary)",
          }}>Označiť všetko</button>
        )}
      </div>

      {loading && (
        <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>Načítavam notifikácie...</div>
      )}

      {!loading && notifs.length === 0 && (
        <div style={{
          padding: "60px", textAlign: "center", background: "var(--bg-surface)",
          border: "1px solid var(--border)", borderRadius: "14px",
        }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔔</div>
          <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>Žiadne notifikácie</div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>Všetko je v poriadku</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {notifs.map(n => {
          const c = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
          const inner = (
            <div style={{
              display: "flex", gap: "14px", padding: "16px",
              background: n.read ? "var(--bg-surface)" : c.bg,
              border: `1px solid ${n.read ? "var(--border)" : c.border}`,
              borderRadius: "12px", cursor: "pointer", transition: "all 0.15s",
              opacity: n.read ? 0.7 : 1,
            }}
              onClick={() => setNotifs(ns => ns.map(x => x.id === n.id ? { ...x, read: true } : x))}
            >
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
              {n.link && <span style={{ fontSize: "14px", color: "var(--text-muted)", alignSelf: "center" }}>→</span>}
            </div>
          );

          if (n.link) {
            return <Link key={n.id} href={n.link} style={{ textDecoration: "none" }}>{inner}</Link>;
          }
          return <div key={n.id}>{inner}</div>;
        })}
      </div>
    </div>
  );
}
