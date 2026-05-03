import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * GET /api/monitor/:id/snapshots
 * Vráti všetky denné snímky cien tohto inzerátu (zoradené chronologicky).
 * UI z toho urobí sparkline / line chart.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("monitor_inzeraty_snapshots")
    .select("snapshot_date, cena, eur_per_m2")
    .eq("inzerat_id", id)
    .order("snapshot_date", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ snapshots: data || [] });
}
