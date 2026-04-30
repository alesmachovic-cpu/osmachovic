/**
 * Klientske helpery pre Google Calendar.
 *
 * Pôvodný kód mal po celej app `try { fetch(...) } catch { /* silent *\/ }`,
 * takže keď maklér nemal pripojený Google, akcia sa uložila len do CRM, ale
 * NIČ ho neupozornilo že kalendár chýba. Tento helper jasne signalizuje:
 *  - { ok: true, eventId } pri úspechu
 *  - { ok: false, notConnected: true } keď user nemá Google tokens — UI
 *    by malo zobraziť info "akcia uložená, ale pripoj Google v Nastaveniach"
 *  - { ok: false, error: string } pri inej chybe
 */

export type CalendarResult =
  | { ok: true; eventId: string }
  | { ok: false; notConnected: true }
  | { ok: false; error: string };

export async function createCalendarEvent(input: {
  userId: string;
  summary: string;
  start: string; // ISO
  end?: string;  // ISO; default = start + 1h
  description?: string;
  location?: string;
}): Promise<CalendarResult> {
  try {
    const res = await fetch("/api/google/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.status === 401) return { ok: false, notConnected: true };
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: txt.slice(0, 200) || `HTTP ${res.status}` };
    }
    const data = await res.json().catch(() => ({}));
    if (!data?.event?.id) return { ok: false, error: "Server vrátil neplatnú odpoveď" };
    return { ok: true, eventId: data.event.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sieťová chyba" };
  }
}

export async function patchCalendarEvent(input: {
  userId: string;
  eventId: string;
  summary?: string;
  start?: string;
  end?: string;
  description?: string;
  location?: string;
}): Promise<CalendarResult> {
  try {
    const res = await fetch("/api/google/calendar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.status === 401) return { ok: false, notConnected: true };
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: txt.slice(0, 200) || `HTTP ${res.status}` };
    }
    return { ok: true, eventId: input.eventId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sieťová chyba" };
  }
}

export async function deleteCalendarEvent(userId: string, eventId: string): Promise<CalendarResult> {
  try {
    const res = await fetch(`/api/google/calendar?userId=${encodeURIComponent(userId)}&eventId=${encodeURIComponent(eventId)}`, {
      method: "DELETE",
    });
    if (res.status === 401) return { ok: false, notConnected: true };
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: txt.slice(0, 200) || `HTTP ${res.status}` };
    }
    return { ok: true, eventId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sieťová chyba" };
  }
}

/**
 * Ak result.notConnected → ukáže alert a navigovať do nastavení.
 * Vráti true ak treba prerušiť ďalší flow (napr. silent ignore nie).
 */
export function notifyCalendarFail(result: CalendarResult, klientMeno?: string): void {
  if (result.ok) return;
  if ("notConnected" in result && result.notConnected) {
    const msg = klientMeno
      ? `Pripomienka pre ${klientMeno} bola uložená do CRM, ale neuložila sa do Google Calendar — pripoj Google účet v Nastaveniach.`
      : "Akcia uložená do CRM, ale neuložila sa do Google Calendar — pripoj Google účet v Nastaveniach.";
    if (typeof window !== "undefined") alert("⚠️ " + msg);
    return;
  }
  if ("error" in result && typeof window !== "undefined") {
    alert("Google Calendar chyba: " + result.error);
  }
}
