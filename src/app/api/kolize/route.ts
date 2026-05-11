import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const stav = searchParams.get("stav");
    const zavaznost = searchParams.get("zavaznost");
    const sb = getSupabaseAdmin();
    let query = sb.from("kolizny_log").select("*").order("vytvorene", { ascending: false });
    if (stav) query = query.eq("stav", stav);
    if (zavaznost) query = query.eq("zavaznost", zavaznost);
    const { data, error } = await query;
    if (error) throw error;
    const stats = {
      celkom: data.length,
      nove: data.filter(k => k.stav === "nova").length,
      high: data.filter(k => k.zavaznost === "high").length,
      medium: data.filter(k => k.zavaznost === "medium").length,
      riesene: data.filter(k => k.stav === "riesena").length,
    };
    return NextResponse.json({ kolize: data, stats });
  } catch { return NextResponse.json({ error: "Chyba" }, { status: 500 }); }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  try {
    const { id, stav, poznamka } = await req.json();
    const { data, error } = await getSupabaseAdmin()
      .from("kolizny_log")
      .update({ stav, poznamka: poznamka || null, aktualizovane: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, kolizia: data });
  } catch { return NextResponse.json({ error: "Chyba" }, { status: 500 }); }
}
