"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Klient, Nehnutelnost } from "@/lib/database.types";
import { STATUS_LABELS } from "@/lib/database.types";
import NewKlientModal from "@/components/NewKlientModal";

interface ActivityItem {
  id: string;
  type: "klient" | "nehnutelnost";
  title: string;
  sub: string;
  dot: string;
}

export default function Dashboard() {
  const [phone, setPhone] = useState("");
  const [checking, setChecking] = useState(false);
  const [found, setFound] = useState<Klient | null | "none">(null);
  const [modal, setModal] = useState(false);
  const [modalPhone, setModalPhone] = useState("");

  const [counts, setCounts] = useState({ klienti: 0, nehnutelnosti: 0 });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setLoadingActivity(true);
      const [{ count: kCount }, { count: nCount }, { data: recentK }, { data: recentN }] = await Promise.all([
        supabase.from("klienti").select("*", { count: "exact", head: true }),
        supabase.from("nehnutelnosti").select("*", { count: "exact", head: true }),
        supabase.from("klienti").select("id,meno,status,created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("nehnutelnosti").select("id,nazov,cena,created_at").order("created_at", { ascending: false }).limit(5),
      ]);
      setCounts({ klienti: kCount ?? 0, nehnutelnosti: nCount ?? 0 });

      const items: ActivityItem[] = [
        ...(recentK ?? []).map((k: Pick<Klient, "id" | "meno" | "status" | "created_at">) => ({
          id: k.id, type: "klient" as const,
          title: `Nový klient: ${k.meno}`,
          sub: `${k.status ? (STATUS_LABELS[k.status as keyof typeof STATUS_LABELS] ?? k.status) : "—"} · ${new Date(k.created_at).toLocaleDateString("sk")}`,
          dot: "var(--success)",
        })),
        ...(recentN ?? []).map((n: Pick<Nehnutelnost, "id" | "nazov" | "cena" | "created_at">) => ({
          id: n.id, type: "nehnutelnost" as const,
          title: `Pridaná nehnuteľnosť: ${n.nazov}`,
          sub: `${n.cena != null ? n.cena.toLocaleString("sk") + " €" : "—"} · ${new Date(n.created_at).toLocaleDateString("sk")}`,
          dot: "var(--accent)",
        })),
      ].sort((a, b) => 0) // mixed, keep order as-is
        .slice(0, 8);

      setActivity(items);
      setLoadingActivity(false);
    }
    loadDashboard();
  }, []);

  async function checkPhone(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = phone.trim();
    if (!cleaned) return;
    setChecking(true);
    setFound(null);
    const { data } = await supabase
      .from("klienti")
      .select("*")
      .or(`mobil.eq.${cleaned},mobil.eq.${cleaned.replace(/\s/g, "")}`)
      .limit(1)
      .maybeSingle();
    setChecking(false);
    if (data) {
      setFound(data);
    } else {
      setFound("none");
      setModalPhone(cleaned);
      setModal(true);
    }
  }

  const stats = [
    { value: String(counts.nehnutelnosti), label: "Nehnuteľnosti v ponuke", color: "var(--accent)", icon: "🏠" },
    { value: String(counts.klienti), label: "Klienti celkom", color: "var(--success)", icon: "👥" },
    { value: "0", label: "Aktívne zhody", color: "var(--warning)", icon: "🔗" },
    { value: "—", label: "AI skóre portfólia", color: "var(--purple)", icon: "🤖" },
  ];

  return (
    <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* Phone check */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "22px 24px", borderLeft: "4px solid var(--accent)" }}>
          <div style={{ fontWeight: "700", fontSize: "15px", color: "var(--text-primary)", marginBottom: "4px" }}>📞 Overenie čísla — Nový klient</div>
          <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginBottom: "14px" }}>Zadaj telefónne číslo a systém automaticky overí, či klient existuje.</div>
          <form onSubmit={checkPhone} style={{ display: "flex", gap: "10px" }}>
            <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); setFound(null); }}
              placeholder="+421 900 000 000"
              style={{ flex: 1, padding: "10px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "14px", color: "var(--text-primary)", outline: "none" }} />
            <button type="submit" disabled={checking || !phone.trim()}
              style={{ padding: "10px 20px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13.5px", fontWeight: "600", cursor: checking ? "not-allowed" : "pointer", opacity: !phone.trim() ? 0.5 : 1 }}>
              {checking ? "Hľadám..." : "Overiť"}
            </button>
          </form>
          {found === "none" && !modal && (
            <div style={{ marginTop: "12px", padding: "12px 14px", background: "#FEF3C7", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "#92400E" }}>Klient s číslom <strong>{phone}</strong> neexistuje.</span>
              <button onClick={() => { setModalPhone(phone); setModal(true); }}
                style={{ padding: "6px 14px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                + Pridať
              </button>
            </div>
          )}
          {found && found !== "none" && (
            <div style={{ marginTop: "12px", padding: "12px 14px", background: "#D1FAE5", borderRadius: "8px" }}>
              <div style={{ fontSize: "13px", color: "#065F46", fontWeight: "600" }}>✓ Klient nájdený: {(found as Klient).meno}</div>
              <div style={{ fontSize: "12px", color: "#047857", marginTop: "2px" }}>
                Status: {STATUS_LABELS[(found as Klient).status]} · Pridaný: {new Date((found as Klient).created_at).toLocaleDateString("sk")}
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px 18px 16px", borderTop: `3px solid ${s.color}` }}>
              <div style={{ fontSize: "20px", marginBottom: "8px" }}>{s.icon}</div>
              <div style={{ fontSize: "26px", fontWeight: "800", color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Activity */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
          <div style={{ fontWeight: "700", fontSize: "14.5px", color: "var(--text-primary)", marginBottom: "16px" }}>Posledná aktivita</div>
          {loadingActivity && <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "10px 0" }}>Načítavam...</div>}
          {!loadingActivity && activity.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "24px 0" }}>Zatiaľ žiadna aktivita.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {activity.map(a => (
              <div key={a.id + a.type} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: a.dot, marginTop: "4px", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-primary)" }}>{a.title}</div>
                  <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "1px" }}>{a.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right column */}
      <div style={{ width: "300px", minWidth: "280px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px" }}>
          <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text-primary)", marginBottom: "14px" }}>Rýchle akcie</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { label: "+ Nový klient", color: "var(--accent)", action: () => { setModalPhone(""); setModal(true); } },
              { label: "+ Nová nehnuteľnosť", color: "var(--success)", href: "/portfolio" },
              { label: "Spustiť Matching", color: "var(--warning)", href: "/matching" },
              { label: "AI Analýza portfólia", color: "var(--purple)", href: "/analyzy" },
            ].map(a =>
              a.action
                ? <button key={a.label} onClick={a.action} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "13px", fontWeight: "500", cursor: "pointer", width: "100%", textAlign: "left" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: a.color, flexShrink: 0 }} />{a.label}
                  </button>
                : <a key={a.label} href={a.href} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-primary)", textDecoration: "none", fontSize: "13px", fontWeight: "500" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: a.color, flexShrink: 0 }} />{a.label}
                  </a>
            )}
          </div>
        </div>
      </div>

      {modal && <NewKlientModal initialPhone={modalPhone} onClose={() => setModal(false)} onSaved={() => { setPhone(""); setFound(null); }} />}
    </div>
  );
}
