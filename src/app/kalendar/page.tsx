"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

/* ─── Types ─── */
interface CalEvent {
  id: string;
  summary: string;
  location?: string;
  description?: string;
  start: string;
  end: string;
  allDay: boolean;
  source?: string;
  color?: string;
}

type ViewMode = "day" | "week" | "3day";

/* ─── Helpers ─── */
function toDateStr(d: Date) {
  // Use local time, not UTC — prevents day shift in CET/CEST timezone
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("sk", { hour: "2-digit", minute: "2-digit" });
}

function eventDateStr(iso: string) {
  // Convert event start/end to local date string for comparison
  return toDateStr(new Date(iso));
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("sk", { weekday: "long", day: "numeric", month: "long" });
}

function fmtDateShort(d: Date) {
  return d.toLocaleDateString("sk", { weekday: "short", day: "numeric", month: "short" });
}

function minutesSinceMidnight(iso: string) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function durationMin(start: string, end: string) {
  return (new Date(end).getTime() - new Date(start).getTime()) / 60000;
}

function getMonday(d: Date) {
  const copy = new Date(d);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - (day === 0 ? 6 : day - 1));
  copy.setHours(0, 0, 0, 0);
  return copy;
}

const HOUR_HEIGHT = 60; // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const EVENT_COLORS = ["#3B82F6", "#8B5CF6", "#059669", "#F59E0B", "#EF4444", "#EC4899", "#0891B2", "#6366F1"];

function hashColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return EVENT_COLORS[Math.abs(h) % EVENT_COLORS.length];
}

/* ─── Fetch ─── */
async function fetchEvents(userId?: string): Promise<CalEvent[]> {
  // Najprv skús per-user OAuth
  if (userId) {
    try {
      const res = await fetch(`/api/google/calendar?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.events?.length > 0) {
          const events: CalEvent[] = data.events.map((e: { id: string; summary: string; description?: string; location?: string; start: string; end: string }) => ({
            id: e.id,
            summary: e.summary,
            description: e.description || "",
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
    } catch { /* fallback */ }
  }
  // Fallback na localStorage cache
  try {
    const cached = localStorage.getItem("gcal_events");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

/* ─── Event Detail Modal ─── */
function EventDetailModal({ event, onClose, onDelete, obhliadkaIdByEvent }: {
  event: CalEvent;
  onClose: () => void;
  onDelete: (id: string) => void;
  obhliadkaIdByEvent: Record<string, string>;
}) {
  const color = event.color || hashColor(event.id);
  // 1) Skús nájsť odkaz na obhliadkový list priamo v popise (nový formát)
  const obhliadkaMatch = (event.description || "").match(/\/obhliadky\/([0-9a-f-]{36})/i);
  // 2) Fallback — staré obhliadky bez URL v popise: lookup podľa calendar_event_id
  const obhliadkaId = obhliadkaMatch?.[1] || obhliadkaIdByEvent[event.id] || null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: "relative", background: "var(--bg-surface, #fff)", borderRadius: "16px",
        width: "min(440px, 90vw)", maxHeight: "85vh", overflow: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        {/* Header with color */}
        <div style={{ height: "6px", background: color, borderRadius: "16px 16px 0 0" }} />
        <div style={{ padding: "24px" }}>
          {/* Close */}
          <button onClick={onClose} style={{
            position: "absolute", top: "16px", right: "16px", width: "32px", height: "32px",
            border: "none", background: "var(--bg-elevated, #f3f4f6)", borderRadius: "8px",
            cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--text-muted, #6b7280)",
          }}>×</button>

          {/* Title */}
          <h2 style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary, #111)", margin: "0 0 20px", paddingRight: "40px" }}>
            {event.summary}
          </h2>

          {/* Time */}
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "16px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>
              🕐
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary, #111)" }}>
                {new Date(event.start).toLocaleDateString("sk", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </div>
              {!event.allDay && (
                <div style={{ fontSize: "13px", color: "var(--text-secondary, #6b7280)", marginTop: "2px" }}>
                  {fmtTime(event.start)} – {fmtTime(event.end)}
                  <span style={{ marginLeft: "8px", color: "var(--text-muted, #9ca3af)" }}>
                    ({Math.round(durationMin(event.start, event.end))} min)
                  </span>
                </div>
              )}
              {event.allDay && <div style={{ fontSize: "13px", color: "var(--text-secondary, #6b7280)" }}>Celý deň</div>}
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>
                📍
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: "500", color: "var(--text-primary, #111)" }}>
                  {event.location}
                </div>
                <a
                  href={`https://maps.google.com/maps?q=${encodeURIComponent(event.location)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: "12px", color: "var(--accent, #3b82f6)", textDecoration: "none", fontWeight: "500" }}
                >
                  Otvoriť v Google Maps →
                </a>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>
                📝
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary, #6b7280)", lineHeight: "1.5", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {event.description.slice(0, 300)}
              </div>
            </div>
          )}

          {/* Source badge */}
          {event.source === "gcal" && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center", padding: "10px 12px", background: "var(--bg-elevated, #f9fafb)", borderRadius: "10px", marginBottom: "20px" }}>
              <span style={{ fontSize: "14px" }}>📅</span>
              <span style={{ fontSize: "12px", color: "var(--text-muted, #9ca3af)", fontWeight: "500" }}>
                Synchronizované z Google Calendar
              </span>
            </div>
          )}

          {/* Quick link na obhliadkový list — ak event je obhliadka */}
          {obhliadkaId && (
            <a
              href={`/obhliadky/${obhliadkaId}`}
              style={{
                display: "block", padding: "12px 16px", background: "#EFF6FF",
                border: "1px solid #BFDBFE", borderRadius: "10px", marginBottom: "12px",
                fontSize: "13px", fontWeight: "600", color: "#1D4ED8",
                textAlign: "center", textDecoration: "none",
              }}
            >
              Otvoriť obhliadkový list →
            </a>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: "10px" }}>
            {event.source === "gcal" ? (
              <a
                href={`https://calendar.google.com/calendar/r/eventedit/${event.id}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  flex: 1, padding: "10px 16px", background: "#374151", color: "#fff",
                  border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "600",
                  cursor: "pointer", textAlign: "center", textDecoration: "none",
                }}
              >
                Upraviť v Google Calendar
              </a>
            ) : (
              <>
                <button onClick={() => { onDelete(event.id); onClose(); }} style={{
                  padding: "10px 16px", background: "#FEE2E2", color: "#DC2626",
                  border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
                }}>
                  Zmazať
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── New Event Modal ─── */
function NewEventModal({ initialDate, onClose, onSave }: {
  initialDate: string;
  onClose: () => void;
  onSave: (event: CalEvent) => void;
}) {
  const [summary, setSummary] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);

  function handleSave() {
    if (!summary.trim()) return;
    const start = allDay ? `${date}T00:00:00` : `${date}T${startTime}:00`;
    const end = allDay ? `${date}T23:59:59` : `${date}T${endTime}:00`;
    onSave({
      id: `local_${Date.now()}`,
      summary: summary.trim(),
      location: location.trim() || undefined,
      start, end, allDay,
      source: "local",
    });
    onClose();
  }

  const inputSt: React.CSSProperties = {
    width: "100%", padding: "10px 14px", border: "1px solid var(--border, #e5e7eb)",
    borderRadius: "10px", fontSize: "14px", color: "var(--text-primary, #111)",
    background: "var(--bg-elevated, #f9fafb)", outline: "none",
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: "relative", background: "var(--bg-surface, #fff)", borderRadius: "16px",
        width: "min(420px, 90vw)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", padding: "24px",
      }}>
        <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary, #111)", margin: "0 0 20px" }}>
          Nová udalosť
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <input value={summary} onChange={e => setSummary(e.target.value)} placeholder="Názov udalosti"
            style={inputSt} autoFocus />

          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Miesto (voliteľné)"
            style={inputSt} />

          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputSt} />

          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-secondary, #6b7280)" }}>
            <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
            Celý deň
          </label>

          {!allDay && (
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted, #9ca3af)", marginBottom: "4px", fontWeight: "600" }}>Od</div>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputSt} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted, #9ca3af)", marginBottom: "4px", fontWeight: "600" }}>Do</div>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputSt} />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px", background: "var(--bg-elevated, #f3f4f6)", color: "var(--text-secondary, #6b7280)",
            border: "1px solid var(--border, #e5e7eb)", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
          }}>Zrušiť</button>
          <button onClick={handleSave} style={{
            flex: 1, padding: "10px", background: "#374151", color: "#fff",
            border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
            opacity: summary.trim() ? 1 : 0.4,
          }}>Uložiť</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Time Column (shared) ─── */
function TimeColumn() {
  return (
    <div style={{ width: "52px", flexShrink: 0, position: "relative" }}>
      {HOURS.map(h => (
        <div key={h} style={{
          height: `${HOUR_HEIGHT}px`, position: "relative",
          display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
          paddingRight: "8px", paddingTop: "0px",
        }}>
          <span style={{ fontSize: "10px", color: "var(--text-muted, #9ca3af)", fontWeight: "500", transform: "translateY(-6px)" }}>
            {h.toString().padStart(2, "0")}:00
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Now Line ─── */
function NowLine({ dateStr }: { dateStr: string }) {
  const now = new Date();
  if (toDateStr(now) !== dateStr) return null;
  const mins = now.getHours() * 60 + now.getMinutes();
  const top = (mins / 60) * HOUR_HEIGHT;
  return (
    <div style={{ position: "absolute", top: `${top}px`, left: 0, right: 0, zIndex: 5, pointerEvents: "none" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#EF4444", flexShrink: 0 }} />
        <div style={{ flex: 1, height: "2px", background: "#EF4444" }} />
      </div>
    </div>
  );
}

/* ─── Day Column ─── */
function DayColumn({ date, events, onEventClick, onSlotClick }: {
  date: Date;
  events: CalEvent[];
  onEventClick: (e: CalEvent) => void;
  onSlotClick: (date: string, hour: number) => void;
}) {
  const dateStr = toDateStr(date);
  const dayEvents = events.filter(e => !e.allDay && eventDateStr(e.start) === dateStr)
    .sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div style={{ flex: 1, position: "relative", minWidth: 0, borderLeft: "1px solid var(--border, #e5e7eb)" }}>
      {/* Hour grid lines */}
      {HOURS.map(h => (
        <div key={h}
          onClick={() => onSlotClick(dateStr, h)}
          style={{
            height: `${HOUR_HEIGHT}px`, borderBottom: "1px solid var(--border, #e5e7eb)",
            cursor: "pointer", transition: "background 0.1s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.02)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        />
      ))}

      {/* Now line */}
      <NowLine dateStr={dateStr} />

      {/* Events */}
      {dayEvents.map(ev => {
        const top = (minutesSinceMidnight(ev.start) / 60) * HOUR_HEIGHT;
        const height = Math.max((durationMin(ev.start, ev.end) / 60) * HOUR_HEIGHT, 22);
        const color = ev.color || hashColor(ev.id);
        return (
          <div key={ev.id} onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
            style={{
              position: "absolute", top: `${top}px`, left: "4px", right: "4px",
              height: `${height}px`, minHeight: "22px",
              background: `${color}18`, borderLeft: `3px solid ${color}`,
              borderRadius: "6px", padding: "3px 6px", cursor: "pointer",
              overflow: "hidden", zIndex: 3, transition: "transform 0.1s, box-shadow 0.1s",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.01)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ fontSize: "11px", fontWeight: "700", color, lineHeight: "1.2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {fmtTime(ev.start)} {ev.summary}
            </div>
            {height > 36 && ev.location && (
              <div style={{ fontSize: "10px", color: "var(--text-muted, #9ca3af)", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                📍 {ev.location.split(",")[0]}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main Calendar Page ─── */
export default function KalendarPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("week");
  const [focusDate, setFocusDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [newEventDate, setNewEventDate] = useState<string | null>(null);
  const [newEventHour, setNewEventHour] = useState(9);
  // Mapa: calendar_event_id → obhliadka.id (pre rýchle prepojenie z eventu na obhliadkový list)
  const [obhliadkaIdByEvent, setObhliadkaIdByEvent] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const todayStr = toDateStr(new Date());

  useEffect(() => {
    fetchEvents(user?.id).then(evts => {
      setEvents(evts);
      setLoading(false);
    });
  }, [user?.id]);

  // Načítaj všetky obhliadky a postav mapu calendar_event_id → obhliadka.id
  useEffect(() => {
    fetch("/api/obhliadky").then(r => r.json()).then(d => {
      const map: Record<string, string> = {};
      for (const o of (d.obhliadky || []) as Array<Record<string, unknown>>) {
        const ceid = o.calendar_event_id;
        if (ceid && typeof ceid === "string" && o.id) map[ceid] = String(o.id);
      }
      setObhliadkaIdByEvent(map);
    }).catch(() => {});
  }, []);

  // Scroll to 7am on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
    }
  }, [view, loading]);

  // Get visible days based on view
  const getVisibleDays = useCallback((): Date[] => {
    if (view === "day") return [focusDate];
    if (view === "3day") {
      return Array.from({ length: 3 }, (_, i) => {
        const d = new Date(focusDate);
        d.setDate(d.getDate() + i);
        return d;
      });
    }
    // week
    const mon = getMonday(focusDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [view, focusDate]);

  const visibleDays = getVisibleDays();

  // All-day events for visible range
  const allDayEvents = events.filter(e => {
    if (!e.allDay) return false;
    return visibleDays.some(d => eventDateStr(e.start) === toDateStr(d));
  });

  // Navigation
  function navigate(dir: number) {
    const d = new Date(focusDate);
    if (view === "day") d.setDate(d.getDate() + dir);
    else if (view === "3day") d.setDate(d.getDate() + dir * 3);
    else d.setDate(d.getDate() + dir * 7);
    setFocusDate(d);
  }

  function goToday() {
    setFocusDate(new Date());
  }

  // Event CRUD
  function handleNewEvent(event: CalEvent) {
    const updated = [...events, event];
    setEvents(updated);
    // Save local events
    const locals = updated.filter(e => e.source === "local");
    localStorage.setItem("local_cal_events", JSON.stringify(locals));
  }

  function handleDeleteEvent(id: string) {
    const updated = events.filter(e => e.id !== id);
    setEvents(updated);
    const locals = updated.filter(e => e.source === "local");
    localStorage.setItem("local_cal_events", JSON.stringify(locals));
  }

  // Load local events on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("local_cal_events");
      if (raw) {
        const locals = JSON.parse(raw);
        setEvents(prev => [...prev, ...locals.filter((l: CalEvent) => !prev.find(p => p.id === l.id))]);
      }
    } catch { /* ignore */ }
  }, [loading]);

  // Header date range label
  function getHeaderLabel() {
    if (view === "day") return fmtDate(focusDate);
    const first = visibleDays[0];
    const last = visibleDays[visibleDays.length - 1];
    if (first.getMonth() === last.getMonth()) {
      return `${first.getDate()}. – ${last.getDate()}. ${first.toLocaleDateString("sk", { month: "long", year: "numeric" })}`;
    }
    return `${first.getDate()}. ${first.toLocaleDateString("sk", { month: "short" })} – ${last.getDate()}. ${last.toLocaleDateString("sk", { month: "short", year: "numeric" })}`;
  }

  const dayNamesShort = ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", minHeight: "500px" }}>

      {/* ── Top Bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 0 16px", flexWrap: "wrap", gap: "12px",
      }}>
        {/* Left: Nav + Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => navigate(-1)} style={{
            width: "32px", height: "32px", border: "1px solid var(--border, #e5e7eb)", borderRadius: "8px",
            background: "var(--bg-surface, #fff)", cursor: "pointer", fontSize: "14px",
            display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary, #6b7280)",
          }}>‹</button>
          <button onClick={() => navigate(1)} style={{
            width: "32px", height: "32px", border: "1px solid var(--border, #e5e7eb)", borderRadius: "8px",
            background: "var(--bg-surface, #fff)", cursor: "pointer", fontSize: "14px",
            display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary, #6b7280)",
          }}>›</button>
          <button onClick={goToday} style={{
            padding: "6px 14px", border: "1px solid var(--border, #e5e7eb)", borderRadius: "8px",
            background: "var(--bg-surface, #fff)", cursor: "pointer", fontSize: "12px", fontWeight: "600",
            color: "var(--text-primary, #111)",
          }}>Dnes</button>
          <h1 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary, #111)", margin: 0, whiteSpace: "nowrap" }}>
            {getHeaderLabel()}
          </h1>
        </div>

        {/* Right: View switcher + Add */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {(["day", "3day", "week"] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "600",
              cursor: "pointer", border: view === v ? "1px solid #374151" : "1px solid var(--border, #e5e7eb)",
              background: view === v ? "#374151" : "var(--bg-surface, #fff)",
              color: view === v ? "#fff" : "var(--text-secondary, #6b7280)",
              transition: "all 0.15s",
            }}>
              {v === "day" ? "Deň" : v === "3day" ? "3 dni" : "Týždeň"}
            </button>
          ))}
          <button onClick={() => { setNewEventDate(toDateStr(focusDate)); setNewEventHour(9); }} style={{
            padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "600",
            cursor: "pointer", border: "none", background: "#374151", color: "#fff",
            display: "flex", alignItems: "center", gap: "4px",
          }}>
            + Nová udalosť
          </button>
        </div>
      </div>

      {/* ── All-day events ── */}
      {allDayEvents.length > 0 && (
        <div style={{
          display: "flex", padding: "6px 0 6px 52px", gap: "4px", borderBottom: "1px solid var(--border, #e5e7eb)",
          flexWrap: "wrap", marginBottom: "4px",
        }}>
          {allDayEvents.map(e => (
            <div key={e.id} onClick={() => setSelectedEvent(e)} style={{
              padding: "4px 10px", background: `${hashColor(e.id)}18`, borderRadius: "6px",
              fontSize: "11px", fontWeight: "600", color: hashColor(e.id), cursor: "pointer",
            }}>
              {e.summary}
            </div>
          ))}
        </div>
      )}

      {/* ── Day Headers ── */}
      <div style={{ display: "flex", paddingLeft: "52px", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
        {visibleDays.map((d, i) => {
          const ds = toDateStr(d);
          const isToday = ds === todayStr;
          const dayIndex = (d.getDay() + 6) % 7; // Mon=0
          return (
            <div key={i} onClick={() => { setFocusDate(d); setView("day"); }}
              style={{
                flex: 1, textAlign: "center", padding: "8px 0", cursor: "pointer",
                borderLeft: i > 0 ? "1px solid var(--border, #e5e7eb)" : "none",
              }}>
              <div style={{ fontSize: "10px", fontWeight: "600", color: "var(--text-muted, #9ca3af)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {dayNamesShort[dayIndex]}
              </div>
              <div style={{
                width: "30px", height: "30px", borderRadius: "50%", margin: "4px auto 0",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "14px", fontWeight: isToday ? "800" : "500",
                background: isToday ? "#374151" : "transparent",
                color: isToday ? "#fff" : "var(--text-primary, #111)",
              }}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Scrollable Time Grid ── */}
      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted, #9ca3af)" }}>
          Načítavam kalendár...
        </div>
      ) : (
        <div ref={scrollRef} style={{ flex: 1, overflow: "auto", position: "relative" }}>
          <div style={{ display: "flex", minHeight: `${24 * HOUR_HEIGHT}px` }}>
            <TimeColumn />
            {visibleDays.map((d, i) => (
              <DayColumn
                key={toDateStr(d)}
                date={d}
                events={events}
                onEventClick={setSelectedEvent}
                onSlotClick={(dateStr, hour) => {
                  setNewEventDate(dateStr);
                  setNewEventHour(hour);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Upcoming sidebar for day view ── */}
      {view === "day" && (
        <div style={{
          borderTop: "1px solid var(--border, #e5e7eb)", padding: "12px 0",
          display: "flex", gap: "8px", overflowX: "auto",
        }}>
          {events
            .filter(e => eventDateStr(e.start) === toDateStr(focusDate) && !e.allDay)
            .sort((a, b) => a.start.localeCompare(b.start))
            .map(e => {
              const color = e.color || hashColor(e.id);
              const isPast = new Date(e.end) < new Date();
              return (
                <div key={e.id} onClick={() => setSelectedEvent(e)}
                  style={{
                    padding: "8px 12px", borderRadius: "10px", cursor: "pointer",
                    background: `${color}10`, borderLeft: `3px solid ${color}`,
                    minWidth: "140px", flexShrink: 0, opacity: isPast ? 0.5 : 1,
                  }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color }}>{fmtTime(e.start)} – {fmtTime(e.end)}</div>
                  <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary, #111)", marginTop: "2px" }}>{e.summary}</div>
                  {e.location && <div style={{ fontSize: "10px", color: "var(--text-muted, #9ca3af)", marginTop: "1px" }}>📍 {e.location.split(",")[0]}</div>}
                </div>
              );
            })}
        </div>
      )}

      {/* ── Modals ── */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={handleDeleteEvent}
          obhliadkaIdByEvent={obhliadkaIdByEvent}
        />
      )}
      {newEventDate && (
        <NewEventModal
          initialDate={newEventDate}
          onClose={() => setNewEventDate(null)}
          onSave={handleNewEvent}
        />
      )}
    </div>
  );
}
