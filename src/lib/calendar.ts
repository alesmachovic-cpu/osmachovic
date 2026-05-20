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
 * Notifikácia o Google Calendar chybe.
 *
 * 🚨 UX FIX 2026-05-20 (Aleš nahlásil):
 *   Pôvodne táto funkcia volala `alert()` ktoré je blocking native dialog
 *   ošklivého vzhľadu a otravne preruší flow. Pri každom pridaní pripomienky
 *   bez Google connection sa zobrazil bodka.
 *
 *   Teraz: posiela CustomEvent ktorý odchytí globálny toast komponent
 *   (`<CalendarToast>` v root layout). Plus localStorage "viac nezobrazovať"
 *   prepínač — user vie potlačiť.
 */
const SUPPRESS_KEY = "calendar_toast_suppressed";

export function isCalendarToastSuppressed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SUPPRESS_KEY) === "1";
}

export function suppressCalendarToast(): void {
  if (typeof window !== "undefined") localStorage.setItem(SUPPRESS_KEY, "1");
}

export function notifyCalendarFail(result: CalendarResult, klientMeno?: string): void {
  if (result.ok) return;
  if (typeof window === "undefined") return;

  let kind: "not_connected" | "error" = "error";
  let message = "";

  if ("notConnected" in result && result.notConnected) {
    kind = "not_connected";
    message = klientMeno
      ? `Pripomienka pre ${klientMeno} bola uložená. Google Calendar event sa nevytvoril — pripoj Google v Nastaveniach.`
      : "Akcia uložená. Google Calendar event sa nevytvoril — pripoj Google v Nastaveniach.";
    // Ak user už "viac nezobrazovať" → silently skip
    if (isCalendarToastSuppressed()) return;
  } else if ("error" in result) {
    kind = "error";
    message = "Google Calendar chyba: " + result.error;
  }

  if (!message) return;

  // Pošli event ktorý odchytí <CalendarToast> komponent
  window.dispatchEvent(new CustomEvent("calendar:notify", {
    detail: { kind, message, klientMeno },
  }));
}
