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
  let sentiments_updated = 0;
  try {
    sentiments_updated = await updateMarketSentiments(today);
  } catch (e) {
    console.error("[monitor-daily] sentiments phase failed:", e);
    stats.errors++;
  }

  // ── PHASE 4: Multi-portal deduplication (telefón match) ──
  let dedup_links = 0;
  try {
    dedup_links = await dedupPhoneMatch();
  } catch (e) {
    console.error("[monitor-daily] dedup phase failed:", e);
    stats.errors++;
  }

  // ── PHASE 5: Private/RK classifier (rule-based heuristika) ──
  let classifier_updated = 0;
  try {
    classifier_updated = await classifyPredajcaTyp();
  } catch (e) {
    console.error("[monitor-daily] classifier phase failed:", e);
    stats.errors++;
  }

  // ── PHASE 6: Motivation signals detection ────────────────
  let signals_detected = 0;
  try {
    signals_detected = await detectMotivationSignals(now);
  } catch (e) {
    console.error("[monitor-daily] signals phase failed:", e);
    stats.errors++;
  }

  const ms = Date.now() - t0;
  const result = { ...stats, sentiments_updated, dedup_links, classifier_updated, signals_detected, took_ms: ms };
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

/* ── PHASE 4 ─ Multi-portal deduplication (telefón Stage 1) ─────────────
 * Pre každý telefón ktorý sa objaví na ≥2 rôznych portáloch:
 *   - Vyber primárny inzerát (najstarší first_seen_at) — canonical
 *   - Ostatné inzeráty s rovnakým telefónom + podobnou plochou (±5%)
 *     označ canonical_id = primárny.id
 *   - Updatni listed_on_n_portals counter na primárnom
 */
async function dedupPhoneMatch(): Promise<number> {
  const sb = getSupabaseAdmin();
  const { data: rows } = await sb
    .from("monitor_inzeraty")
    .select("id, portal, predajca_telefon, plocha, first_seen_at, canonical_id")
    .eq("is_active", true)
    .not("predajca_telefon", "is", null);

  if (!rows || rows.length === 0) return 0;

  // Group by phone
  const byPhone = new Map<string, typeof rows>();
  for (const r of rows) {
    const phone = String(r.predajca_telefon).replace(/[\s().-]/g, "");
    if (phone.length < 7) continue;
    if (!byPhone.has(phone)) byPhone.set(phone, []);
    byPhone.get(phone)!.push(r);
  }

  let links = 0;
  for (const group of byPhone.values()) {
    const portals = new Set(group.map(r => r.portal));
    if (portals.size < 2) continue;  // iba 1 portál → žiadny dedup

    // Sort by first_seen_at — najstarší = canonical
    group.sort((a, b) => new Date(a.first_seen_at).getTime() - new Date(b.first_seen_at).getTime());
    const canonical = group[0];
    const canonicalPlocha = canonical.plocha ? Number(canonical.plocha) : null;

    for (let i = 1; i < group.length; i++) {
      const dup = group[i];
      // Filter podobnou plochou ±5% (ak obe majú plochu)
      if (canonicalPlocha && dup.plocha) {
        const ratio = Number(dup.plocha) / canonicalPlocha;
        if (ratio < 0.95 || ratio > 1.05) continue;
      }
      // Updatni len ak sa zmenil canonical_id (idempotent)
      if (dup.canonical_id !== canonical.id) {
        const { error } = await sb.from("monitor_inzeraty")
          .update({ canonical_id: canonical.id })
          .eq("id", dup.id);
        if (!error) links++;
      }
    }
    // Update counter na canonical
    await sb.from("monitor_inzeraty")
      .update({ listed_on_n_portals: portals.size })
      .eq("id", canonical.id);
  }

  return links;
}

/* ── PHASE 5 ─ Private/RK classifier (rule-based) ─────────────────────
 * Heuristiky z CLAUDE.md vrstva 2:
 *   - Telefón sa objavuje vo viacerých inzerátoch za 30 dní → RK
 *     (>=5 inzerátov = RK, 2-4 = unknown, 1 = súkromník)
 *   - Email domain v RK blacklist → RK
 *   - Bazos.sk + krátky popis bez RK keywords → súkromník
 *
 * Confidence + method sa logujú aby sme vedeli ako sme rozhodli.
 */
async function classifyPredajcaTyp(): Promise<number> {
  const sb = getSupabaseAdmin();

  // Spočítaj koľko inzerátov má každý telefón za posledných 30 dní
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await sb
    .from("monitor_inzeraty")
    .select("id, portal, predajca_telefon, predajca_typ, popis")
    .eq("is_active", true)
    .gte("first_seen_at", monthAgo);
  if (!rows) return 0;

  // Volume map per phone
  const phoneVolume = new Map<string, number>();
  for (const r of rows) {
    if (!r.predajca_telefon) continue;
    const p = String(r.predajca_telefon).replace(/[\s().-]/g, "");
    phoneVolume.set(p, (phoneVolume.get(p) || 0) + 1);
  }

  // RK keywords
  const rkKeywords = ["realitn", "kancelária", "exkluzívne", "provízia", "naša RK", "RK ", "MMr eality", "century 21", "remax"];
  const sukromKeywords = ["predávam", "ponúkam na predaj", "z osobných dôvodov", "súrne", "vlastník"];

  let updated = 0;
  for (const r of rows) {
    let typ: "sukromny" | "firma" | null = null;
    let confidence = 0;
    let method = "rule_default";

    // 1) Phone volume
    if (r.predajca_telefon) {
      const p = String(r.predajca_telefon).replace(/[\s().-]/g, "");
      const vol = phoneVolume.get(p) || 0;
      if (vol >= 5) { typ = "firma"; confidence = 0.85; method = "rule_phone_volume"; }
      else if (vol === 1) { typ = "sukromny"; confidence = 0.65; method = "rule_phone_volume"; }
    }

    // 2) Bazos baseline (vyšší prior pre súkromník)
    if (typ === null && r.portal === "bazos") {
      typ = "sukromny";
      confidence = 0.55;
      method = "rule_portal_baseline";
    }

    // 3) Keywords v popise (override ak match)
    const popis = (r.popis || "").toLowerCase();
    const rkHits = rkKeywords.filter(k => popis.includes(k.toLowerCase())).length;
    const sukHits = sukromKeywords.filter(k => popis.includes(k.toLowerCase())).length;
    if (rkHits >= 2) { typ = "firma"; confidence = Math.max(confidence, 0.80); method = "rule_keywords"; }
    else if (sukHits >= 1 && rkHits === 0) { typ = "sukromny"; confidence = Math.max(confidence, 0.70); method = "rule_keywords"; }

    if (typ === null) continue;

    // Update iba ak sa rozhodnutie zmení
    if (r.predajca_typ !== typ) {
      await sb.from("monitor_inzeraty")
        .update({
          predajca_typ: typ,
          predajca_typ_confidence: confidence,
          predajca_typ_method: method,
        })
        .eq("id", r.id);
      updated++;
    }
  }

  return updated;
}

/* ── PHASE 6 ─ Motivation signals (9 typov z CLAUDE.md) ───────────────
 *   PRICE_DROP_SMALL/MEDIUM/LARGE — pokles ceny od first_known_cena
 *   MULTIPLE_DROPS — ≥2 zníženia v snapshots za 90 dní
 *   LONG_ON_MARKET — ≥120 dní aktívna
 *   VERY_LONG_ON_MARKET — ≥240 dní aktívna
 *   RELISTED — bola disappeared a vrátila sa s nižšou cenou (po 14+ dňoch)
 *   MULTI_PORTAL_BURST — >=5 portálov v <=2 dňoch (z listed_on_n_portals)
 *
 * Plus motivation_score (0-100) na monitor_inzeraty (suma váh aktívnych signálov).
 */
async function detectMotivationSignals(now: Date): Promise<number> {
  const sb = getSupabaseAdmin();
  const { data: active } = await sb
    .from("monitor_inzeraty")
    .select("id, cena, first_known_cena, first_seen_at, last_seen_at, listed_on_n_portals")
    .eq("is_active", true)
    .not("cena", "is", null);
  if (!active) return 0;

  const SIGNAL_WEIGHTS: Record<string, number> = {
    PRICE_DROP_LARGE: 30, PRICE_DROP_MEDIUM: 15, PRICE_DROP_SMALL: 5,
    MULTIPLE_DROPS: 25,
    LONG_ON_MARKET: 10, VERY_LONG_ON_MARKET: 25,
    RELISTED: 30,
    MULTI_PORTAL_BURST: 15,
  };

  let detected = 0;
  for (const r of active) {
    const signals: Array<{ type: string; severity: "LOW" | "MEDIUM" | "HIGH"; evidence: Record<string, unknown> }> = [];

    const cena = Number(r.cena);
    const firstCena = r.first_known_cena ? Number(r.first_known_cena) : cena;
    const dom = Math.floor((now.getTime() - new Date(r.first_seen_at).getTime()) / (24 * 60 * 60 * 1000));

    // Price drops
    if (firstCena > cena) {
      const dropPct = ((firstCena - cena) / firstCena) * 100;
      if (dropPct >= 10) signals.push({ type: "PRICE_DROP_LARGE", severity: "HIGH", evidence: { from: firstCena, to: cena, pct: Math.round(dropPct * 10) / 10 } });
      else if (dropPct >= 5) signals.push({ type: "PRICE_DROP_MEDIUM", severity: "MEDIUM", evidence: { from: firstCena, to: cena, pct: Math.round(dropPct * 10) / 10 } });
      else if (dropPct >= 1) signals.push({ type: "PRICE_DROP_SMALL", severity: "LOW", evidence: { from: firstCena, to: cena, pct: Math.round(dropPct * 10) / 10 } });
    }

    // Multiple drops — count distinct cena hodnôt v snapshots za 90 dní
    const ninetyAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: snaps } = await sb
      .from("monitor_inzeraty_snapshots")
      .select("cena, snapshot_date")
      .eq("inzerat_id", r.id)
      .gte("snapshot_date", ninetyAgo)
      .order("snapshot_date", { ascending: true });
    if (snaps && snaps.length >= 3) {
      let drops = 0;
      let prev = Number(snaps[0].cena);
      for (let i = 1; i < snaps.length; i++) {
        const curr = Number(snaps[i].cena);
        if (curr < prev * 0.99) { drops++; prev = curr; }
      }
      if (drops >= 2) {
        signals.push({ type: "MULTIPLE_DROPS", severity: "HIGH", evidence: { drops_count: drops, period_days: 90 } });
      }
    }

    // Long on market
    if (dom >= 240) signals.push({ type: "VERY_LONG_ON_MARKET", severity: "HIGH", evidence: { days: dom } });
    else if (dom >= 120) signals.push({ type: "LONG_ON_MARKET", severity: "MEDIUM", evidence: { days: dom } });

    // Multi-portal burst
    const portals = Number(r.listed_on_n_portals) || 1;
    if (portals >= 5) {
      signals.push({ type: "MULTI_PORTAL_BURST", severity: "MEDIUM", evidence: { portals } });
    }

    // RELISTED — ak existuje záznam v disappearances pre tento inzerát
    // ale teraz je opäť aktívny + cena nižšia ako pred zmiznutím
    const { data: disap } = await sb
      .from("monitor_inzeraty_disappearances")
      .select("last_known_cena, disappeared_on")
      .eq("inzerat_id", r.id)
      .maybeSingle();
    if (disap && disap.last_known_cena && cena < Number(disap.last_known_cena)) {
      const daysAway = Math.floor((now.getTime() - new Date(disap.disappeared_on).getTime()) / (24 * 60 * 60 * 1000));
      if (daysAway >= 14) {
        signals.push({ type: "RELISTED", severity: "HIGH", evidence: { days_away: daysAway, prev_cena: Number(disap.last_known_cena), new_cena: cena } });
        // Zmaž disappearance záznam (inzerát sa vrátil)
        await sb.from("monitor_inzeraty_disappearances").delete().eq("inzerat_id", r.id);
      }
    }

    // UPSERT signály — pre každý typ buď pridáme alebo aktualizujeme evidence
    for (const s of signals) {
      const { error } = await sb.from("motivation_signals").upsert({
        inzerat_id: r.id,
        signal_type: s.type,
        severity: s.severity,
        evidence: s.evidence,
        is_active: true,
      }, { onConflict: "inzerat_id,signal_type", ignoreDuplicates: false });
      if (!error) detected++;
    }

    // Deactivate signals ktoré už nesúhlasia (napr. cena vyrástla → PRICE_DROP zruš)
    const activeTypes = new Set(signals.map(s => s.type));
    await sb.from("motivation_signals")
      .update({ is_active: false })
      .eq("inzerat_id", r.id)
      .eq("is_active", true)
      .not("signal_type", "in", `(${Array.from(activeTypes).map(t => `"${t}"`).join(",") || `""`})`);

    // Compute motivation score
    const score = signals.reduce((s, sig) => s + (SIGNAL_WEIGHTS[sig.type] || 0), 0);
    const cappedScore = Math.min(100, score);
    await sb.from("monitor_inzeraty")
      .update({ motivation_score: cappedScore })
      .eq("id", r.id);
  }

  return detected;
}
