import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getValidAccessToken } from "@/lib/google";

export const runtime = "nodejs";

/**
 * GET /api/obhliadky/auto-detect?userId=X
 *
 * Vráti zoznam Google Calendar eventov za posledných 30 dní + nasledujúcich 30,
 * ktoré:
 *  - NIE SÚ v DB ako obhliadka (cez calendar_event_id)
 *  - NEPATRIA medzi CRM-vygenerované eventy (napr. "Náber — ...", "Zavolať — ...")
 *
 * Maklér ich uvidí v karte klienta / dashboarde a vie ich rýchlo zaradiť ako
 * obhliadku. Filter je heuristický — môže byť vyladený neskôr.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const token = await getValidAccessToken(userId);
  if (!token) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  // Fetch eventy ±30 dní
  const now = Date.now();
  const timeMin = new Date(now - 30 * 24 * 3600 * 1000).toISOString();
  const timeMax = new Date(now + 30 * 24 * 3600 * 1000).toISOString();

  const calRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      new URLSearchParams({
        timeMin, timeMax,
        maxResults: "200",
        singleEvents: "true",
        orderBy: "startTime",
      }),
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!calRes.ok) return NextResponse.json({ error: "calendar_error" }, { status: 500 });
  const data = await calRes.json();
  const allEvents = (data.items || []) as Array<Record<string, unknown>>;

  // Načítaj všetky calendar_event_id ktoré už existujú v DB (obhliadky + náberáky)
  const sb = getSupabaseAdmin();
  const [obh, nab, klienti] = await Promise.all([
    sb.from("obhliadky").select("calendar_event_id"),
    sb.from("naberove_listy").select("calendar_event_id"),
    sb.from("klienti").select("calendar_event_id"),
  ]);
  const usedIds = new Set<string>();
  for (const t of [obh.data, nab.data, klienti.data]) {
    for (const r of t || []) {
      const cid = (r as Record<string, unknown>).calendar_event_id;
      if (cid) usedIds.add(String(cid));
    }
  }

  // Filter — heuristika
  const SKIP_PREFIX = ["Náber", "Naber", "Zavolať", "Zavolat", "Obhliadka — ", "Obhliadka -"];
  const candidates = allEvents
    .filter(e => {
      if (usedIds.has(String(e.id))) return false;
      const summary = String(e.summary || "");
      // Skip CRM-generated events (po prefix)
      if (SKIP_PREFIX.some(p => summary.startsWith(p))) return false;
      // Heuristika "potenciálna obhliadka": kľúčové slová alebo voľný event
      // (filter mierne — necháme aj generic eventy)
      return true;
    })
    .map(e => ({
      id: e.id,
      summary: e.summary || "(Bez názvu)",
      start: (e.start as Record<string, string>)?.dateTime || (e.start as Record<string, string>)?.date,
      end: (e.end as Record<string, string>)?.dateTime || (e.end as Record<string, string>)?.date,
      location: e.location || "",
      description: e.description || "",
      htmlLink: e.htmlLink,
    }));

  return NextResponse.json({ candidates });
}
