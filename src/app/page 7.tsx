"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Klient } from "@/lib/database.types";
import { STATUS_LABELS } from "@/lib/database.types";
import NewKlientModal from "@/components/NewKlientModal";
import ActivityRings from "@/components/ActivityRings";
import SystemSearch from "@/components/SystemSearch";

interface ActivityItem {
  id: string;
  type: "klient" | "nehnutelnost";
  title: string;
  sub: string;
}

type TileKey = "overenie" | "vyhladavanie" | "ciele" | "prehlad" | "aktivita";

interface TileConfig {
  key: TileKey;
  label: string;
  icon: string;
}

const ALL_TILES: TileConfig[] = [
  { key: "overenie", label: "Overenie čísla", icon: "📞" },
  { key: "vyhladavanie", label: "Vyhľadávanie", icon: "🔍" },
  { key: "ciele", label: "Mesačné ciele", icon: "🎯" },
  { key: "prehlad", label: "Prehľad", icon: "📊" },
  { key: "aktivita", label: "Posledná aktivita", icon: "⏱" },
];

const DEFAULT_TILES: TileKey[] = ["overenie", "vyhladavanie", "ciele", "prehlad", "aktivita"];

function loadTiles(): TileKey[] {
  if (typeof window === "undefined") return DEFAULT_TILES;
  try {
    const raw = localStorage.getItem("dashboard_tiles");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_TILES;
}

export default function Dashboard() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [checking, setChecking] = useState(false);
  const [found, setFound] = useState<Klient | null | "none">(null);
  const [checked, setChecked] = useState(false);
  const [modal, setModal] = useState(false);
  const [modalPhone, setModalPhone] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [stats, setStats] = useState({
    klienti: 0, nehnutelnosti: 0,
    mesacnyObrat: 0, rocnyObrat: 0, zmluvy: 0, nabery: 0,
  });
  const [goals, setGoals] = useState({ obrat: 5000, zmluvy: 10, nabery: 20 });

  // Tile customization
  const [tiles, setTiles] = useState<TileKey[]>(DEFAULT_TILES);
  const [showTileEditor, setShowTileEditor] = useState(false);

  useEffect(() => { setTiles(loadTiles()); }, []);

  function toggleTile(key: TileKey) {
    setTiles(prev => {
      const next = prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key];
      localStorage.setItem("dashboard_tiles", JSON.stringify(next));
      return next;
    });
  }

  // Load goals from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("makler_goals");
      if (raw) setGoals(g => ({ ...g, ...JSON.parse(raw) }));
    } catch { /* ignore */ }
    function onGoalsUpdated() {
      try {
        const raw = localStorage.getItem("makler_goals");
        if (raw) setGoals(g => ({ ...g, ...JSON.parse(raw) }));
      } catch { /* ignore */ }
    }
    window.addEventListener("goals-updated", onGoalsUpdated);
    return () => window.removeEventListener("goals-updated", onGoalsUpdated);
  }, []);

  async function loadDashboard() {
    setLoadingActivity(true);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

    const [{ count: kCount }, { count: nCount }, { data: recentK }, { data: recentN }, { data: monthlyK }, { data: yearlyK }] = await Promise.all([
      supabase.from("klienti").select("*", { count: "exact", head: true }),
      supabase.from("nehnutelnosti").select("*", { count: "exact", head: true }),
      supabase.from("klienti").select("id,meno,status,created_at").order("created_at", { ascending: false }).limit(5),
      supabase.from("nehnutelnosti").select("id,nazov,cena,created_at").order("created_at", { ascending: false }).limit(5),
      supabase.from("klienti").select("proviziaeur,status,created_at").gte("created_at", monthStart),
      supabase.from("klienti").select("proviziaeur,status").gte("created_at", yearStart),
    ]);

    const mesacnyObrat = (monthlyK ?? []).reduce((sum, k) => sum + (k.proviziaeur || 0), 0);
    const rocnyObrat = (yearlyK ?? []).reduce((sum, k) => sum + (k.proviziaeur || 0), 0);
    const zmluvy = (monthlyK ?? []).filter(k => k.status === "dohodnuty_naber" || k.status === "aktivny").length;
    const nabery = (monthlyK ?? []).length;

    setStats({
      klienti: kCount ?? 0, nehnutelnosti: nCount ?? 0,
      mesacnyObrat, rocnyObrat, zmluvy, nabery,
    });

    const items: ActivityItem[] = [
      ...(recentK ?? []).map((k: { id: string; meno: string; status: string; created_at: string }) => ({
        id: k.id, type: "klient" as const,
        title: k.meno,
        sub: `${k.status ? (STATUS_LABELS[k.status as keyof typeof STATUS_LABELS] ?? k.status) : "—"} · ${new Date(k.created_at).toLocaleDateString("sk")}`,
      })),
      ...(recentN ?? []).map((n: { id: string; nazov: string; cena: number; created_at: string }) => ({
        id: n.id, type: "nehnutelnost" as const,
        title: n.nazov || "Nehnuteľnosť",
        sub: `${n.cena != null ? n.cena.toLocaleString("sk") + " €" : "—"} · ${new Date(n.created_at).toLocaleDateString("sk")}`,
      })),
    ].slice(0, 6);
    setActivity(items);
    setLoadingActivity(false);
  }
  useEffect(() => { loadDashboard(); }, []);

  // Auto-check phone
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6) { setFound(null); setChecked(false); return; }
    debounceRef.current = setTimeout(async () => {
      setChecking(true);
      const last9 = digits.slice(-9);
      const { data } = await supabase.from("klienti").select("*").ilike("telefon", `%${last9}%`).limit(1).maybeSingle();
      setChecking(false);
      setChecked(true);
      if (data) {
        setFound(data);
      } else {
        setFound("none");
        setModalPhone(phone.trim().replace(/[\s\-\(\)]/g, "").replace(/^00/, "+"));
        setModal(true);
      }
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [phone]);

  const cardSt: React.CSSProperties = {
    background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px",
  };

  const has = (key: TileKey) => tiles.includes(key);

  // Build grid rows from active tiles
  const topRow = [has("overenie") && "overenie", has("vyhladavanie") && "vyhladavanie"].filter(Boolean) as TileKey[];
  const midRow = [has("ciele") && "ciele", has("prehlad") && "prehlad"].filter(Boolean) as TileKey[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Customize button */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={() => setShowTileEditor(!showTileEditor)} style={{
          padding: "6px 14px", background: showTileEditor ? "#374151" : "var(--bg-surface)",
          color: showTileEditor ? "#fff" : "var(--text-muted)",
          border: "1px solid var(--border)", borderRadius: "8px",
          fontSize: "12px", fontWeight: "500", cursor: "pointer",
          display: "flex", alignItems: "center", gap: "6px",
        }}>
          {showTileEditor ? "Hotovo" : "Prispôsobiť"}
        </button>
      </div>

      {/* Tile editor */}
      {showTileEditor && (
        <div style={{ ...cardSt, padding: "16px 20px" }}>
          <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "12px" }}>
            Vyber dlaždice na dashboarde
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {ALL_TILES.map(t => (
              <button key={t.key} onClick={() => toggleTile(t.key)} style={{
                padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "500",
                cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                background: tiles.includes(t.key) ? "#374151" : "var(--bg-elevated)",
                color: tiles.includes(t.key) ? "#fff" : "var(--text-secondary)",
                border: tiles.includes(t.key) ? "1px solid #111" : "1px solid var(--border)",
                transition: "all 0.15s",
              }}>
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Top row: Phone check + Search */}
      {topRow.length > 0 && (
        <div className="dash-grid" style={{ display: "grid", gridTemplateColumns: topRow.length === 2 ? "1fr 1fr" : "1fr", gap: "20px" }}>
          {has("overenie") && (
            <div style={cardSt}>
              <div style={{ fontWeight: "600", fontSize: "14px", color: "var(--text-primary)", marginBottom: "4px" }}>Overenie čísla</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>Automatické overenie pri zadaní čísla</div>
              <div style={{ position: "relative" }}>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+421 900 000 000"
                  style={{
                    width: "100%", padding: "11px 40px 11px 14px", background: "var(--bg-elevated)",
                    border: checked ? (found === "none" ? "2px solid #34C759" : found ? "2px solid #FF9500" : "1px solid var(--border)") : "1px solid var(--border)",
                    borderRadius: "10px", fontSize: "14px", color: "var(--text-primary)", outline: "none",
                  }} />
                {checking && <span style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "13px", color: "var(--text-muted)" }}>...</span>}
                {checked && !checking && <span style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "13px" }}>{found === "none" ? "✓" : "!"}</span>}
              </div>
              {checked && found === "none" && !modal && (
                <div style={{ marginTop: "10px", padding: "10px 12px", background: "#F0FDF4", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "#15803D" }}>Číslo nie je v databáze</span>
                  <button onClick={() => { setModalPhone(phone); setModal(true); }}
                    style={{ padding: "5px 12px", background: "#374151", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                    + Pridať
                  </button>
                </div>
              )}
              {found && found !== "none" && (
                <div style={{ marginTop: "10px", padding: "10px 12px", background: "#FFFBEB", borderRadius: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: "12px", color: "#92400E", fontWeight: "600" }}>{(found as Klient).meno}</div>
                      <div style={{ fontSize: "11px", color: "#A16207", marginTop: "2px" }}>
                        {(found as Klient).telefon} · {STATUS_LABELS[(found as Klient).status]}
                      </div>
                    </div>
                    <button onClick={() => { setModalPhone(phone.trim().replace(/[\s\-\(\)]/g, "").replace(/^00/, "+")); setModal(true); }}
                      style={{ padding: "5px 12px", background: "#374151", color: "#fff", border: "none", borderRadius: "6px", fontSize: "11px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }}>
                      + Nový
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {has("vyhladavanie") && (
            <div style={cardSt}>
              <div style={{ fontWeight: "600", fontSize: "14px", color: "var(--text-primary)", marginBottom: "4px" }}>Vyhľadávanie</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>Klienti, nehnuteľnosti, funkcie</div>
              <SystemSearch />
            </div>
          )}
        </div>
      )}

      {/* Middle row: Rings + Stats */}
      {midRow.length > 0 && (
        <div className="dash-grid" style={{ display: "grid", gridTemplateColumns: midRow.length === 2 ? "1fr 1fr" : "1fr", gap: "20px" }}>
          {has("ciele") && (
            <div style={cardSt}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ fontWeight: "600", fontSize: "14px", color: "var(--text-primary)" }}>Mesačné ciele</div>
                <button onClick={() => router.push("/nastavenia")} style={{
                  padding: "4px 10px", background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  borderRadius: "6px", fontSize: "11px", color: "var(--text-muted)", cursor: "pointer",
                  fontWeight: "500",
                }}>
                  Upraviť
                </button>
              </div>
              <ActivityRings
                obrat={{ current: stats.mesacnyObrat, target: goals.obrat }}
                zmluvy={{ current: stats.zmluvy, target: goals.zmluvy }}
                nabery={{ current: stats.nabery, target: goals.nabery }}
              />
            </div>
          )}

          {has("prehlad") && (
            <div style={cardSt}>
              <div style={{ fontWeight: "600", fontSize: "14px", color: "var(--text-primary)", marginBottom: "16px" }}>Prehľad</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {[
                  { label: "Mesačný obrat", value: `${stats.mesacnyObrat.toLocaleString("sk")} €` },
                  { label: "Ročný obrat", value: `${stats.rocnyObrat.toLocaleString("sk")} €` },
                  { label: "Zmluvy tento mesiac", value: String(stats.zmluvy) },
                  { label: "Nový klienti", value: String(stats.nabery) },
                  { label: "Nehnuteľnosti", value: String(stats.nehnutelnosti) },
                  { label: "Klienti celkom", value: String(stats.klienti) },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px", fontWeight: "500" }}>{s.label}</div>
                    <div style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", lineHeight: 1.1 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Activity feed */}
      {has("aktivita") && (
        <div style={cardSt}>
          <div style={{ fontWeight: "600", fontSize: "14px", color: "var(--text-primary)", marginBottom: "14px" }}>Posledná aktivita</div>
          {loadingActivity && <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "10px 0" }}>Načítavam...</div>}
          {!loadingActivity && activity.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>Zatiaľ žiadna aktivita</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {activity.map(a => (
              <Link key={a.id + a.type} href={a.type === "klient" ? `/klienti?edit=${a.id}` : `/portfolio`} style={{
                display: "flex", gap: "10px", alignItems: "center", textDecoration: "none",
                padding: "8px 10px", borderRadius: "10px", transition: "background 0.1s", cursor: "pointer",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-elevated)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
                  background: "#F5F5F5",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "12px", color: "var(--text-muted)",
                }}>
                  {a.type === "klient" ? "👤" : "🏠"}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-primary)" }}>{a.title}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{a.sub}</div>
                </div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {modal && <NewKlientModal open initialPhone={modalPhone} showTypKlienta defaultTyp="predavajuci" onClose={() => setModal(false)} onSaved={() => { setPhone(""); setFound(null); setChecked(false); loadDashboard(); }} />}
    </div>
  );
}
