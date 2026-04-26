"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  DndContext, useDraggable, useDroppable, type DragEndEvent,
  PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import type { Klient } from "@/lib/database.types";
import { STATUS_LABELS } from "@/lib/database.types";
import NewKlientModal from "@/components/NewKlientModal";
import ActivityRings from "@/components/ActivityRings";
import SystemSearch from "@/components/SystemSearch";
import LinkGoogleBanner from "@/components/LinkGoogleBanner";
import { useAuth } from "@/components/AuthProvider";
import { getUserItem, setUserItem } from "@/lib/userStorage";
import { getMaklerUuid } from "@/lib/maklerMap";

interface ActivityItem {
  id: string;
  type: "klient" | "nehnutelnost";
  title: string;
  sub: string;
}

type TileKey = "overenie" | "vyhladavanie" | "ciele" | "prehlad" | "aktivita" | "kalendar" | "pipeline";

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
  { key: "kalendar", label: "Kalendár", icon: "📅" },
  { key: "pipeline", label: "Pipeline", icon: "📈" },
  { key: "aktivita", label: "Posledná aktivita", icon: "⏱" },
];

const DEFAULT_TILES: TileKey[] = ["overenie", "vyhladavanie", "ciele", "prehlad", "kalendar", "pipeline", "aktivita"];

/** Šírka tile-ov v 12-col gride: 4 = 1/3, 6 = 1/2, 12 = celá šírka. */
const DEFAULT_TILE_WIDTHS: Record<TileKey, number> = {
  overenie: 6, vyhladavanie: 6, ciele: 6, prehlad: 6,
  kalendar: 12, pipeline: 12, aktivita: 12,
};
/** Cyklus veľkostí pri klikaní na resize tlačidlo. */
const SIZE_CYCLE = [4, 6, 12];
const SIZE_LABEL: Record<number, string> = { 4: "1/3", 6: "1/2", 12: "1/1" };

interface CalEvent {
  id: string;
  summary: string;
  location?: string;
  start: string;
  end: string;
  allDay: boolean;
  source?: string;
}

function parseCalEvents(): CalEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("gcal_events");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

async function fetchCalendarEvents(userId?: string): Promise<CalEvent[]> {
  if (!userId) return parseCalEvents();
  try {
    const res = await fetch(`/api/google/calendar?userId=${userId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.events && data.events.length > 0) {
        const events: CalEvent[] = data.events.map((e: { id: string; summary: string; location?: string; start: string; end: string }) => ({
          id: e.id,
          summary: e.summary,
          location: e.location || "",
          start: e.start || "",
          end: e.end || "",
          allDay: !e.start.includes("T"),
          source: "gcal",
        }));
        localStorage.setItem("gcal_events", JSON.stringify(events));
        return events;
      }
    }
  } catch { /* fallback to localStorage */ }
  return parseCalEvents();
}

/** Jeden deň v mini week view — droppable target pre event drop. */
function DroppableDay({ dateStr, children }: { dateStr: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: `day-${dateStr}` });
  return (
    <div ref={setNodeRef} style={{
      textAlign: "center", flex: 1,
      outline: isOver ? "2px dashed var(--accent)" : "none",
      outlineOffset: "2px",
      borderRadius: "8px",
      transition: "outline 0.1s",
    }}>
      {children}
    </div>
  );
}

/** Jeden event v dennom výpise — draggable. */
function DraggableEvent({
  event, children,
}: { event: CalEvent; children: (listeners: Record<string, unknown>) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `event-${event.id}`,
    data: { event },
  });
  return (
    <div ref={setNodeRef} {...attributes} style={{
      transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined,
      opacity: isDragging ? 0.5 : 1,
      cursor: isDragging ? "grabbing" : "grab",
      touchAction: "none",
    }}>
      {children(listeners as unknown as Record<string, unknown>)}
    </div>
  );
}

function CalendarWidget({ userId }: { userId?: string }) {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    setSelectedDate(new Date().toISOString().slice(0, 10));
    // Najprv zobraz z localStorage cache, potom fetch čerstvé
    const cached = parseCalEvents();
    if (cached.length > 0) setEvents(cached);

    function refresh() {
      fetchCalendarEvents(userId).then(fresh => {
        setEvents(fresh);
        setLoading(false);
      });
    }
    refresh();

    // Auto-refresh every 30s + on tab focus
    const interval = setInterval(refresh, 30000);
    function onVisibility() { if (document.visibilityState === "visible") refresh(); }
    document.addEventListener("visibilitychange", onVisibility);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisibility); };
  }, [userId]);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Generate 7 days (current week Mon-Sun)
  const days: Date[] = [];
  const startOfWeek = new Date(today);
  // Bug fix: ak je dnes nedeľa (getDay=0), pôvodný vzorec posunul na +1 deň → ďalší týždeň.
  // Správne: nedeľa → -6 dní; iné dni → 1 - dow (napr. utorok dow=2 → -1 deň).
  const dow = startOfWeek.getDay(); // 0=Ne, 1=Po, ..., 6=So
  const offsetToMonday = dow === 0 ? -6 : 1 - dow;
  startOfWeek.setDate(startOfWeek.getDate() + offsetToMonday);
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const dayNames = ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"];

  function fmtTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString("sk", { hour: "2-digit", minute: "2-digit" });
  }

  function eventsForDay(date: Date) {
    const ds = date.toISOString().slice(0, 10);
    return events.filter(e => e.start.slice(0, 10) === ds);
  }

  // Events for selected day only, sorted by start time
  const selectedDayEvents = events
    .filter(e => e.start.slice(0, 10) === selectedDate)
    .sort((a, b) => a.start.localeCompare(b.start));

  async function handleDragEnd(e: DragEndEvent) {
    if (!e.over || !userId) return;
    const overId = String(e.over.id);
    if (!overId.startsWith("day-")) return;
    const newDate = overId.slice(4); // "YYYY-MM-DD"
    const dragged = (e.active.data.current as { event?: CalEvent } | undefined)?.event;
    if (!dragged || dragged.start.slice(0, 10) === newDate) return;

    // Zachová čas (len posunie deň)
    const oldStart = new Date(dragged.start);
    const oldEnd = new Date(dragged.end);
    const diffMs =
      new Date(newDate + "T00:00:00").getTime() -
      new Date(dragged.start.slice(0, 10) + "T00:00:00").getTime();
    const newStart = new Date(oldStart.getTime() + diffMs).toISOString();
    const newEnd = new Date(oldEnd.getTime() + diffMs).toISOString();

    // Optimistic update
    setEvents((prev) => prev.map((ev) => ev.id === dragged.id ? { ...ev, start: newStart, end: newEnd } : ev));
    setSelectedDate(newDate);

    try {
      const res = await fetch("/api/google/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, eventId: dragged.id, start: newStart, end: newEnd }),
      });
      if (!res.ok) throw new Error("patch_failed");
    } catch {
      // Rollback na pôvodné hodnoty + refetch
      setEvents((prev) => prev.map((ev) => ev.id === dragged.id ? { ...ev, start: dragged.start, end: dragged.end } : ev));
      fetchCalendarEvents(userId).then(setEvents);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
    <div>
      {/* Mini week view — clickable + droppable days */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
        {days.map((d, i) => {
          const ds = d.toISOString().slice(0, 10);
          const isToday = ds === todayStr;
          const isSelected = ds === selectedDate;
          const hasEvents = eventsForDay(d).length > 0;
          return (
            <DroppableDay key={i} dateStr={ds}>
              <div onClick={() => setSelectedDate(ds)} style={{ cursor: "pointer" }}>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", marginBottom: "4px" }}>
                  {dayNames[i]}
                </div>
                <div style={{
                  width: "32px", height: "32px", borderRadius: "50%", margin: "0 auto",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "13px", fontWeight: isToday || isSelected ? "800" : "500",
                  background: isSelected ? "#374151" : "transparent",
                  color: isSelected ? "#fff" : isToday ? "var(--accent)" : "var(--text-primary)",
                  border: isToday && !isSelected ? "2px solid var(--accent)" : "2px solid transparent",
                  transition: "all 0.15s",
                }}>
                  {d.getDate()}
                </div>
                {hasEvents && (
                  <div style={{
                    width: "4px", height: "4px", borderRadius: "50%",
                    background: isSelected ? "#374151" : "var(--accent)",
                    margin: "3px auto 0",
                  }} />
                )}
              </div>
            </DroppableDay>
          );
        })}
      </div>

      {/* Event list for selected day */}
      {selectedDayEvents.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {selectedDayEvents.map(e => (
            <DraggableEvent key={e.id} event={e}>
              {(listeners) => (
                <div {...listeners} style={{
                  display: "flex", gap: "10px", alignItems: "flex-start",
                  padding: "8px 10px", borderRadius: "8px",
                  background: "rgba(0,122,255,0.05)",
                  borderLeft: "3px solid var(--accent)",
                }}>
                  <div style={{ minWidth: "42px", textAlign: "right" }}>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--accent)" }}>
                      {fmtTime(e.start)}
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                      {fmtTime(e.end)}
                    </div>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "12.5px", fontWeight: "600", color: "var(--text-primary)" }}>
                      {e.summary}
                    </div>
                    {e.location && (
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        📍 {e.location.split(",")[0]}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </DraggableEvent>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "16px 0", color: "var(--text-muted)", fontSize: "12px" }}>
          <div style={{ fontSize: "24px", marginBottom: "6px" }}>📅</div>
          {selectedDate === todayStr ? "Dnes žiadne udalosti" : "Žiadne udalosti v tento deň"}
        </div>
      )}
    </div>
    </DndContext>
  );
}

function loadTiles(userId?: string): TileKey[] {
  if (typeof window === "undefined") return DEFAULT_TILES;
  try {
    const raw = userId ? getUserItem(userId, "dashboard_tiles") : localStorage.getItem("dashboard_tiles");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_TILES;
}

/* ── Banner: kandidáti obhliadok z Google kalendára ───────────────── */
function ObhliadkyKandidatiBanner() {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<Array<{ id: string; summary: string; start: string; location: string; description?: string }>>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/obhliadky/auto-detect?userId=${user.id}`)
      .then(r => r.ok ? r.json() : { candidates: [] })
      .then(d => setCandidates((d.candidates || []).slice(0, 5)))
      .catch(() => {});
  }, [user?.id]);

  const visible = candidates.filter(c => !dismissed.has(c.id));
  if (hidden || visible.length === 0) return null;

  return (
    <div style={{
      padding: "16px 20px", background: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
      border: "1px solid #F59E0B", borderRadius: "14px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "10px" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: "700", color: "#92400E", marginBottom: "4px" }}>
            🔍 Možné obhliadky vo tvojom kalendári ({visible.length})
          </div>
          <div style={{ fontSize: "12px", color: "#A16207" }}>
            Tieto eventy v Google kalendári ešte nemajú vyznačenú obhliadku v CRM. Klikni na „Pridať" ak je to obhliadka — automaticky pripoji k pricializu klienta.
          </div>
        </div>
        <button onClick={() => setHidden(true)} style={{
          padding: "4px 10px", background: "transparent", border: "1px solid #D97706",
          borderRadius: "6px", fontSize: "11px", fontWeight: "600", color: "#92400E", cursor: "pointer", whiteSpace: "nowrap",
        }}>Skryť</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {visible.map(c => (
          <div key={c.id} style={{
            display: "flex", alignItems: "center", gap: "12px",
            padding: "10px 12px", background: "rgba(255,255,255,0.6)",
            border: "1px solid #FCD34D", borderRadius: "10px",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#92400E" }}>{c.summary}</div>
              <div style={{ fontSize: "11px", color: "#A16207", marginTop: "2px" }}>
                📅 {new Date(c.start).toLocaleString("sk", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                {c.location ? <> · 📍 {c.location}</> : null}
              </div>
            </div>
            <button onClick={() => setDismissed(prev => new Set(prev).add(c.id))}
              style={{ padding: "5px 10px", background: "transparent", border: "1px solid #D97706", borderRadius: "6px", fontSize: "11px", fontWeight: "600", color: "#92400E", cursor: "pointer" }}>
              Nie je obhliadka
            </button>
            <a href={`/klienti?addObhliadka=${encodeURIComponent(c.id)}&summary=${encodeURIComponent(c.summary)}&start=${encodeURIComponent(c.start)}&location=${encodeURIComponent(c.location || "")}`}
              style={{ padding: "6px 12px", background: "#92400E", color: "#fff", border: "none", borderRadius: "6px", fontSize: "11px", fontWeight: "700", cursor: "pointer", textDecoration: "none" }}>
              + Zaradiť ako obhliadku
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
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
    naberyTotal: 0, inzeraty: 0, predane: 0, objednavky: 0,
  });
  const [goals, setGoals] = useState({ obrat: 5000, zmluvy: 10, nabery: 20 });

  // Tile customization
  const [tiles, setTiles] = useState<TileKey[]>(DEFAULT_TILES);
  const [showTileEditor, setShowTileEditor] = useState(false);
  const [dragTile, setDragTile] = useState<TileKey | null>(null);
  const [tileWidths, setTileWidths] = useState<Record<TileKey, number>>(DEFAULT_TILE_WIDTHS);

  useEffect(() => {
    if (!user?.id) return;
    setTiles(loadTiles(user.id));
    try {
      const raw = getUserItem(user.id, "dashboard_tile_widths");
      if (raw) setTileWidths({ ...DEFAULT_TILE_WIDTHS, ...JSON.parse(raw) });
    } catch { /* ignore */ }
  }, [user?.id]);

  function cycleTileWidth(key: TileKey) {
    setTileWidths((prev) => {
      const cur = prev[key] ?? DEFAULT_TILE_WIDTHS[key];
      const idx = SIZE_CYCLE.indexOf(cur);
      const nextW = SIZE_CYCLE[(idx + 1) % SIZE_CYCLE.length];
      const next = { ...prev, [key]: nextW };
      if (user?.id) setUserItem(user.id, "dashboard_tile_widths", JSON.stringify(next));
      return next;
    });
  }

  function resetTileWidths() {
    setTileWidths(DEFAULT_TILE_WIDTHS);
    if (user?.id) setUserItem(user.id, "dashboard_tile_widths", JSON.stringify(DEFAULT_TILE_WIDTHS));
  }

  function toggleTile(key: TileKey) {
    setTiles(prev => {
      const next = prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key];
      if (user?.id) setUserItem(user.id, "dashboard_tiles", JSON.stringify(next));
      return next;
    });
  }

  function handleDragStart(key: TileKey) {
    setDragTile(key);
  }

  function handleDragOver(e: React.DragEvent, targetKey: TileKey) {
    e.preventDefault();
    if (!dragTile || dragTile === targetKey) return;
    setTiles(prev => {
      const next = [...prev];
      const fromIdx = next.indexOf(dragTile);
      const toIdx = next.indexOf(targetKey);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, dragTile);
      if (user?.id) setUserItem(user.id, "dashboard_tiles", JSON.stringify(next));
      return next;
    });
  }

  function handleDragEnd() {
    setDragTile(null);
  }

  // Load goals from localStorage (per-user)
  const uid = user?.id || "";
  useEffect(() => {
    if (!uid) return;
    try {
      const raw = getUserItem(uid, "makler_goals");
      if (raw) setGoals(g => ({ ...g, ...JSON.parse(raw) }));
    } catch { /* ignore */ }
    function onGoalsUpdated() {
      try {
        const raw = getUserItem(uid, "makler_goals");
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
    const isAdmin = user?.id === "ales";
    const maklerUuid = user?.id ? await getMaklerUuid(user.id) : null;

    // Helper: add makler filter for non-admin users
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kq = (q: any) => isAdmin || !maklerUuid ? q : q.eq("makler_id", maklerUuid);
    // nehnutelnosti uses makler_id (UUID), not makler (text)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nq = (q: any) => isAdmin || !maklerUuid ? q : q.eq("makler_id", maklerUuid);

    const [{ count: kCount }, { count: nCount }, { data: recentK }, { data: recentN }, { data: monthlyK }, { data: yearlyK }, { count: naberyCount }, { count: zmluvyCount }, { count: naberyTotal }, { count: inzeratyCount }, { count: predaneCount }, { count: objednavkyCount }] = await Promise.all([
      kq(supabase.from("klienti")).select("*", { count: "exact", head: true }),
      nq(supabase.from("nehnutelnosti")).select("*", { count: "exact", head: true }),
      kq(supabase.from("klienti")).select("id,meno,status,created_at").order("created_at", { ascending: false }).limit(5),
      nq(supabase.from("nehnutelnosti")).select("id,nazov,cena,created_at").order("created_at", { ascending: false }).limit(5),
      kq(supabase.from("klienti")).select("proviziaeur").gte("created_at", monthStart),
      kq(supabase.from("klienti")).select("proviziaeur").gte("created_at", yearStart),
      supabase.from("naberove_listy").select("*", { count: "exact", head: true }).gte("created_at", monthStart),
      supabase.from("naberove_listy").select("*", { count: "exact", head: true }).gte("created_at", monthStart).eq("zmluva", true),
      supabase.from("naberove_listy").select("*", { count: "exact", head: true }),
      nq(supabase.from("nehnutelnosti")).select("*", { count: "exact", head: true }).neq("stav", "predane"),
      nq(supabase.from("nehnutelnosti")).select("*", { count: "exact", head: true }).eq("stav", "predane"),
      supabase.from("objednavky").select("*", { count: "exact", head: true }),
    ]);

    const mesacnyObrat = (monthlyK ?? []).reduce((sum: number, k: { proviziaeur?: number }) => sum + (k.proviziaeur || 0), 0);
    const rocnyObrat = (yearlyK ?? []).reduce((sum: number, k: { proviziaeur?: number }) => sum + (k.proviziaeur || 0), 0);
    const zmluvy = zmluvyCount ?? 0;
    const nabery = naberyCount ?? 0;

    setStats({
      klienti: kCount ?? 0, nehnutelnosti: nCount ?? 0,
      mesacnyObrat, rocnyObrat, zmluvy, nabery,
      naberyTotal: naberyTotal ?? 0, inzeraty: inzeratyCount ?? 0,
      predane: predaneCount ?? 0, objednavky: objednavkyCount ?? 0,
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
    position: "relative",
  };
  const tileClass = showTileEditor ? "tile-editing" : "";
  const has = (key: TileKey) => tiles.includes(key);

  /** Obalí tile divom s CSS grid span + resize tlačidlom v edit mode. */
  function tileWrapStyle(key: TileKey): React.CSSProperties {
    const w = tileWidths[key] ?? DEFAULT_TILE_WIDTHS[key];
    return {
      gridColumn: `span ${w}`,
      cursor: showTileEditor ? (dragTile === key ? "grabbing" : "grab") : undefined,
      opacity: dragTile === key ? 0.4 : 1,
      transition: "opacity 0.15s",
    };
  }

  /** Drag reorder props — aktívne iba v edit mode. */
  function tileDragProps(key: TileKey) {
    if (!showTileEditor) return {};
    return {
      draggable: true,
      onDragStart: () => handleDragStart(key),
      onDragOver: (e: React.DragEvent) => handleDragOver(e, key),
      onDragEnd: handleDragEnd,
    };
  }

  /** Šípky + size button (render len v edit mode). Šípky fungujú všade,
   *  size button má zmysel len na desktop — skrytý cez CSS na mobile. */
  function TileControls({ tileKey }: { tileKey: TileKey }) {
    if (!showTileEditor) return null;
    const w = tileWidths[tileKey] ?? DEFAULT_TILE_WIDTHS[tileKey];
    const idx = tiles.indexOf(tileKey);
    const moveTile = (dir: -1 | 1) => {
      setTiles((prev) => {
        const next = [...prev];
        const from = next.indexOf(tileKey);
        const to = from + dir;
        if (from === -1 || to < 0 || to >= next.length) return prev;
        [next[from], next[to]] = [next[to], next[from]];
        if (user?.id) setUserItem(user.id, "dashboard_tiles", JSON.stringify(next));
        return next;
      });
    };
    const btnSt: React.CSSProperties = {
      padding: "4px 10px", background: "#374151", color: "#fff",
      border: "none", borderRadius: "6px", fontSize: "13px",
      fontWeight: 700, cursor: "pointer",
      boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
      minWidth: "32px", lineHeight: 1,
    };
    return (
      <div style={{ position: "absolute", top: 10, right: 10, zIndex: 2, display: "flex", gap: "4px" }}>
        <button onClick={(e) => { e.stopPropagation(); moveTile(-1); }}
          disabled={idx <= 0} title="Posunúť hore" style={{ ...btnSt, opacity: idx <= 0 ? 0.3 : 1 }}>↑</button>
        <button onClick={(e) => { e.stopPropagation(); moveTile(1); }}
          disabled={idx === -1 || idx >= tiles.length - 1} title="Posunúť dole" style={{ ...btnSt, opacity: idx >= tiles.length - 1 ? 0.3 : 1 }}>↓</button>
        <button onClick={(e) => { e.stopPropagation(); cycleTileWidth(tileKey); }}
          title="Zmeniť šírku" className="tile-size-btn"
          style={{ ...btnSt, fontSize: "11px" }}>{SIZE_LABEL[w]}</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Google link banner — zobrazuje sa len ak user nemá login_email */}
      <LinkGoogleBanner />

      {/* Auto-detect kandidátov obhliadok z Google kalendára */}
      <ObhliadkyKandidatiBanner />

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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "4px" }}>
                Zapni/vypni dlaždice
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Potiahni dlaždicu pre zmenu poradia · klikni na veľkosť (1/3 · 1/2 · 1/1) pri dlaždici pre zmenu šírky
              </div>
            </div>
            <button onClick={resetTileWidths} style={{
              padding: "6px 12px", background: "var(--bg-elevated)", color: "var(--text-secondary)",
              border: "1px solid var(--border)", borderRadius: "8px",
              fontSize: "11px", fontWeight: "500", cursor: "pointer", whiteSpace: "nowrap",
            }}>Obnoviť šírky</button>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {ALL_TILES.map(t => {
              const isActive = tiles.includes(t.key);
              const isDragging = dragTile === t.key;
              return (
                <button key={t.key}
                  draggable={isActive}
                  onDragStart={() => handleDragStart(t.key)}
                  onDragOver={e => handleDragOver(e, t.key)}
                  onDragEnd={handleDragEnd}
                  onClick={() => toggleTile(t.key)}
                  style={{
                    padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "500",
                    cursor: isActive ? "grab" : "pointer", display: "flex", alignItems: "center", gap: "6px",
                    background: isActive ? "#374151" : "var(--bg-elevated)",
                    color: isActive ? "#fff" : "var(--text-secondary)",
                    border: isActive ? "1px solid #111" : "1px solid var(--border)",
                    opacity: isDragging ? 0.5 : 1,
                    transition: "all 0.15s",
                  }}>
                  {isActive && <span style={{ fontSize: "10px", opacity: 0.6 }}>⠿</span>}
                  <span>{t.icon}</span> {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* === 12-col grid — iteruje cez `tiles` array aby sa rešpektovalo poradie
           (posuny šípkami/drag). Každý tile má gridColumn: span N z tileWidths. === */}
      <div className="dash-grid" style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "20px" }}>
        {tiles.map((key) => (
          <div key={key} className={tileClass} style={{ ...cardSt, ...tileWrapStyle(key) }} {...tileDragProps(key)}>
            <TileControls tileKey={key} />
            {key === "overenie" && (<>
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
            </>)}
            {key === "vyhladavanie" && (<>
              <div style={{ fontWeight: "600", fontSize: "14px", color: "var(--text-primary)", marginBottom: "4px" }}>Vyhľadávanie</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>Klienti, nehnuteľnosti, funkcie</div>
              <SystemSearch />
            </>)}
            {key === "ciele" && (<>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <Link href="/nastavenia" style={{ fontWeight: "600", fontSize: "14px", color: "var(--text-primary)", textDecoration: "none" }}>Mesačné ciele →</Link>
              </div>
              <ActivityRings
                obrat={{ current: stats.mesacnyObrat, target: goals.obrat }}
                zmluvy={{ current: stats.zmluvy, target: goals.zmluvy }}
                nabery={{ current: stats.nabery, target: goals.nabery }}
              />
            </>)}
            {key === "prehlad" && (<>
              <Link href="/klienti" style={{ fontWeight: "600", fontSize: "14px", color: "var(--text-primary)", marginBottom: "16px", display: "block", textDecoration: "none" }}>Prehľad →</Link>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {[
                  { label: "Mesačný obrat", value: `${stats.mesacnyObrat.toLocaleString("sk")} €` },
                  { label: "Ročný obrat", value: `${stats.rocnyObrat.toLocaleString("sk")} €` },
                  { label: "Zmluvy tento mesiac", value: String(stats.zmluvy) },
                  { label: "Nábery tento mesiac", value: String(stats.nabery) },
                  { label: "Nehnuteľnosti", value: String(stats.nehnutelnosti) },
                  { label: "Klienti celkom", value: String(stats.klienti) },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px", fontWeight: "500" }}>{s.label}</div>
                    <div style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", lineHeight: 1.1 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </>)}
            {key === "kalendar" && (<>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <Link href="/kalendar" style={{ fontWeight: "600", fontSize: "14px", color: "var(--text-primary)", textDecoration: "none" }}>Kalendár →</Link>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "500" }}>
                  {new Date().toLocaleDateString("sk", { weekday: "long", day: "numeric", month: "long" })}
                </div>
              </div>
              <CalendarWidget userId={user?.id} />
            </>)}
            {key === "pipeline" && (<>
              <Link href="/klienti" style={{ fontWeight: "600", fontSize: "14px", color: "var(--text-primary)", marginBottom: "16px", display: "block", textDecoration: "none" }}>Pipeline →</Link>
              {(() => {
                const stages = [
                  { label: "Klienti", value: stats.klienti, icon: "👥", color: "#3B82F6", route: "/klienti" },
                  { label: "Nábery", value: stats.naberyTotal, icon: "📝", color: "#8B5CF6", route: "/naber" },
                  { label: "Inzeráty", value: stats.inzeraty, icon: "📰", color: "#0891B2", route: "/portfolio" },
                  { label: "Objednávky", value: stats.objednavky, icon: "📋", color: "#F59E0B", route: "/kupujuci" },
                  { label: "Predané", value: stats.predane, icon: "🏆", color: "#059669", route: "/portfolio" },
                ];
                const maxVal = Math.max(...stages.map(s => s.value), 1);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {stages.map((s, i) => (
                      <div key={s.label} onClick={() => router.push(s.route)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "28px", fontSize: "16px", textAlign: "center", flexShrink: 0 }}>{s.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>{s.label}</span>
                            <span style={{ fontSize: "12px", fontWeight: "800", color: s.color }}>{s.value}</span>
                          </div>
                          <div style={{ height: "6px", background: "var(--bg-elevated)", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{
                              height: "100%", borderRadius: "3px",
                              width: `${Math.max((s.value / maxVal) * 100, s.value > 0 ? 8 : 0)}%`,
                              background: s.color,
                              transition: "width 0.5s ease",
                            }} />
                          </div>
                        </div>
                        {i < stages.length - 1 && (
                          <div style={{ fontSize: "10px", color: "var(--text-muted)", flexShrink: 0, width: "16px", textAlign: "center" }}>→</div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>)}
            {key === "aktivita" && (<>
              <Link href="/klienti" style={{ fontWeight: "600", fontSize: "14px", color: "var(--text-primary)", marginBottom: "14px", display: "block", textDecoration: "none" }}>Posledná aktivita →</Link>
              {loadingActivity && <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "10px 0" }}>Načítavam...</div>}
              {!loadingActivity && activity.length === 0 && (
                <div style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>Zatiaľ žiadna aktivita</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {activity.map(a => (
                  <Link key={a.id + a.type} href={a.type === "klient" ? `/klienti/${a.id}` : `/portfolio`} style={{
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
            </>)}
          </div>
        ))}
      </div>

      {modal && <NewKlientModal open initialPhone={modalPhone} showTypKlienta defaultTyp="predavajuci" onClose={() => setModal(false)} onSaved={() => { setPhone(""); setFound(null); setChecked(false); loadDashboard(); }} />}
    </div>
  );
}
