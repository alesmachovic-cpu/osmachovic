import { NextRequest, NextResponse } from "next/server";

/**
 * Google Calendar Sync API
 * Vytvorí udalosť v Google Kalendári pri dohodnutom nábere alebo "zavolať neskôr"
 *
 * Požaduje GOOGLE_CALENDAR_API_KEY a GOOGLE_CALENDAR_ID v .env
 * Alternatívne používa Google Calendar MCP ak je dostupný
 */
export async function POST(req: NextRequest) {
  const { title, datetime, description, telefon, location } = await req.json();

  if (!title || !datetime) {
    return NextResponse.json({ error: "Chýba názov alebo dátum" }, { status: 400 });
  }

  // Parsni dátum
  const startDate = new Date(datetime);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1 hodina

  // Google Calendar API cez service account alebo API key
  const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";
  const accessToken = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;

  if (!accessToken) {
    // Fallback — uložíme do logy tabuľky ako pending calendar event
    console.log("[calendar-sync] Žiadny Google token, ukladám ako pending event");

    // Import supabase dynamically to avoid client-side import
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );

    await supabase.from("logy").insert({
      typ: "calendar_pending",
      popis: `📅 ${title} — ${startDate.toLocaleString("sk")}`,
      metadata: {
        title,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        description,
        location: location || "",
        telefon,
        synced: false,
      },
    });

    return NextResponse.json({ ok: true, synced: false, message: "Udalosť uložená, čaká na sync s Google Kalendárom" });
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          summary: title,
          description: description || "",
          location: location || "",
          start: {
            dateTime: startDate.toISOString(),
            timeZone: "Europe/Bratislava",
          },
          end: {
            dateTime: endDate.toISOString(),
            timeZone: "Europe/Bratislava",
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: "popup", minutes: 30 },
              { method: "popup", minutes: 60 },
            ],
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[calendar-sync] Google Calendar chyba:", err);
      return NextResponse.json({ ok: false, error: "Google Calendar sync zlyhal" }, { status: 500 });
    }

    const event = await res.json();
    console.log(`[calendar-sync] Udalosť vytvorená: ${event.htmlLink}`);
    return NextResponse.json({ ok: true, synced: true, eventLink: event.htmlLink });
  } catch (e) {
    console.error("[calendar-sync] Chyba:", e);
    return NextResponse.json({ ok: false, error: "Sync zlyhal" }, { status: 500 });
  }
}
