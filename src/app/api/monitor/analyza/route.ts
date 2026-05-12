import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * GET /api/monitor/analyza
 * Agregované trhové dáta pre stránku Analýzy — portal breakdown, typ breakdown,
 * motivovaní predajcovia (HIGH motivation signals), a stats predaných inzerátov.
 */
export async function GET() {
  try {
  const sb = getSupabaseAdmin();

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [
    activeRes,
    newWeekRes,
    motivatedRes,
    disappearanceRes,
  ] = await Promise.all([
    sb.from("monitor_inzeraty")
      .select("portal, typ, predajca_typ, cena, plocha, lokalita, izby")
      .eq("is_active", true),
    sb.from("monitor_inzeraty")
      .select("id")
      .eq("is_active", true)
      .gte("first_seen_at", weekAgo.toISOString()),
    sb.from("motivation_signals")
      .select("signal_type, severity, detected_at, evidence, monitor_inzeraty(id, nazov, lokalita, typ, izby, cena, plocha, url, first_seen_at, predajca_typ)")
      .eq("severity", "HIGH")
      .eq("is_active", true)
      .order("detected_at", { ascending: false })
      .limit(20),
    sb.from("monitor_inzeraty_disappearances")
      .select("total_days_on_market, estimated_discount_pct, estimated_sale_price")
      .eq("classification", "likely_sold")
      .gte("confidence_score", 0.6)
      .order("disappeared_on", { ascending: false })
      .limit(100),
  ]);

  if (activeRes.error) console.error("[analyza] allActive error:", activeRes.error.message);
  if (motivatedRes.error) console.error("[analyza] motivated error:", motivatedRes.error.message);
  if (disappearanceRes.error) console.error("[analyza] disappearances error:", disappearanceRes.error.message);

  const allActive = activeRes.data ?? [];
  const newThisWeekCount = (newWeekRes.data ?? []).length;
  const motivated = motivatedRes.data ?? [];
  const disappearanceStats = disappearanceRes.data ?? [];

  const active = allActive;

  // Breakdown podľa portálu
  const byPortal: Record<string, number> = {};
  for (const i of active) {
    const p = i.portal ?? "iný";
    byPortal[p] = (byPortal[p] ?? 0) + 1;
  }

  // Breakdown podľa typu
  const byTyp: Record<string, number> = {};
  for (const i of active) {
    const t = i.typ ?? "iný";
    byTyp[t] = (byTyp[t] ?? 0) + 1;
  }

  // Súkromní vs realitky
  const sukromni = active.filter(i => i.predajca_typ === "sukromny").length;
  const realitky = active.filter(i => i.predajca_typ === "realitka").length;
  const ostatni = active.length - sukromni - realitky;

  // Avg DOM a avg discount z predajov
  const disap = disappearanceStats ?? [];
  const avgDom = disap.length
    ? Math.round(disap.reduce((s, d) => s + (d.total_days_on_market ?? 0), 0) / disap.length)
    : null;
  const withDiscount = disap.filter(d => d.estimated_discount_pct != null);
  const avgDiscount = withDiscount.length
    ? Math.round((withDiscount.reduce((s, d) => s + Number(d.estimated_discount_pct), 0) / withDiscount.length) * 10) / 10
    : null;
  const avgSalePrice = disap.filter(d => d.estimated_sale_price).length
    ? Math.round(disap.filter(d => d.estimated_sale_price).reduce((s, d) => s + Number(d.estimated_sale_price), 0) / disap.filter(d => d.estimated_sale_price).length)
    : null;

  return NextResponse.json({
    total_active: active.length,
    new_this_week: newThisWeekCount,
    by_portal: byPortal,
    by_typ: byTyp,
    predajcovia: { sukromni, realitky, ostatni },
    motivated_sellers: motivated,
    sales_stats: { avg_dom: avgDom, avg_discount: avgDiscount, avg_sale_price: avgSalePrice, sample_size: disap.length },
  });
  } catch (err) {
    console.error("[analyza] fatal:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
