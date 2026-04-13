import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/** GET /api/monitor — zoznam inzerátov + štatistiky */
export async function GET(request: Request) {
  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);

  const portal = searchParams.get("portal");
  const typ = searchParams.get("typ");
  const cenaOd = searchParams.get("cena_od");
  const cenaDo = searchParams.get("cena_do");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  let query = sb
    .from("monitor_inzeraty")
    .select("*", { count: "exact" })
    .eq("is_active", true)
    .order("first_seen_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (portal) query = query.eq("portal", portal);
  if (typ) query = query.eq("typ", typ);
  if (cenaOd) query = query.gte("cena", parseFloat(cenaOd));
  if (cenaDo) query = query.lte("cena", parseFloat(cenaDo));

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Štatistiky
  const { data: stats } = await sb.rpc("monitor_stats").single();

  return NextResponse.json({
    inzeraty: data || [],
    total: count || 0,
    stats: stats || null,
  });
}
