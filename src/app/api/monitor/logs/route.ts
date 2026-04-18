import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * GET /api/monitor/logs
 * Vráti posledných 30 záznamov z monitor_scrape_log + breakdown inzerátov
 * podľa portálu a predajca_typ. Slúži na diagnostiku prečo scrape nevracia
 * očakávaný počet inzerátov.
 */
export async function GET() {
  const sb = getSupabaseAdmin();

  const { data: logs } = await sb
    .from("monitor_scrape_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: byPortal } = await sb
    .from("monitor_inzeraty")
    .select("portal, predajca_typ")
    .eq("is_active", true);

  const counts: Record<string, { total: number; firma: number; sukromny: number; unknown: number }> = {};
  for (const row of byPortal || []) {
    const p = row.portal as string;
    if (!counts[p]) counts[p] = { total: 0, firma: 0, sukromny: 0, unknown: 0 };
    counts[p].total++;
    if (row.predajca_typ === "firma") counts[p].firma++;
    else if (row.predajca_typ === "sukromny") counts[p].sukromny++;
    else counts[p].unknown++;
  }

  return NextResponse.json({
    logs: logs || [],
    inzeraty_breakdown: counts,
  });
}
