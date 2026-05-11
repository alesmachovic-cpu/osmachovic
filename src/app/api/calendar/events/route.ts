import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function getSupabase() {
  return getSupabaseAdmin();
}

// GET: Vráti cached eventy z Supabase logy tabuľky
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("logy")
      .select("metadata")
      .eq("typ", "gcal_cache")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.metadata?.events) {
      return NextResponse.json({ events: data.metadata.events, cached: true });
    }
  } catch { /* ignore */ }

  return NextResponse.json({ events: [], cached: false });
}

// POST: Uloží eventy do cache (volané z externého syncu alebo manuálne)
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { events } = await req.json();
    if (!Array.isArray(events)) {
      return NextResponse.json({ error: "events must be an array" }, { status: 400 });
    }

    await supabase.from("logy").insert({
      typ: "gcal_cache",
      popis: `📅 Google Calendar sync — ${events.length} eventov`,
      metadata: { events, synced_at: new Date().toISOString() },
    });

    return NextResponse.json({ ok: true, count: events.length });
  } catch {
    return NextResponse.json({ error: "Failed to cache events" }, { status: 500 });
  }
}
