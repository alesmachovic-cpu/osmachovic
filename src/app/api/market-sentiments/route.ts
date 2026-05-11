import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const kraj = req.nextUrl.searchParams.get("kraj");
  const typ = req.nextUrl.searchParams.get("typ");
  const limit = req.nextUrl.searchParams.get("limit");
  let query = sb.from("market_sentiments")
    .select("lokalita, typ, izby, active_count, median_eur_per_m2, median_dom, demand_index, price_change_30d_pct, sentiment_date")
    .order("sentiment_date", { ascending: false })
    .order("demand_index", { ascending: false });
  if (kraj) query = query.eq("kraj", kraj);
  if (typ) query = query.eq("typ", typ);
  if (limit) query = query.limit(Number(limit));
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
