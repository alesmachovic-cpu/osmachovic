import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/google";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const token = await getValidAccessToken(userId);
  if (!token) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  try {
    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        new URLSearchParams({
          timeMin,
          timeMax,
          maxResults: "100",
          singleEvents: "true",
          orderBy: "startTime",
        }),
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[calendar] error:", err);
      return NextResponse.json({ error: "calendar_error" }, { status: 500 });
    }

    const data = await res.json();
    const events = (data.items || []).map((e: Record<string, unknown>) => ({
      id: e.id,
      summary: e.summary || "(Bez názvu)",
      start: (e.start as Record<string, string>)?.dateTime || (e.start as Record<string, string>)?.date,
      end: (e.end as Record<string, string>)?.dateTime || (e.end as Record<string, string>)?.date,
      location: e.location || "",
      description: e.description || "",
      htmlLink: e.htmlLink,
    }));

    return NextResponse.json({ events });
  } catch (e) {
    console.error("[calendar]", e);
    return NextResponse.json({ error: "calendar_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId, summary, start, end, description, location } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const token = await getValidAccessToken(userId);
  if (!token) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  try {
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary,
          description: description || "",
          location: location || "",
          start: { dateTime: start, timeZone: "Europe/Bratislava" },
          end: { dateTime: end || new Date(new Date(start).getTime() + 3600000).toISOString(), timeZone: "Europe/Bratislava" },
          reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[calendar-create] error:", err);
      return NextResponse.json({ error: "create_failed" }, { status: 500 });
    }

    const event = await res.json();
    return NextResponse.json({ ok: true, event });
  } catch (e) {
    console.error("[calendar-create]", e);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
