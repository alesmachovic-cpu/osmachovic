"use client";

import { useState, useEffect } from "react";
import {
  DndContext, useDraggable, useDroppable, type DragEndEvent,
  PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";

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

export default function CalendarWidget({ userId }: { userId?: string }) {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    setSelectedDate(new Date().toISOString().slice(0, 10));
    const cached = parseCalEvents();
    if (cached.length > 0) setEvents(cached);

    function refresh() {
      fetchCalendarEvents(userId).then(fresh => {
        setEvents(fresh);
        setLoading(false);
      });
    }
    refresh();

    const interval = setInterval(refresh, 30000);
    function onVisibility() { if (document.visibilityState === "visible") refresh(); }
    document.addEventListener("visibilitychange", onVisibility);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisibility); };
  }, [userId]);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  const dayNamesByDow = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];

  function fmtTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString("sk", { hour: "2-digit", minute: "2-digit" });
  }

  function eventsForDay(date: Date) {
    const ds = date.toISOString().slice(0, 10);
    return events.filter(e => e.start.slice(0, 10) === ds);
  }

  const selectedDayEvents = events
    .filter(e => e.start.slice(0, 10) === selectedDate)
    .sort((a, b) => a.start.localeCompare(b.start));

  async function handleDragEnd(e: DragEndEvent) {
    if (!e.over || !userId) return;
    const overId = String(e.over.id);
    if (!overId.startsWith("day-")) return;
    const newDate = overId.slice(4);
    const dragged = (e.active.data.current as { event?: CalEvent } | undefined)?.event;
    if (!dragged || dragged.start.slice(0, 10) === newDate) return;

    const oldStart = new Date(dragged.start);
    const oldEnd = new Date(dragged.end);
    const diffMs =
      new Date(newDate + "T00:00:00").getTime() -
      new Date(dragged.start.slice(0, 10) + "T00:00:00").getTime();
    const newStart = new Date(oldStart.getTime() + diffMs).toISOString();
    const newEnd = new Date(oldEnd.getTime() + diffMs).toISOString();

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
      setEvents((prev) => prev.map((ev) => ev.id === dragged.id ? { ...ev, start: dragged.start, end: dragged.end } : ev));
      fetchCalendarEvents(userId).then(setEvents);
    }
  }

  // suppress unused variable warning
  void loading;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div>
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
                    {dayNamesByDow[d.getDay()]}
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
