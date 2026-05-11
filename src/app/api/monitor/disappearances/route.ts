import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * GET /api/monitor/disappearances
 * Vráti posledných 20 detegovaných predajov (likely_sold, confidence >= 0.6).
 */
export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "20");
  const { data, error } = await sb
    .from("monitor_inzeraty_disappearances")
    .select("id, disappeared_on, estimated_sale_price, total_days_on_market, estimated_discount_pct, monitor_inzeraty(lokalita, typ, izby, nazov)")
    .eq("classification", "likely_sold")
    .gte("confidence_score", 0.6)
    .order("disappeared_on", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
