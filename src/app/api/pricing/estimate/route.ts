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

/**
 * Normalizuj surový stav (z user inputu aj z monitor_inzeraty) na kanonický
 * kľúč v STAV_ADJUST. Odstráni diakritiku, zjednotí medzery a namapuje bežné
 * synonymá. Vráti undefined, ak stav nevieme zaradiť (→ žiadna korekcia).
 */
function normStavKey(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const k = String(raw)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // strip diakritiku
    .replace(/\s+/g, "_")
    .trim();

  const alias: Record<string, string> = {
    novostavba: "novostavba",
    po_rekonstrukcii: "po_rekonstrukcii",
    kompletna_rekonstrukcia: "po_rekonstrukcii",
    plna_rekonstrukcia: "po_rekonstrukcii",
    ciastocna_rekonstrukcia: "ciastocna_rekonstrukcia",
    povodny_stav: "povodny_stav",
    originalny_stav: "povodny_stav",
    vyborny_stav: "po_rekonstrukcii",
    dobry_stav: "povodny_stav",
    zachovaly_stav: "povodny_stav",
    na_rekonstrukciu: "na_rekonstrukciu",
  };

  return alias[k] ?? (STAV_ADJUST[k] ? k : undefined);
}

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
 * Q3 — MAD (Median Absolute Deviation) outlier filter, Iglewicz-Hoaglin
 * modifikovaný z-score. Robustný pri malej vzorke. Odstráni 1 mispriced inzerát
 * (preklep v cene, "cena dohodou 1 €", garsónka v zlej kategórii), ktorý by inak
 * posunul medián base ceny.
 *  - n < 4: nefiltruj (nevieš rozlíšiť outlier od signálu; medián aj tak drží).
 *  - MAD = 0 (>50 % identických hodnôt): nemáme škálu → nefiltruj.
 *  - bimodálna vzorka (dva zhluky): MAD nič neodstráni — správne, lebo nevieš,
 *    ktorý zhluk je "pravda".
 */
function filterOutliersMAD<T>(items: T[], getVal: (t: T) => number, threshold = 3.5): T[] {
  if (items.length < 4) return items;
  const vals = items.map(getVal);
  const med = median(vals);
  const mad = median(vals.map(v => Math.abs(v - med)));
  if (mad === 0) return items;
  return items.filter(it => Math.abs((0.6745 * (getVal(it) - med)) / mad) <= threshold);
}

/**
 * Q4 — vážený (lower) medián pre time-decay váženie comparables.
 * Novší inzerát má vyššiu váhu (relevantnejšia cena).
 */
function weightedMedian(items: Array<{ value: number; weight: number }>): number {
  const sorted = items.filter(i => i.weight > 0).sort((a, b) => a.value - b.value);
  if (!sorted.length) return 0;
  const total = sorted.reduce((s, i) => s + i.weight, 0);
  if (total <= 0) return median(sorted.map(i => i.value));
  let acc = 0;
  for (const it of sorted) {
    acc += it.weight;
    if (acc >= total / 2) return it.value;
  }
  return sorted[sorted.length - 1].value;
}

/**
 * Q4 — time-decay váha podľa veku dátumu. Exponenciálny rozpad, half-life 90 dní:
 * kalibrované na dnešné ~7-týždňové dátové okno (efekt mierny), správne škáluje,
 * keď cron ožije a dáta pôjdu cez viac mesiacov (staré asking dostanú menšiu váhu).
 * Neznámy dátum → mierne znížená váha; budúci/dnešný → plná.
 */
const DECAY_HALF_LIFE_DAYS = 90;
function timeDecayWeight(dateStr: string | null | undefined): number {
  if (!dateStr) return 0.6;
  const t = new Date(dateStr).getTime();
  if (!Number.isFinite(t)) return 0.6;
  const ageDays = (Date.now() - t) / 86_400_000;
  if (ageDays <= 0) return 1;
  return Math.pow(0.5, ageDays / DECAY_HALF_LIFE_DAYS);
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
  realized_count: number;          // počet realized cien, čo reálne tvoria median (≤ sold_count)
  asking_median_per_m2: number;
  realized_median_per_m2: number;
  asking_p10_per_m2: number;
  asking_p90_per_m2: number;
  asking_to_realized_gap_pct: number | null;
  median_dom: number | null;
  rarity_score: number;
  lok_level: "exact" | "city";
  match_level: "exact" | "city" | "city_wide" | "city_any_rooms";  // Q5 — ako veľmi sa uvoľnili filtre
  relaxed: boolean;                // Q5/Q6 — vzorka z uvoľnených filtrov → nižšia istota
  active_samples: Array<{ lokalita: string; cena: number; plocha: number; izby: number | null; eur_per_m2: number }>;
  sold_samples: Array<{ lokalita: string; estimated_sale_price: number; total_days_on_market: number; estimated_discount_pct: number | null }>;
}

/**
 * Rozparsuj surovú lokalitu na LIKE filtre tak, aby sa nemiešali mestá.
 * Príklady vstupu: "Reality Bratislava - Ružinov 82105", "Nitra, Klokočina", "Trnava".
 *  - strip "reality " prefix
 *  - odstráň PSČ / koncové čísla
 *  - zjednoť "," → "-"
 *  - mesto = časť pred prvou pomlčkou; exact = celý reťazec ak má mestskú časť
 * Vracia LIKE patterny (už zabalené v "%…%"), aby volajúci nemusel nič wrapovať.
 *  - cityName: holé meno mesta (bez %)
 *  - city: "%mesto%"
 *  - exact: "%mesto-mestská_časť%" ak existuje MČ, inak === city
 */
function buildLokalitaFilters(raw: string): { exact: string; city: string; cityName: string } {
  const cleaned = String(raw || "")
    .replace(/^reality\s+/i, "")        // "Reality Bratislava" → "Bratislava"
    .replace(/[,]/g, "-")               // "Nitra, Klokočina" → "Nitra- Klokočina"
    .replace(/\b\d{3}\s?\d{2}\b/g, "")  // PSČ "821 05" / "82105"
    .replace(/\s+\d+\s*$/g, "")         // koncové číslo
    .replace(/\s*-\s*/g, "-")           // normalizuj okolie pomlčiek
    .replace(/\s+/g, " ")
    .trim();

  const cityName = (cleaned.split("-")[0] || cleaned).trim();
  const city = `%${cityName}%`;
  const hasMC = cleaned.includes("-") && cleaned !== cityName;
  const exact = hasMC ? `%${cleaned}%` : city;
  return { exact, city, cityName };
}

async function buildCMA(p: InputParams): Promise<CmaResult> {
  const sb = getSupabaseAdmin();
  const lok = buildLokalitaFilters(p.lokalita);

  // Active comparables (asking) — ±20% plocha
  const sizeMin = p.plocha * 0.8;
  const sizeMax = p.plocha * 1.2;

  // Wider plocha pre relax kaskádu (Q5). €/m² normalizuje rozdiel veľkosti,
  // takže väčší/menší byt zostáva porovnateľný cez €/m².
  const wideMin = p.plocha * 0.65;
  const wideMax = p.plocha * 1.35;

  async function runActive(lokLike: string, sMin: number, sMax: number, useRooms: boolean) {
    let activeQ = sb
      .from("monitor_inzeraty")
      .select("lokalita, cena, plocha, izby, stav, first_seen_at")
      .eq("is_active", true)
      .ilike("lokalita", lokLike)
      .ilike("typ", `%${p.typ}%`)
      .gte("plocha", sMin)
      .lte("plocha", sMax)
      .gt("cena", 0);
    if (useRooms && p.izby != null) activeQ = activeQ.eq("izby", p.izby);
    const { data } = await activeQ.limit(50);
    return data || [];
  }

  // Q5 — postupné uvoľňovanie filtrov namiesto skoku na statický fallback:
  // presná lokalita+izby+±20 % → mesto → širšia plocha (±35 %) → bez izieb.
  // Geografický "okres" zámerne vynechaný: nemáme číselník okresov a hrozí
  // miešanie cenových hladín (BA vs Senec/Pezinok); per-mesto static benchmark
  // je bezpečnejšia posledná kotva. Každý relax krok zníži istotu (Q6 interval).
  const MIN_SAMPLE = 4;
  let matchLevel: CmaResult["match_level"] = "exact";
  let active = await runActive(lok.exact, sizeMin, sizeMax, true);
  if (active.length < MIN_SAMPLE && lok.exact !== lok.city) {
    active = await runActive(lok.city, sizeMin, sizeMax, true);
    matchLevel = "city";
  }
  if (active.length < MIN_SAMPLE) {
    active = await runActive(lok.city, wideMin, wideMax, true);
    matchLevel = "city_wide";
  }
  if (active.length < MIN_SAMPLE && p.izby != null) {
    active = await runActive(lok.city, wideMin, wideMax, false);
    matchLevel = "city_any_rooms";
  }
  const lokLevel: "exact" | "city" = matchLevel === "exact" ? "exact" : "city";
  const relaxed = matchLevel === "city_wide" || matchLevel === "city_any_rooms";

  // Stav korekcia: každý comparable preveď na kondíciu cieľovej nehnuteľnosti,
  // aby sa neporovnával novostavba s pôvodným stavom. rawEur × (target/comp).
  const targetStavKey = normStavKey(p.stav);
  const targetStavMult = targetStavKey ? STAV_ADJUST[targetStavKey] : undefined;

  const activeRowsRaw = active
    .map(r => {
      const rawEur = Number(r.cena) / Number(r.plocha);
      const compKey = normStavKey(r.stav as string | undefined | null);
      const compMult = compKey ? STAV_ADJUST[compKey] : undefined;
      const eur_per_m2 = (targetStavMult && compMult) ? rawEur * (targetStavMult / compMult) : rawEur;
      return {
        lokalita: String(r.lokalita || ""),
        cena: Number(r.cena),
        plocha: Number(r.plocha),
        izby: r.izby != null ? Number(r.izby) : null,
        eur_per_m2,
        first_seen_at: (r.first_seen_at as string | null) ?? null,
      };
    })
    .filter(r => Number.isFinite(r.eur_per_m2) && r.eur_per_m2 > 100 && r.eur_per_m2 < 30000);

  // Q3 — odstráň cenové outliery (MAD) pred mediánom.
  const activeRows = filterOutliersMAD(activeRowsRaw, r => r.eur_per_m2);

  // Sold comparables (realized) — z disappearances posledných 12 mesiacov
  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let soldQ = sb
    .from("monitor_inzeraty_disappearances")
    .select("estimated_sale_price, last_known_eur_per_m2, total_days_on_market, estimated_discount_pct, disappeared_on, monitor_inzeraty!inner(lokalita, typ, plocha, izby)")
    .eq("classification", "likely_sold")
    .gte("confidence_score", 0.6)
    .gte("disappeared_on", yearAgo)
    .not("estimated_sale_price", "is", null)
    .ilike("monitor_inzeraty.lokalita", lok.city)
    .ilike("monitor_inzeraty.typ", `%${p.typ}%`)
    .gte("monitor_inzeraty.plocha", sizeMin)
    .lte("monitor_inzeraty.plocha", sizeMax);
  if (p.izby != null) soldQ = soldQ.eq("monitor_inzeraty.izby", p.izby);
  const { data: sold } = await soldQ.limit(50);

  type SoldRow = { estimated_sale_price: number; last_known_eur_per_m2: number | null; total_days_on_market: number; estimated_discount_pct: number | null; disappeared_on: string | null; monitor_inzeraty: { lokalita: string | null; typ: string | null; plocha: number | null; izby: number | null } };
  const soldRows = (sold || []) as unknown as SoldRow[];

  // Q4 — asking comparables s time-decay váhou (novší inzerát = vyššia váha).
  const askingWeighted = activeRows.map(r => ({ value: r.eur_per_m2, weight: timeDecayWeight(r.first_seen_at) }));
  const askingPerM2 = activeRows.map(r => r.eur_per_m2);  // nevážené — pre percentily

  // Realized per m² — z asking × (1 - discount/100); váha podľa dátumu predaja.
  const realizedWeightedRaw = soldRows
    .map(s => {
      const a = s.last_known_eur_per_m2 ? Number(s.last_known_eur_per_m2) : null;
      const d = s.estimated_discount_pct != null ? Number(s.estimated_discount_pct) : 0;
      if (!a || a < 100 || a > 30000) return null;
      return { value: a * (1 - d / 100), weight: timeDecayWeight(s.disappeared_on) };
    })
    .filter((x): x is { value: number; weight: number } => x != null && x.value > 100 && x.value < 30000);
  // Q3 — outlier filter aj na realized cenách.
  const realizedWeighted = filterOutliersMAD(realizedWeightedRaw, x => x.value);
  const doms = soldRows.map(s => Number(s.total_days_on_market)).filter(v => v >= 0);

  // Q3+Q4 — vážený medián z očistených hodnôt.
  const askingMed = askingWeighted.length ? weightedMedian(askingWeighted) : 0;
  const realizedMed = realizedWeighted.length ? weightedMedian(realizedWeighted) : 0;
  const gap = askingMed > 0 && realizedMed > 0
    ? Math.round(((askingMed - realizedMed) / askingMed) * 100 * 10) / 10
    : null;

  const realizedCount = realizedWeighted.length;
  // rarity_score = miera RIEDKOSTI dát (málo cenových bodov), NIE trhová vzácnosť.
  // Q6: už neriadi cenu nahor — len signalizuje neistotu (širší interval).
  const totalCmps = activeRows.length + realizedCount;
  const rarity = totalCmps <= 3 ? 9 : totalCmps <= 6 ? 7 : totalCmps <= 10 ? 5 : totalCmps <= 20 ? 3 : 1;

  return {
    active_count: activeRows.length,
    sold_count: soldRows.length,
    realized_count: realizedCount,
    asking_median_per_m2: Math.round(askingMed),
    realized_median_per_m2: Math.round(realizedMed),
    asking_p10_per_m2: askingPerM2.length ? Math.round(percentile(askingPerM2, 10)) : 0,
    asking_p90_per_m2: askingPerM2.length ? Math.round(percentile(askingPerM2, 90)) : 0,
    asking_to_realized_gap_pct: gap,
    median_dom: doms.length ? Math.round(median(doms)) : null,
    rarity_score: rarity,
    lok_level: lokLevel,
    match_level: matchLevel,
    relaxed,
    active_samples: activeRows.slice(0, 5).map(r => ({
      lokalita: r.lokalita, cena: r.cena, plocha: r.plocha, izby: r.izby, eur_per_m2: r.eur_per_m2,
    })),
    sold_samples: soldRows.slice(0, 5).map(s => ({
      lokalita: s.monitor_inzeraty?.lokalita || "—",
      estimated_sale_price: Number(s.estimated_sale_price),
      total_days_on_market: Number(s.total_days_on_market),
      estimated_discount_pct: s.estimated_discount_pct != null ? Number(s.estimated_discount_pct) : null,
    })),
  };
}

function applyAdjustments(basePrice: number, p: InputParams, applyStavHere: boolean): number {
  let mult = 1.0;

  // ANTI-DOUBLE-COUNT: stav aplikuj LEN keď CMA korekcia neprebehla (static
  // fallback). Keď máme comparables, stav je už zarátaný v buildCMA.
  if (applyStavHere) {
    const stavKey = normStavKey(p.stav);
    if (stavKey && STAV_ADJUST[stavKey]) mult *= STAV_ADJUST[stavKey];
  }
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
  const stavKey = normStavKey(p.stav);
  if (stavKey) {
    const q = STAV_ADJUST[stavKey];
    if (q) baseline = baseline / q;  // lepšia kondícia → kratší DOM
  }

  // Sentiment z najnovších market_sentiments
  try {
    const sb = getSupabaseAdmin();
    const { city: lokFilter } = buildLokalitaFilters(p.lokalita);
    let q = sb.from("market_sentiments")
      .select("demand_index")
      .ilike("lokalita", lokFilter)
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
  if (cma.realized_median_per_m2 > 0 && cma.realized_count >= 3) {
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
  // Stav aplikuj v applyAdjustments LEN pri static fallbacku; pri CMA dátach
  // je už zarátaný v buildCMA (anti-double-count).
  const adjustedPrice = applyAdjustments(basePrice, body, basePriceSource === "static");

  // 4) Confidence interval (viac comparables → užší; uvoľnená vzorka → širší)
  const totalCmps = cma.active_count + cma.realized_count;
  let confidence = totalCmps >= 15 ? 0.92 : totalCmps >= 10 ? 0.85 : totalCmps >= 6 ? 0.75 : totalCmps >= 3 ? 0.60 : 0.40;
  if (cma.relaxed) confidence = Math.max(0.40, confidence - 0.15);  // Q5/Q6 — uvoľnené filtre = menšia istota
  const width = (1 - confidence) * 0.15;
  const priceLow = Math.round(adjustedPrice * (1 - width));
  const priceHigh = Math.round(adjustedPrice * (1 + width));

  // 5) Dopytový signál (Q6) — z REÁLNYCH dát (DOM + asking-realized gap), NIE
  // z počtu comparables. Málo dát = neistota (širší interval vyššie), nie dôvod
  // pýtať viac. Aspiračnú cenu povolíme len pri dosť dátach + reálnom dopyte.
  const enoughData = totalCmps >= 6;
  let demandLevel: "high" | "normal" | "low" | "unknown" = "unknown";
  if (cma.realized_count >= 3 && cma.median_dom != null) {
    const gapPct = cma.asking_to_realized_gap_pct ?? 0;
    if (cma.median_dom <= 45 && gapPct <= 4) demandLevel = "high";
    else if (cma.median_dom > 120 || gapPct > 8) demandLevel = "low";
    else demandLevel = "normal";
  }

  // 6) 3 stratégie — aspiračný boost len pri dosť dátach + silnom dopyte
  const aspirationalBoost = (enoughData && demandLevel === "high") ? 0.08 : 0.04;
  const aggressive = psychoBand(Math.round(adjustedPrice * 0.96));
  const market = psychoBand(adjustedPrice);
  const aspirational = psychoBand(Math.round(adjustedPrice * (1 + aspirationalBoost)));

  // 7) DOM predikcie per stratégia
  const [domAggr, domMkt, domAsp] = await Promise.all([
    predictDOM(body, aggressive, cma),
    predictDOM(body, market, cma),
    predictDOM(body, aspirational, cma),
  ]);

  // 8) Recommended strategy — malá vzorka NIKDY neodporúča hore (aspirational).
  const recommendedStrategy: "aggressive" | "market" | "aspirational" =
    !enoughData ? "market"
    : demandLevel === "high" ? "aspirational"
    : demandLevel === "low" ? "aggressive"
    : "market";

  // 9) Výstup + persist log
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
    demand_level: demandLevel,
    cma: {
      active_count: cma.active_count,
      sold_count: cma.sold_count,
      realized_count: cma.realized_count,
      asking_median_per_m2: cma.asking_median_per_m2,
      realized_median_per_m2: cma.realized_median_per_m2,
      asking_to_realized_gap_pct: cma.asking_to_realized_gap_pct,
      median_dom: cma.median_dom,
      lok_level: cma.lok_level,
      match_level: cma.match_level,
      relaxed: cma.relaxed,
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
