import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * /api/cron/monitor-daily
 *
 * Spustí sa raz za deň o 09:00 (po /api/cron/scrape o 08:00).
 *
 * 2 fázy:
 * 1. SNAPSHOT — pre každý aktívny monitor inzerát uloží denný snímok ceny
 *    (UPSERT na inzerat_id+snapshot_date). Umožní zistiť ako sa cena
 *    konkrétneho inzerátu menila v čase.
 * 2. DETECT — nájde inzeráty čo zmizli z feedu 3+ dni (last_seen_at staršie
 *    ako threshold), klasifikuje ich (likely_sold / likely_withdrawn),
 *    odhadne realizačnú cenu pomocou empirického modelu (DOM → discount %),
 *    označí is_active=false a vloží do monitor_inzeraty_disappearances.
 *
 * Auth: rovnaký pattern ako /api/cron/scrape — Vercel cron Bearer token,
 * externý cron ?key=, alebo interný __internal__.
 */

const DISAPPEARANCE_THRESHOLD_DAYS = 3;

interface MonitorRow {
  id: string;
  cena: number | null;
  plocha: number | null;
  lokalita: string | null;
  typ: string | null;
  izby: number | null;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
  raw_data: Record<string, unknown> | null;
}

function eurPerM2(cena: number | null, plocha: number | null): number | null {
  if (!cena || !plocha || plocha <= 0) return null;
  return Math.round((Number(cena) / Number(plocha)) * 100) / 100;
}

function daysBetween(from: string, to: Date): number {
  const a = new Date(from).getTime();
  const b = to.getTime();
  return Math.max(0, Math.floor((b - a) / (24 * 60 * 60 * 1000)));
}

function classify(dom: number, firstPrice: number | null, lastPrice: number | null): string {
  // Krátky DOM + bez výrazných zmien = horúci predaj
  const priceDropped = firstPrice && lastPrice && lastPrice < firstPrice;
  if (dom < 60 && !priceDropped) return "likely_sold";
  // Dlhší DOM + cena klesla = motivovaný predajca našiel kupca
  if (dom >= 60 && priceDropped) return "likely_sold";
  // Veľmi dlhý DOM bez zmeny ceny = pravdepodobne stiahnutý
  if (dom > 180 && !priceDropped) return "likely_withdrawn";
  // Default — radšej likely_sold (skôr predal než stiahol)
  return "likely_sold";
}

function confidence(dom: number, classification: string, priceDropped: boolean): number {
  let c = 0.5;
  if (classification === "likely_sold") {
    if (dom < 30) c += 0.3;
    else if (dom < 90) c += 0.2;
    else if (dom < 180) c += 0.1;
    if (priceDropped) c += 0.15;
  }
  if (classification === "likely_withdrawn") {
    if (dom > 180) c += 0.2;
    if (dom > 365) c += 0.2;
  }
  return Math.min(1.0, Math.max(0.0, Math.round(c * 100) / 100));
}

function estimateSalePrice(lastPrice: number, dom: number): number {
  // Empirický discount podľa DOM (na slovenskom trhu typický gap medzi
  // poslednou ponukou a finálnou predajnou cenou):
  //   < 30 dní:  asking → 99%   (hot, často nad cenu)
  //   < 90 dní:  asking → 96.5% (normal)
  //   < 180 dní: asking → 93.5% (slow)
  //   ≥ 180:     asking → 90%   (very slow)
  const factor = dom < 30 ? 0.99 : dom < 90 ? 0.965 : dom < 180 ? 0.935 : 0.90;
  return Math.round(lastPrice * factor);
}

export async function GET(request: Request) {
  const t0 = Date.now();

  // Auth (rovnaký pattern ako /api/cron/scrape)
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const queryKey = searchParams.get("key");
  const cronSecret = process.env.CRON_SECRET;
  const isInternal = queryKey === "__internal__";
  if (cronSecret && !isInternal && authHeader !== `Bearer ${cronSecret}` && queryKey !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const threshold = new Date(now.getTime() - DISAPPEARANCE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const stats = {
    snapshots_inserted: 0,
    disappearances_created: 0,
    classified_sold: 0,
    classified_withdrawn: 0,
    errors: 0,
  };

  // ── PHASE 1: Snapshots ─────────────────────────────────────
  // Pre každý aktívny monitor inzerát s cenou uložíme denný snímok.
  // UPSERT na (inzerat_id, snapshot_date) takže opätovné spustenie
  // toho istého dňa žiadny duplicát nevytvorí.
  try {
    const { data: active, error } = await sb
      .from("monitor_inzeraty")
      .select("id, cena, plocha")
      .eq("is_active", true)
      .not("cena", "is", null);
    if (error) throw error;

    const rows = (active || [])
      .filter(r => r.cena && Number(r.cena) > 0)
      .map(r => ({
        inzerat_id: r.id,
        snapshot_date: today,
        cena: Number(r.cena),
        eur_per_m2: eurPerM2(Number(r.cena), r.plocha ? Number(r.plocha) : null),
        was_active: true,
      }));

    if (rows.length > 0) {
      const { error: upErr } = await sb
        .from("monitor_inzeraty_snapshots")
        .upsert(rows, { onConflict: "inzerat_id,snapshot_date", ignoreDuplicates: false });
      if (upErr) throw upErr;
      stats.snapshots_inserted = rows.length;
    }
  } catch (e) {
    console.error("[monitor-daily] snapshot phase failed:", e);
    stats.errors++;
  }

  // ── PHASE 2: Disappearance detection ───────────────────────
  // Nájdi aktívne inzeráty čo neboli last_seen aspoň DISAPPEARANCE_THRESHOLD_DAYS.
  // Pre každý: klasifikuj, odhadnuť cena, vlož do disappearances, označ is_active=false.
  try {
    const { data: candidates, error } = await sb
      .from("monitor_inzeraty")
      .select("id, cena, plocha, lokalita, typ, izby, first_seen_at, last_seen_at, is_active, raw_data")
      .eq("is_active", true)
      .lte("last_seen_at", threshold);
    if (error) throw error;

    // Vylúč tie ktoré už majú záznam (idempotentné)
    const ids = (candidates || []).map(c => c.id);
    let alreadyHave: Set<string> = new Set();
    if (ids.length > 0) {
      const { data: existing } = await sb
        .from("monitor_inzeraty_disappearances")
        .select("inzerat_id")
        .in("inzerat_id", ids);
      alreadyHave = new Set((existing || []).map(e => String(e.inzerat_id)));
    }

    for (const c of (candidates || []) as MonitorRow[]) {
      if (alreadyHave.has(c.id)) continue;
      try {
        const dom = daysBetween(c.first_seen_at, new Date(c.last_seen_at));
        const lastPrice = Number(c.cena) || 0;
        if (lastPrice <= 0) continue;

        // Pre detekciu zmeny ceny pozri prvý snapshot (ak existuje)
        const { data: firstSnap } = await sb
          .from("monitor_inzeraty_snapshots")
          .select("cena")
          .eq("inzerat_id", c.id)
          .order("snapshot_date", { ascending: true })
          .limit(1);
        const firstPrice = firstSnap?.[0]?.cena ? Number(firstSnap[0].cena) : lastPrice;
        const priceDropped = firstPrice > lastPrice;

        const classification = classify(dom, firstPrice, lastPrice);
        const conf = confidence(dom, classification, priceDropped);
        const estimatedSale = classification === "likely_sold" ? estimateSalePrice(lastPrice, dom) : null;
        const estimatedDiscount = estimatedSale && firstPrice > 0
          ? Math.round(((firstPrice - estimatedSale) / firstPrice) * 100 * 100) / 100
          : null;

        // disappeared_on = deň po last_seen_at
        const disappearedOn = new Date(new Date(c.last_seen_at).getTime() + 24 * 60 * 60 * 1000)
          .toISOString().slice(0, 10);

        const snapshot = {
          cena: lastPrice,
          plocha: c.plocha ? Number(c.plocha) : null,
          lokalita: c.lokalita,
          typ: c.typ,
          izby: c.izby,
          first_seen_at: c.first_seen_at,
          last_seen_at: c.last_seen_at,
          first_known_cena: firstPrice,
        };

        const { error: insErr } = await sb.from("monitor_inzeraty_disappearances").insert({
          inzerat_id: c.id,
          disappeared_on: disappearedOn,
          last_known_cena: lastPrice,
          last_known_eur_per_m2: eurPerM2(lastPrice, c.plocha ? Number(c.plocha) : null),
          total_days_on_market: dom,
          classification,
          confidence_score: conf,
          estimated_sale_price: estimatedSale,
          estimated_discount_pct: estimatedDiscount,
          snapshot,
        });
        if (insErr) {
          console.warn("[monitor-daily] disappearance insert failed:", insErr.message);
          stats.errors++;
          continue;
        }

        // Označ inzerát ako neaktívny
        await sb.from("monitor_inzeraty").update({ is_active: false }).eq("id", c.id);

        stats.disappearances_created++;
        if (classification === "likely_sold") stats.classified_sold++;
        else if (classification === "likely_withdrawn") stats.classified_withdrawn++;
      } catch (e) {
        console.error("[monitor-daily] failed to process candidate", c.id, e);
        stats.errors++;
      }
    }
  } catch (e) {
    console.error("[monitor-daily] disappearance phase failed:", e);
    stats.errors++;
  }

  // ── PHASE 3: Market sentiments per segment ───────────────
  // Pre každý segment (lokalita+typ+izby) s aspoň 3 aktívnymi inzerátmi
  // vypočítaj denný snímok trhu: median ceny, DOM, demand index.
  let sentiments_updated = 0;
  try {
    sentiments_updated = await updateMarketSentiments(today);
  } catch (e) {
    console.error("[monitor-daily] sentiments phase failed:", e);
    stats.errors++;
  }

  const ms = Date.now() - t0;
  const result = { ...stats, sentiments_updated, took_ms: ms };
  console.log("[monitor-daily] completed", result);
  return NextResponse.json({ ok: true, ...result });
}

/**
 * PHASE 3 — agreguj market sentiments per (lokalita, typ, izby).
 * UPSERT na (sentiment_date, lokalita, typ, izby) takže opätovné spustenie
 * v ten istý deň jednoducho prepíše.
 */
async function updateMarketSentiments(today: string): Promise<number> {
  const sb = getSupabaseAdmin();

  // Načítaj všetky aktívne inzeráty s validnými dátami
  const { data: active } = await sb
    .from("monitor_inzeraty")
    .select("id, lokalita, typ, izby, cena, plocha, first_seen_at")
    .eq("is_active", true)
    .not("cena", "is", null)
    .not("lokalita", "is", null)
    .not("typ", "is", null);

  if (!active || active.length === 0) return 0;

  // Today's new + disappeared count za jeden query (pre rýchlosť)
  const { data: todayNew } = await sb
    .from("monitor_inzeraty")
    .select("id, lokalita, typ, izby")
    .gte("first_seen_at", today)
    .not("lokalita", "is", null);
  const { data: todayDisap } = await sb
    .from("monitor_inzeraty_disappearances")
    .select("inzerat_id, monitor_inzeraty!inner(lokalita, typ, izby)")
    .eq("disappeared_on", today);

  // Group active inzeráty do segmentov
  type Segment = { lokalita: string; typ: string; izby: number | null; rows: typeof active };
  const segments = new Map<string, Segment>();
  for (const r of active) {
    const lok = String(r.lokalita).trim();
    if (!lok) continue;
    const typ = String(r.typ).trim();
    const izby = r.izby != null ? Number(r.izby) : null;
    const key = `${lok}|${typ}|${izby ?? ""}`;
    if (!segments.has(key)) segments.set(key, { lokalita: lok, typ, izby, rows: [] });
    segments.get(key)!.rows.push(r);
  }

  const today_d = new Date(today);
  let updated = 0;

  for (const seg of segments.values()) {
    if (seg.rows.length < 3) continue;  // málo dát pre validnú štatistiku

    // Pricing aggregates
    const prices = seg.rows.map(r => Number(r.cena)).filter(v => v > 0).sort((a, b) => a - b);
    const eurPerM2 = seg.rows
      .map(r => r.plocha && r.cena ? Number(r.cena) / Number(r.plocha) : 0)
      .filter(v => Number.isFinite(v) && v > 100 && v < 30000)
      .sort((a, b) => a - b);
    const doms = seg.rows
      .map(r => Math.floor((today_d.getTime() - new Date(r.first_seen_at).getTime()) / (24 * 60 * 60 * 1000)))
      .filter(v => v >= 0)
      .sort((a, b) => a - b);

    const med = (a: number[]) => {
      if (a.length === 0) return null;
      const m = Math.floor(a.length / 2);
      return a.length % 2 === 0 ? (a[m - 1] + a[m]) / 2 : a[m];
    };
    const median_cena = med(prices);
    const median_eur_per_m2 = med(eurPerM2);
    const median_dom = med(doms);
    const avg_dom = doms.length ? doms.reduce((s, x) => s + x, 0) / doms.length : null;

    // Counts
    const newCount = (todayNew || []).filter(n =>
      n.lokalita === seg.lokalita && n.typ === seg.typ && (n.izby ?? null) === seg.izby
    ).length;
    const disapCount = (todayDisap || []).filter(d => {
      const m = (d as { monitor_inzeraty?: { lokalita?: string; typ?: string; izby?: number | null } }).monitor_inzeraty;
      return m?.lokalita === seg.lokalita && m?.typ === seg.typ && (m?.izby ?? null) === seg.izby;
    }).length;

    // Trend vs sentiment z pred 30 dní
    const monthAgo = new Date(today_d.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: past } = await sb
      .from("market_sentiments")
      .select("median_eur_per_m2, active_count")
      .eq("sentiment_date", monthAgo)
      .eq("lokalita", seg.lokalita)
      .eq("typ", seg.typ)
      .is("izby", seg.izby)
      .maybeSingle();

    let priceChange30d: number | null = null;
    let supplyChange30d: number | null = null;
    if (past?.median_eur_per_m2 && median_eur_per_m2) {
      priceChange30d = Math.round(((median_eur_per_m2 - Number(past.median_eur_per_m2)) / Number(past.median_eur_per_m2)) * 100 * 10) / 10;
    }
    if (past?.active_count) {
      supplyChange30d = Math.round(((seg.rows.length - past.active_count) / Math.max(1, past.active_count)) * 100 * 10) / 10;
    }

    // Demand index 0-10 — ako horúci je tento segment
    let demand = 5;
    if (avg_dom != null) {
      if (avg_dom < 30) demand += 2;
      else if (avg_dom < 60) demand += 1;
      else if (avg_dom < 90) demand += 0;
      else if (avg_dom < 180) demand -= 1;
      else demand -= 2;
    }
    const ratio = newCount > 0 ? disapCount / newCount : (disapCount > 0 ? 2 : 0);
    if (ratio > 1.5) demand += 1.5;
    else if (ratio > 1.0) demand += 0.5;
    else if (ratio < 0.5 && newCount > 0) demand -= 1;
    if (priceChange30d != null) {
      if (priceChange30d > 3) demand += 1;
      else if (priceChange30d > 1) demand += 0.5;
      else if (priceChange30d < -2) demand -= 1;
    }
    demand = Math.max(0, Math.min(10, Math.round(demand * 10) / 10));

    const { error } = await sb.from("market_sentiments").upsert({
      sentiment_date: today,
      lokalita: seg.lokalita,
      typ: seg.typ,
      izby: seg.izby,
      active_count: seg.rows.length,
      new_count: newCount,
      disappeared_count: disapCount,
      median_cena,
      median_eur_per_m2: median_eur_per_m2 ? Math.round(median_eur_per_m2) : null,
      min_cena: prices[0] || null,
      max_cena: prices[prices.length - 1] || null,
      median_dom: median_dom != null ? Math.round(median_dom) : null,
      avg_dom: avg_dom != null ? Math.round(avg_dom * 10) / 10 : null,
      price_change_30d_pct: priceChange30d,
      supply_change_30d_pct: supplyChange30d,
      demand_index: demand,
    }, { onConflict: "sentiment_date,lokalita,typ,izby", ignoreDuplicates: false });

    if (!error) updated++;
    else console.warn("[monitor-daily] sentiment upsert failed:", error.message);
  }

  return updated;
}
