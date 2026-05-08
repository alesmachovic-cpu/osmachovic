import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/pricing/estimate
 * Body: {
 *   user_id?, klient_id?, nehnutelnost_id?,
 *   typ: 'byt'|'rodinny_dom'|'pozemok'|...,
 *   lokalita: string,                  // mesto / mestská časť
 *   plocha: number,                    // m²
 *   izby?: number,
 *   stav?: 'novostavba'|'po_rekonstrukcii'|'povodny_stav'|'na_rekonstrukciu',
 *   year_built?, year_reconstructed?,
 *   features?: { balkon, terasa, garaz, parking, vytah, ... },
 *   energy_class?: 'A0'|'A1'|...,
 *   owner_target_price?: number
 * }
 *
 * Vráti 3 stratégie + DOM predikciu + confidence interval + použité comparables.
 *
 * Logika:
 * 1. CMA — nájdi 5-15 podobných (active asking + sold realized z disappearances)
 * 2. Base price = realized median × plocha (preferované) alebo asking median × (1-gap)
 * 3. Adjustments — kondícia, vek, features, energy class
 * 4. Confidence — väčšia s počtom comparables
 * 5. Stratégie — aggressive (-3 až -5%), market, aspirational (+5 až +10% pri vysokej rarity)
 * 6. DOM predikcia — baseline z disappearances v segmente × deviation factor × quality × sentiment
 */

const STAV_ADJUST: Record<string, number> = {
  novostavba: 1.15,
  po_rekonstrukcii: 1.10,
  ciastocna_rekonstrukcia: 1.05,
  povodny_stav: 1.00,
  na_rekonstrukciu: 0.85,
};

const ENERGY_ADJUST: Record<string, number> = {
  A0: 1.06, A1: 1.06,
  A2: 1.03, B: 1.03,
  C: 1.00, D: 0.98,
  E: 0.92, F: 0.92, G: 0.92,
};

interface InputParams {
  user_id?: string;
  klient_id?: string;
  nehnutelnost_id?: string;
  typ: string;
  lokalita: string;
  plocha: number;
  izby?: number;
  stav?: string;
  year_built?: number;
  year_reconstructed?: number;
  features?: Record<string, boolean | string>;
  energy_class?: string;
  owner_target_price?: number;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function percentile(values: number[], p: number): number {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return 0;
  const i = Math.max(0, Math.min(s.length - 1, Math.round((p / 100) * (s.length - 1))));
  return s[i];
}

/**
 * Zaokrúhli na psychologické cenové pásmo:
 *  < 100k → 1k
 *  100k-500k → 5k
 *  500k-1M → 10k (vyhni sa 980k–1.02M dead zone)
 *  ≥ 1M → 25k
 */
function psychoBand(price: number): number {
  if (price < 100_000) return Math.round(price / 1000) * 1000;
  if (price < 500_000) return Math.round(price / 5000) * 5000;
  if (price < 1_000_000) {
    const r = Math.round(price / 10_000) * 10_000;
    if (r >= 980_000 && r < 1_000_000) return 980_000;
    if (r >= 1_000_000 && r < 1_020_000) return 1_020_000;
    return r;
  }
  return Math.round(price / 25_000) * 25_000;
}

interface CmaResult {
  active_count: number;
  sold_count: number;
  asking_median_per_m2: number;
  realized_median_per_m2: number;
  asking_p10_per_m2: number;
  asking_p90_per_m2: number;
  asking_to_realized_gap_pct: number | null;
  median_dom: number | null;
  rarity_score: number;
  active_samples: Array<{ lokalita: string; cena: number; plocha: number; izby: number | null; eur_per_m2: number }>;
  sold_samples: Array<{ lokalita: string; estimated_sale_price: number; total_days_on_market: number; estimated_discount_pct: number | null }>;
}

async function buildCMA(p: InputParams): Promise<CmaResult> {
  const sb = getSupabaseAdmin();
  const lokFilter = p.lokalita.split(" ")[0];

  // Active comparables (asking) — ±20% plocha
  const sizeMin = p.plocha * 0.8;
  const sizeMax = p.plocha * 1.2;

  let activeQ = sb
    .from("monitor_inzeraty")
    .select("lokalita, cena, plocha, izby")
    .eq("is_active", true)
    .ilike("lokalita", `%${lokFilter}%`)
    .ilike("typ", `%${p.typ}%`)
    .gte("plocha", sizeMin)
    .lte("plocha", sizeMax)
    .gt("cena", 0);
  if (p.izby != null) activeQ = activeQ.eq("izby", p.izby);
  const { data: active } = await activeQ.limit(50);

  const activeRows = (active || [])
    .map(r => ({
      lokalita: String(r.lokalita || ""),
      cena: Number(r.cena),
      plocha: Number(r.plocha),
      izby: r.izby != null ? Number(r.izby) : null,
      eur_per_m2: Number(r.cena) / Number(r.plocha),
    }))
    .filter(r => Number.isFinite(r.eur_per_m2) && r.eur_per_m2 > 100 && r.eur_per_m2 < 30000);

  // Sold comparables (realized) — z disappearances posledných 12 mesiacov
  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let soldQ = sb
    .from("monitor_inzeraty_disappearances")
    .select("estimated_sale_price, last_known_eur_per_m2, total_days_on_market, estimated_discount_pct, monitor_inzeraty!inner(lokalita, typ, plocha, izby)")
    .eq("classification", "likely_sold")
    .gte("confidence_score", 0.6)
    .gte("disappeared_on", yearAgo)
    .not("estimated_sale_price", "is", null)
    .ilike("monitor_inzeraty.lokalita", `%${lokFilter}%`)
    .ilike("monitor_inzeraty.typ", `%${p.typ}%`)
    .gte("monitor_inzeraty.plocha", sizeMin)
    .lte("monitor_inzeraty.plocha", sizeMax);
  if (p.izby != null) soldQ = soldQ.eq("monitor_inzeraty.izby", p.izby);
  const { data: sold } = await soldQ.limit(50);

  type SoldRow = { estimated_sale_price: number; last_known_eur_per_m2: number | null; total_days_on_market: number; estimated_discount_pct: number | null; monitor_inzeraty: { lokalita: string | null; typ: string | null; plocha: number | null; izby: number | null } };
  const soldRows = (sold || []) as unknown as SoldRow[];

  const askingPerM2 = activeRows.map(r => r.eur_per_m2);
  // Realized per m² — z asking × (1 - discount/100)
  const realizedPerM2 = soldRows
    .map(s => {
      const a = s.last_known_eur_per_m2 ? Number(s.last_known_eur_per_m2) : null;
      const d = s.estimated_discount_pct != null ? Number(s.estimated_discount_pct) : 0;
      if (!a || a < 100 || a > 30000) return 0;
      return a * (1 - d / 100);
    })
    .filter(v => v > 100 && v < 30000);
  const doms = soldRows.map(s => Number(s.total_days_on_market)).filter(v => v >= 0);

  const askingMed = askingPerM2.length ? median(askingPerM2) : 0;
  const realizedMed = realizedPerM2.length ? median(realizedPerM2) : 0;
  const gap = askingMed > 0 && realizedMed > 0
    ? Math.round(((askingMed - realizedMed) / askingMed) * 100 * 10) / 10
    : null;

  const totalCmps = activeRows.length + soldRows.length;
  const rarity = totalCmps <= 3 ? 9 : totalCmps <= 6 ? 7 : totalCmps <= 10 ? 5 : totalCmps <= 20 ? 3 : 1;

  return {
    active_count: activeRows.length,
    sold_count: soldRows.length,
    asking_median_per_m2: Math.round(askingMed),
    realized_median_per_m2: Math.round(realizedMed),
    asking_p10_per_m2: askingPerM2.length ? Math.round(percentile(askingPerM2, 10)) : 0,
    asking_p90_per_m2: askingPerM2.length ? Math.round(percentile(askingPerM2, 90)) : 0,
    asking_to_realized_gap_pct: gap,
    median_dom: doms.length ? Math.round(median(doms)) : null,
    rarity_score: rarity,
    active_samples: activeRows.slice(0, 5),
    sold_samples: soldRows.slice(0, 5).map(s => ({
      lokalita: s.monitor_inzeraty?.lokalita || "—",
      estimated_sale_price: Number(s.estimated_sale_price),
      total_days_on_market: Number(s.total_days_on_market),
      estimated_discount_pct: s.estimated_discount_pct != null ? Number(s.estimated_discount_pct) : null,
    })),
  };
}

function applyAdjustments(basePrice: number, p: InputParams): number {
  let mult = 1.0;

  if (p.stav && STAV_ADJUST[p.stav]) mult *= STAV_ADJUST[p.stav];
  if (p.energy_class && ENERGY_ADJUST[p.energy_class]) mult *= ENERGY_ADJUST[p.energy_class];

  if (p.year_built) {
    const age = new Date().getFullYear() - p.year_built;
    if (age > 50 && !p.year_reconstructed) mult *= 0.95;
    if (age < 5) mult *= 1.05;
  }

  const f = p.features || {};
  if (f.terasa) mult *= 1.04;
  if (f.zahrada) mult *= 1.06;
  if (f.garaz) mult *= 1.05;
  if (f.parking) mult *= 1.03;
  if (f.vytah) mult *= 1.02;

  return Math.round(basePrice * mult);
}

async function predictDOM(p: InputParams, askingPrice: number, cma: CmaResult): Promise<number> {
  // Baseline: median DOM zo zmiznutých inzerátov v segmente
  let baseline = cma.median_dom ?? 90;

  // Deviation from CMA — koľko je naša asking nad/pod median realized
  const askingPerM2 = askingPrice / p.plocha;
  const median_realized = cma.realized_median_per_m2 || cma.asking_median_per_m2;
  if (median_realized > 0) {
    const deviation = (askingPerM2 - median_realized) / median_realized;
    if (deviation > 0) baseline = baseline * (1 + deviation * 5);    // +1% nad → +5% DOM
    else baseline = Math.max(baseline * 0.5, baseline * (1 + deviation * 3));
  }

  // Quality (kondícia)
  if (p.stav) {
    const q = STAV_ADJUST[p.stav];
    if (q) baseline = baseline / q;  // lepšia kondícia → kratší DOM
  }

  // Sentiment z najnovších market_sentiments
  try {
    const sb = getSupabaseAdmin();
    const lokFilter = p.lokalita.split(" ")[0];
    let q = sb.from("market_sentiments")
      .select("demand_index")
      .ilike("lokalita", `%${lokFilter}%`)
      .ilike("typ", `%${p.typ}%`)
      .order("sentiment_date", { ascending: false })
      .limit(1);
    if (p.izby != null) q = q.eq("izby", p.izby);
    const { data } = await q;
    const demand = data?.[0]?.demand_index ? Number(data[0].demand_index) : 5;
    // demand 0-10: 5 = neutral. Každý bod ±10% DOM
    const sentimentFactor = 1.0 - ((demand - 5) * 0.10);
    baseline = baseline * Math.max(0.5, Math.min(1.5, sentimentFactor));
  } catch { /* fallback bez sentiment */ }

  return Math.max(7, Math.min(720, Math.round(baseline)));
}

function staticBenchmarkPerM2(lokalita: string): number {
  const m: Record<string, number> = {
    "Bratislava": 3300, "Trnava": 2400, "Nitra": 2100, "Trenčín": 1900,
    "Žilina": 2200, "Banská Bystrica": 1800, "Prešov": 1700, "Košice": 2000,
    "Stupava": 2600, "Senec": 2700, "Pezinok": 2500,
  };
  const lower = lokalita.toLowerCase();
  for (const [k, v] of Object.entries(m)) {
    if (lower.includes(k.toLowerCase())) return v;
  }
  return 2500;
}

export async function POST(req: NextRequest) {
  let body: InputParams;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  if (!body.typ || !body.lokalita || !body.plocha || body.plocha <= 0) {
    return NextResponse.json({ error: "Chýba povinný parameter (typ, lokalita, plocha)" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // 1) CMA
  const cma = await buildCMA(body);

  // 2) Base price — realized > asking-with-gap > static
  let basePerM2 = 0;
  let basePriceSource = "static";
  if (cma.realized_median_per_m2 > 0 && cma.sold_count >= 3) {
    basePerM2 = cma.realized_median_per_m2;
    basePriceSource = "realized";
  } else if (cma.asking_median_per_m2 > 0 && cma.active_count >= 3) {
    const gap = cma.asking_to_realized_gap_pct ?? 5;  // typický gap 5%
    basePerM2 = cma.asking_median_per_m2 * (1 - gap / 100);
    basePriceSource = "asking_corrected";
  } else {
    basePerM2 = staticBenchmarkPerM2(body.lokalita);
    basePriceSource = "static";
  }

  const basePrice = Math.round(basePerM2 * body.plocha);

  // 3) Adjustments (kondícia, features, vek, energy)
  const adjustedPrice = applyAdjustments(basePrice, body);

  // 4) Confidence interval (čím viac comparables, tým užší interval)
  const totalCmps = cma.active_count + cma.sold_count;
  const confidence = totalCmps >= 15 ? 0.92 : totalCmps >= 10 ? 0.85 : totalCmps >= 6 ? 0.75 : totalCmps >= 3 ? 0.60 : 0.40;
  const width = (1 - confidence) * 0.15;
  const priceLow = Math.round(adjustedPrice * (1 - width));
  const priceHigh = Math.round(adjustedPrice * (1 + width));

  // 5) 3 stratégie
  const aspirationalBoost = cma.rarity_score >= 7 ? 0.10 : 0.06;
  const aggressive = psychoBand(Math.round(adjustedPrice * 0.96));
  const market = psychoBand(adjustedPrice);
  const aspirational = psychoBand(Math.round(adjustedPrice * (1 + aspirationalBoost)));

  // 6) DOM predikcie per stratégia
  const [domAggr, domMkt, domAsp] = await Promise.all([
    predictDOM(body, aggressive, cma),
    predictDOM(body, market, cma),
    predictDOM(body, aspirational, cma),
  ]);

  // 7) Recommended strategy podľa rarity + dostupných dát
  const recommendedStrategy = cma.rarity_score >= 7
    ? "aspirational"
    : cma.rarity_score >= 4
      ? "market"
      : "aggressive";

  // 8) Persist log
  const result = {
    recommended_price: market,  // primárne odporúčanie = market price
    price_low: priceLow,
    price_high: priceHigh,
    confidence_score: confidence,
    base_price_source: basePriceSource,
    strategies: {
      aggressive: { price: aggressive, dom_days: domAggr, label: "Agresívna" },
      market: { price: market, dom_days: domMkt, label: "Trhová" },
      aspirational: { price: aspirational, dom_days: domAsp, label: "Aspirational" },
    },
    recommended_strategy: recommendedStrategy,
    rarity_score: cma.rarity_score,
    cma: {
      active_count: cma.active_count,
      sold_count: cma.sold_count,
      asking_median_per_m2: cma.asking_median_per_m2,
      realized_median_per_m2: cma.realized_median_per_m2,
      asking_to_realized_gap_pct: cma.asking_to_realized_gap_pct,
      median_dom: cma.median_dom,
      sold_samples: cma.sold_samples,
      active_samples: cma.active_samples,
    },
  };

  // Log do pricing_estimates (best-effort, nezasahuje response)
  try {
    await sb.from("pricing_estimates").insert({
      user_id: body.user_id || null,
      klient_id: body.klient_id || null,
      nehnutelnost_id: body.nehnutelnost_id || null,
      input_params: body,
      comparable_count: totalCmps,
      cma_summary: result.cma,
      recommended_price: market,
      price_low: priceLow,
      price_high: priceHigh,
      confidence_score: confidence,
      aggressive_price: aggressive,
      market_price: market,
      aspirational_price: aspirational,
      predicted_dom_aggressive: domAggr,
      predicted_dom_market: domMkt,
      predicted_dom_aspirational: domAsp,
      recommended_strategy: recommendedStrategy,
      rarity_score: cma.rarity_score,
      owner_target_price: body.owner_target_price ?? null,
    });
  } catch (e) {
    console.warn("[pricing-estimate] log insert failed:", (e as Error).message);
  }

  return NextResponse.json(result);
}
