import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { analyzeOkolie } from "@/lib/okolie";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/analyze-url
 * Body: { url }
 *
 * 1. Fetch URL s realistickým UA (anti-bot)
 * 2. Vyrobí čisý text z HTML (strip tagov, decode entít, vyber main content)
 * 3. Claude extract structured: { typ, lokalita, cena, plocha, izby, stav, popis }
 * 4. Spočíta benchmark (median €/m² zo skutočných monitor_inzeraty pre lokalitu+typ+izby,
 *    fallback na statický), hypotéku, AI verdikt
 * 5. Vráti { extracted, analysis }
 */

const STATIC_BENCHMARKS: Record<string, number> = {
  "Bratislava I": 4200, "Bratislava II": 3400, "Bratislava III": 3200,
  "Bratislava IV": 3100, "Bratislava V": 2800, "Bratislava": 3300,
  "Bratislava-Staré Mesto": 4200, "Bratislava-Ružinov": 3400,
  "Bratislava-Nové Mesto": 3200, "Bratislava-Karlova Ves": 3100,
  "Bratislava-Petržalka": 2800, "Bratislava-Dúbravka": 2900,
  "Bratislava-Rača": 2700, "Bratislava-Vrakuňa": 2600,
  "Bratislava-Podunajské Biskupice": 2500,
  "Trnava": 2400, "Nitra": 2100, "Trenčín": 1900, "Žilina": 2200,
  "Banská Bystrica": 1800, "Prešov": 1700, "Košice": 2000,
  "Stupava": 2600, "Senec": 2700, "Pezinok": 2500, "Malacky": 2100,
  "Piešťany": 2200, "Poprad": 2000, "Martin": 1800,
};

function staticBenchmark(lokalita: string): number {
  if (!lokalita) return 3000;
  const lower = lokalita.toLowerCase();
  for (const [k, v] of Object.entries(STATIC_BENCHMARKS)) {
    if (lower.includes(k.toLowerCase())) return v;
  }
  return 2500;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  if (s.length === 0) return 0;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[mid - 1] + s[mid]) / 2) : Math.round(s[mid]);
}

interface BenchmarkResult {
  median: number;             // hlavný benchmark €/m² ktorý sa používa pri verdikte
  count: number;              // koľko inzerátov tvorí benchmark
  source: "realized" | "asking" | "static";
  asking_median?: number;     // median ponuk z aktívnych inzerátov
  asking_count?: number;
  realized_median?: number;   // median odhadovanej realizačnej ceny zo zmizlých inzerátov
  realized_count?: number;
  avg_discount_pct?: number;  // o koľko ľudia bežne zľavnili (z disappearances)
  median_dom?: number;        // typický počet dní na trhu
}

/**
 * Vypočítaj trhový benchmark s tromi vrstvami:
 *  1. realized — median realizačnej ceny zo zmiznutých inzerátov (najpresnejšie)
 *  2. asking — median z aktívnych ponúk (ak nedostatok realized)
 *  3. static — natvrdo zadané hodnoty pre lokality (fallback)
 *
 * Plus extra metriky pre dashboard a AI prompt: asking-vs-realized gap,
 * priemerné zľavy, typický DOM v segmente.
 */
async function marketBenchmark(
  lokalita: string,
  typ: string | null,
  izby: number | null,
): Promise<BenchmarkResult> {
  const sb = getSupabaseAdmin();
  const locFilter = lokalita ? lokalita.split(" ")[0] : null;

  // 1) Asking median z aktívnych monitor inzerátov
  let askingQ = sb
    .from("monitor_inzeraty")
    .select("cena, plocha")
    .eq("is_active", true)
    .not("cena", "is", null)
    .not("plocha", "is", null)
    .gt("cena", 0)
    .gt("plocha", 0);
  if (locFilter) askingQ = askingQ.ilike("lokalita", `%${locFilter}%`);
  if (typ) askingQ = askingQ.ilike("typ", `%${typ}%`);
  if (izby != null) askingQ = askingQ.eq("izby", izby);
  const { data: asking } = await askingQ.limit(200);
  const askingVals = (asking || [])
    .map(r => Number(r.cena) / Number(r.plocha))
    .filter(v => Number.isFinite(v) && v > 100 && v < 30000);

  // 2) Realized median zo zmiznutých inzerátov (likely_sold s confidence ≥ 0.6,
  //    posledných 12 mesiacov)
  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let disapQ = sb
    .from("monitor_inzeraty_disappearances")
    .select("estimated_sale_price, last_known_eur_per_m2, estimated_discount_pct, total_days_on_market, monitor_inzeraty!inner(lokalita, typ, izby)")
    .eq("classification", "likely_sold")
    .gte("confidence_score", 0.6)
    .gte("disappeared_on", yearAgo)
    .not("estimated_sale_price", "is", null);
  if (locFilter) disapQ = disapQ.ilike("monitor_inzeraty.lokalita", `%${locFilter}%`);
  if (typ) disapQ = disapQ.ilike("monitor_inzeraty.typ", `%${typ}%`);
  if (izby != null) disapQ = disapQ.eq("monitor_inzeraty.izby", izby);
  const { data: disap } = await disapQ.limit(200);

  // realized eur/m² = estimated_sale_price / plocha — máme last_known_eur_per_m2
  // ktoré bolo asking. Z neho pomocou discount % spätne dopočítame realized:
  //   realized_per_m2 = asking_per_m2 × (1 - discount/100)
  const realizedVals: number[] = [];
  const discounts: number[] = [];
  const doms: number[] = [];
  for (const d of disap || []) {
    const askingPerM2 = d.last_known_eur_per_m2 ? Number(d.last_known_eur_per_m2) : null;
    const discount = d.estimated_discount_pct != null ? Number(d.estimated_discount_pct) : null;
    if (askingPerM2 && discount != null && askingPerM2 > 100 && askingPerM2 < 30000) {
      realizedVals.push(askingPerM2 * (1 - discount / 100));
    }
    if (discount != null && discount >= 0 && discount < 50) discounts.push(discount);
    if (d.total_days_on_market != null) doms.push(Number(d.total_days_on_market));
  }

  const askingMedian = askingVals.length >= 3 ? median(askingVals) : 0;
  const realizedMedian = realizedVals.length >= 3 ? Math.round(median(realizedVals)) : 0;
  const avgDiscount = discounts.length >= 3
    ? Math.round((discounts.reduce((s, x) => s + x, 0) / discounts.length) * 10) / 10
    : undefined;
  const medDom = doms.length >= 3 ? median(doms) : undefined;

  // Vyber primárny benchmark (realized > asking > static)
  if (realizedMedian > 0 && realizedVals.length >= 3) {
    return {
      median: realizedMedian,
      count: realizedVals.length,
      source: "realized",
      asking_median: askingMedian || undefined,
      asking_count: askingVals.length,
      realized_median: realizedMedian,
      realized_count: realizedVals.length,
      avg_discount_pct: avgDiscount,
      median_dom: medDom,
    };
  }
  if (askingMedian > 0 && askingVals.length >= 5) {
    return {
      median: askingMedian,
      count: askingVals.length,
      source: "asking",
      asking_median: askingMedian,
      asking_count: askingVals.length,
      avg_discount_pct: avgDiscount,
      median_dom: medDom,
    };
  }
  return {
    median: staticBenchmark(lokalita),
    count: 0,
    source: "static",
    avg_discount_pct: avgDiscount,
    median_dom: medDom,
  };
}

const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">",
  "&quot;": "\"", "&#39;": "'", "&apos;": "'",
};

function htmlToText(html: string): string {
  // Drop script/style/noscript
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  // Preserve some structure → newlines pre block-level tagy
  s = s.replace(/<\/?(p|div|h[1-6]|li|tr|br)[^>]*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
  s = s.replace(/&[a-z]+;/gi, m => HTML_ENTITIES[m] || " ");
  s = s.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
  // Limit dĺžku — Claude má limit kontextu, plus zbytočne dlhý text
  return s.length > 18000 ? s.slice(0, 18000) + "\n[truncated]" : s;
}

function extractMeta(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const ogRe = /<meta[^>]+property=["']og:(\w+)["'][^>]+content=["']([^"']+)["']/gi;
  let m;
  while ((m = ogRe.exec(html)) !== null) meta[`og:${m[1]}`] = m[2];
  const titleM = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleM) meta.title = titleM[1].trim();
  return meta;
}

interface ExtractedListing {
  nazov: string | null;
  typ_nehnutelnosti: string | null;
  lokalita: string | null;
  cena: number | null;
  plocha: number | null;
  izby: number | null;
  stav: string | null;
  /** Pôvodná hodnota čo uvádza inzerát (môže byť nepresná) */
  stav_inzerovany: string | null;
  /** AI vlastné posúdenie stavu na základe popisu, roku výstavby, fotky.
   *  Príklad: inzerát uvádza "pôvodný stav" ale rok výstavby 2018 + popis
   *  spomína moderné kuchyne → AI prehodnotí na "po_rekonstrukcii". */
  stav_posudeny_ai: string | null;
  /** Krátke odôvodnenie posúdenia (pre transparentnosť) */
  stav_odovodnenie: string | null;
  year_built: number | null;
  year_reconstructed: number | null;
  popis: string | null;
  predajca: string | null;
  fotka_url: string | null;
}

interface AiExtractResult {
  data: ExtractedListing | null;
  error?: string;
  /** detail debugu pre logy: HTTP status, parse error message etc. */
  debug?: string;
}

async function aiExtract(text: string, meta: Record<string, string>, url: string): Promise<AiExtractResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[analyze-url] ANTHROPIC_API_KEY missing");
    return { data: null, error: "ANTHROPIC_API_KEY nie je nakonfigurovaný na serveri" };
  }
  const system = `Si senior realitný analytik a extraktor údajov z inzerátov v slovenčine.
Tvoja špecialita: posúdiť SKUTOČNÝ stav nehnuteľnosti — nielen čo inzerát hovorí,
ale aj čo nepriamo naznačuje rok výstavby, popis a (ak je dostupná) fotka.

KRITICKÉ pravidlo posúdenia stavu:
- "pôvodný stav" v inzeráte ≠ vždy "schátrané"!
- Ak rok výstavby ≥2010 + "pôvodný stav" → pravdepodobne **moderné** (developer odovzdal v štandarde, ďalej sa nič nemenilo). Posúď ako "po_rekonstrukcii" pre AVM účely.
- Ak rok výstavby ≥2018 + "pôvodný stav" → posúď ako "novostavba" (developerský štandard moderný).
- Ak rok výstavby <1990 + "pôvodný stav" → naozaj "povodny_stav" (treba investíciu).
- Ak popis spomína "kompletná rekonštrukcia 2020", "nová kuchyňa", "nové okná po roku 2015" → hoci inzerát hovorí "pôvodný", posúď ako "po_rekonstrukcii".
- Ak fotky ukazujú moderné rozvrhy/kuchyne/podlahy → po_rekonstrukcii alebo novostavba.

Vráť IBA validný JSON bez markdown, bez komentárov.`;

  const userText = `Z týchto údajov vytiahni informácie o nehnuteľnosti a vráť JSON v presnom formáte:

{
  "nazov": string|null,
  "typ_nehnutelnosti": "byt"|"rodinny_dom"|"pozemok"|"chata"|"komercna"|"garaz"|null,
  "lokalita": string|null,
  "cena": number|null,
  "plocha": number|null,
  "izby": number|null,
  "stav_inzerovany": "novostavba"|"po_rekonstrukcii"|"povodny_stav"|"developersky_projekt"|null,
  "stav_posudeny_ai": "novostavba"|"po_rekonstrukcii"|"povodny_stav"|"developersky_projekt"|null,
  "stav_odovodnenie": "1-2 vety prečo posúdenie iné/rovnaké ako inzerát",
  "year_built": number|null,
  "year_reconstructed": number|null,
  "popis": string|null,
  "predajca": string|null,
  "fotka_url": string|null
}

Pre cenu: iba číslo v eurách (bez €, čiarok, "od", "vrátane DPH" atď).
Pre plochu: iba číslo v m² (úžitková ak je viac plôch).
Pre izby: iba číslo (ak píše "3-izbový" → 3, "garsónka" → 1, "1+kk" → 1).
Pre lokalitu: konkrétna obec/mestská časť (napr. "Bratislava-Ružinov", nie len "Bratislava").
Pre year_built: rok dokončenia (môže byť v popise alebo z roka kolaudácie).
Pre stav_posudeny_ai: TVOJE posúdenie po zvážení year_built + popis + fotka. Ak je rovnaké ako stav_inzerovany, skopíruj.

URL: ${url}
Title: ${meta.title || meta["og:title"] || "—"}
OG image: ${meta["og:image"] || "—"}
OG description: ${meta["og:description"] || "—"}

Text inzerátu:
${text}`;

  // Vision input — ak má og:image, pripoj ako image content type
  // (Claude môže analyzovať fotku spolu s textom)
  const ogImage = meta["og:image"];
  const messageContent: Array<Record<string, unknown>> = [{ type: "text", text: userText }];
  if (ogImage && /^https?:\/\//i.test(ogImage)) {
    messageContent.push({
      type: "image",
      source: { type: "url", url: ogImage },
    });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        system,
        messages: [{ role: "user", content: messageContent }],
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[analyze-url] Anthropic HTTP", res.status, errBody.slice(0, 500));
      // Fallback bez fotky ak vision API zlyhalo (image URL môže byť nedostupný)
      if (ogImage) {
        const res2 = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-sonnet-4-5",
            max_tokens: 2000,
            system,
            messages: [{ role: "user", content: userText }],
          }),
        });
        if (res2.ok) {
          const d2 = await res2.json();
          const r2 = d2?.content?.[0]?.text?.trim() || "";
          const m2 = r2.match(/\{[\s\S]*\}/);
          if (m2) {
            try {
              const parsed = JSON.parse(m2[0]) as ExtractedListing;
              if (!parsed.stav && parsed.stav_posudeny_ai) parsed.stav = parsed.stav_posudeny_ai;
              return { data: parsed };
            } catch (parseErr) {
              return { data: null, error: "AI vrátil odpoveď, ale nepodarilo sa rozparsovať JSON", debug: `parse: ${(parseErr as Error).message}; raw: ${m2[0].slice(0, 200)}` };
            }
          }
          return { data: null, error: "AI fallback nevrátil JSON v očakávanom formáte", debug: `raw: ${r2.slice(0, 200)}` };
        }
        const err2Body = await res2.text().catch(() => "");
        return { data: null, error: `AI volanie zlyhalo: HTTP ${res.status} → fallback HTTP ${res2.status}`, debug: err2Body.slice(0, 300) };
      }
      return { data: null, error: `AI volanie zlyhalo: HTTP ${res.status}`, debug: errBody.slice(0, 300) };
    }
    const data = await res.json();
    const raw = data?.content?.[0]?.text?.trim() || "";
    if (!raw) {
      return { data: null, error: "AI vrátil prázdnu odpoveď", debug: JSON.stringify(data).slice(0, 300) };
    }
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) {
      return { data: null, error: "AI nevrátil JSON v očakávanom formáte", debug: `raw: ${raw.slice(0, 200)}` };
    }
    try {
      const parsed = JSON.parse(m[0]) as ExtractedListing;
      if (!parsed.stav && parsed.stav_posudeny_ai) parsed.stav = parsed.stav_posudeny_ai;
      return { data: parsed };
    } catch (parseErr) {
      return { data: null, error: "AI vrátil JSON ktorý sa nepodarilo rozparsovať", debug: `parse: ${(parseErr as Error).message}; raw: ${m[0].slice(0, 200)}` };
    }
  } catch (e) {
    console.error("[analyze-url] AI extract failed:", e);
    return { data: null, error: `AI volanie hodilo výnimku: ${(e as Error).message}` };
  }
}

async function aiVerdict(
  item: ExtractedListing,
  eurM2: number,
  benchmark: number,
  odchylka: number,
  bm: BenchmarkResult,
): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const system = `Si senior realitný analytik na Slovensku. Stručne, vecne, po slovensky. Vráť IBA JSON bez markdown.`;

  // Bohatší kontext z disappearance-detector dát: koľko ľudia zľavnili,
  // koľko bežia inzeráty na trhu, či máme realizačné alebo len ponukové ceny.
  const benchmarkContext: string[] = [];
  if (bm.source === "realized" && bm.realized_count) {
    benchmarkContext.push(`Benchmark = REALIZAČNÁ cena (median z ${bm.realized_count} skutočne predaných inzerátov za posledný rok)`);
  } else if (bm.source === "asking" && bm.asking_count) {
    benchmarkContext.push(`Benchmark = ASKING cena (median z ${bm.asking_count} aktívnych ponúk; málo predaných dát pre tento segment)`);
  } else {
    benchmarkContext.push(`Benchmark = statický odhad (málo dát z monitor)`);
  }
  if (bm.asking_median && bm.realized_median && bm.asking_median > 0) {
    const gap = Math.round(((bm.asking_median - bm.realized_median) / bm.asking_median) * 100 * 10) / 10;
    if (gap > 0.5) benchmarkContext.push(`Asking-vs-realized gap: ${gap}% (predajcovia v segmente bežne pýtajú o toľko viac ako sa naozaj predajú)`);
  }
  if (bm.avg_discount_pct != null && bm.avg_discount_pct > 0) {
    benchmarkContext.push(`Priemerná zľava od pôvodnej ceny: ${bm.avg_discount_pct}% (z ${bm.realized_count || 0} predaných inzerátov)`);
  }
  if (bm.median_dom != null) {
    benchmarkContext.push(`Typický čas na trhu pred predajom v tomto segmente: ${bm.median_dom} dní`);
  }

  const ext = item as ExtractedListing;
  const stavLine = ext.stav_inzerovany && ext.stav_posudeny_ai && ext.stav_inzerovany !== ext.stav_posudeny_ai
    ? `Stav inzerovaný: "${ext.stav_inzerovany}" | Stav posúdený AI: "${ext.stav_posudeny_ai}" (${ext.stav_odovodnenie || "—"})`
    : `Stav: ${ext.stav_posudeny_ai || ext.stav || "—"}`;
  const yearLine = ext.year_built
    ? `Rok výstavby: ${ext.year_built}${ext.year_reconstructed ? ` | Rok rekonštrukcie: ${ext.year_reconstructed}` : ""}`
    : "";

  const prompt = `Analyzuj túto nehnuteľnosť:
Názov: ${item.nazov || item.typ_nehnutelnosti}
Lokalita: ${item.lokalita}
Cena: ${item.cena}€ | Plocha: ${item.plocha}m² | €/m²: ${eurM2}
Trhový benchmark: ${benchmark}€/m² | Odchýlka: ${odchylka > 0 ? "+" : ""}${odchylka}%
Typ: ${item.typ_nehnutelnosti} | ${stavLine} | Izby: ${item.izby || "—"}
${yearLine}

Trhové info z nášho monitora:
${benchmarkContext.map(s => `- ${s}`).join("\n")}

Popis (úryvok): ${(item.popis || "").slice(0, 800)}

DÔLEŽITÉ: Ak je rozdiel medzi inzerovaným a posúdeným stavom, ber do úvahy posúdený stav (napr. "pôvodný stav" v novostavbe z 2018 = moderné, nie schátrané — to ovplyvňuje cenovú primeranosť).

Vyjednávacie argumenty MUSIA byť konkrétne — ak vieš že v segmente predajcovia zľavňujú o X%, použi to. Ak vieš že priemerný čas na trhu je Y dní, použi to.

Vráť JSON:
{
  "verdikt": "podhodnotene"|"trhova_cena"|"nadhodnotene",
  "silne_stranky": ["max 3 body, krátke"],
  "slabe_stranky": ["max 3 body, krátke"],
  "odporucanie": "1-2 vety čo by mal maklér urobiť",
  "cielova_skupina": "kto je ideálny kupujúci",
  "cas_predaja": "odhad v týždňoch (číslo + stručný kontext, použi median DOM ak vieš)",
  "vyjednavacie_argumenty": ["max 3 body — konkrétne čísla z trhových info"]
}`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5", max_tokens: 1200, system,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.content?.[0]?.text?.trim() || "";
    const m = raw.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch { return null; }
}

function hypoteka(cena: number) {
  if (!cena || cena <= 0) return null;
  const ltv = 0.80, urok = 0.032, roky = 30;
  const istina = cena * ltv;
  const mu = urok / 12;
  const n = roky * 12;
  const splatka = Math.round(istina * (mu * Math.pow(1 + mu, n)) / (Math.pow(1 + mu, n) - 1));
  return {
    istina,
    mesacna_splatka: splatka,
    celkova_nakup: Math.round(istina + (splatka * n - istina)),
    hotovost_potrebna: Math.round(cena * 0.20 + cena * 0.035),
    potrebny_prijem: Math.round(splatka / 0.40),
    ltv: `${ltv * 100}%`, urok: `${urok * 100}%`, roky,
  };
}

export async function POST(req: NextRequest) {
  let body: { url?: string; manual_data?: Partial<ExtractedListing> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  const url = String(body.url || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "Zadaj platný HTTP/HTTPS odkaz" }, { status: 400 });
  }

  // FALLBACK PATH — ak klient pošle `manual_data` (po zlyhaní AI extrakcie),
  // preskoč fetch + AI a urob analýzu nad ručne zadanými údajmi.
  if (body.manual_data) {
    const m = body.manual_data;
    const extracted: ExtractedListing = {
      nazov: m.nazov ?? null,
      typ_nehnutelnosti: m.typ_nehnutelnosti ?? null,
      lokalita: m.lokalita ?? null,
      cena: m.cena != null ? Number(m.cena) : null,
      plocha: m.plocha != null ? Number(m.plocha) : null,
      izby: m.izby != null ? Number(m.izby) : null,
      stav: m.stav ?? m.stav_posudeny_ai ?? m.stav_inzerovany ?? null,
      stav_inzerovany: m.stav_inzerovany ?? null,
      stav_posudeny_ai: m.stav_posudeny_ai ?? m.stav_inzerovany ?? null,
      stav_odovodnenie: m.stav_odovodnenie ?? "Údaje vyplnené ručne maklérom",
      year_built: m.year_built != null ? Number(m.year_built) : null,
      year_reconstructed: m.year_reconstructed != null ? Number(m.year_reconstructed) : null,
      popis: m.popis ?? null,
      predajca: m.predajca ?? null,
      fotka_url: m.fotka_url ?? null,
    };

    const cena = Number(extracted.cena) || 0;
    const plocha = Number(extracted.plocha) || 0;
    const eurM2 = plocha > 0 ? Math.round(cena / plocha) : 0;
    const benchmarkRes = await marketBenchmark(extracted.lokalita || "", extracted.typ_nehnutelnosti, extracted.izby);
    const benchmark = benchmarkRes.median;
    const odchylka = benchmark > 0 ? Math.round(((eurM2 - benchmark) / benchmark) * 100) : 0;
    const stav = odchylka < -10 ? "podhodnotene" : odchylka > 10 ? "nadhodnotene" : "trhova_cena";

    const ai = await aiVerdict(extracted, eurM2, benchmark, odchylka, benchmarkRes);
    const hyp = hypoteka(cena);
    const okolie = await analyzeOkolie({ lokalita: extracted.lokalita || "", typ: extracted.typ_nehnutelnosti || null });

    return NextResponse.json({
      url,
      extracted,
      analysis: {
        zaklad: { cena, plocha, eurM2, benchmark, odchylka, stav },
        benchmark_zdroj: benchmarkRes.source === "realized"
          ? `median z ${benchmarkRes.realized_count} predaných inzerátov`
          : benchmarkRes.source === "asking"
          ? `median z ${benchmarkRes.asking_count} aktívnych ponúk`
          : "statický odhad",
        trh: {
          zdroj: benchmarkRes.source,
          asking_median: benchmarkRes.asking_median ?? null,
          asking_count: benchmarkRes.asking_count ?? 0,
          realized_median: benchmarkRes.realized_median ?? null,
          realized_count: benchmarkRes.realized_count ?? 0,
          avg_discount_pct: benchmarkRes.avg_discount_pct ?? null,
          median_dom: benchmarkRes.median_dom ?? null,
        },
        hypoteka: hyp,
        ai: ai || {
          verdikt: stav, silne_stranky: [], slabe_stranky: [],
          odporucanie: "Nedostatok dát", cielova_skupina: "—", cas_predaja: "—",
          vyjednavacie_argumenty: [],
        },
        okolie,
      },
      manual_input: true,
    });
  }

  // 1) Fetch URL — realistický UA aby cudzí weby neblokli
  let html: string;
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "sk,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) {
      return NextResponse.json({ error: `Zdroj vrátil HTTP ${r.status}. Možno je za prihlásením alebo blokuje boty.` }, { status: 502 });
    }
    html = await r.text();
  } catch (e) {
    return NextResponse.json({ error: `Zdroj sa nedá načítať: ${(e as Error).message}` }, { status: 502 });
  }

  // 2) Vyparsuj
  const meta = extractMeta(html);
  const text = htmlToText(html);

  // 3) AI extract
  const aiRes = await aiExtract(text, meta, url);
  if (!aiRes.data) {
    console.error("[analyze-url] aiExtract failed:", aiRes.error, aiRes.debug);
    // Vytiahni z meta tagov aspoň základné údaje pre manuálny fallback
    const fallbackData: ExtractedListing = {
      nazov: meta["og:title"] || meta.title || null,
      typ_nehnutelnosti: null,
      lokalita: null,
      cena: null,
      plocha: null,
      izby: null,
      stav: null,
      stav_inzerovany: null,
      stav_posudeny_ai: null,
      stav_odovodnenie: null,
      year_built: null,
      year_reconstructed: null,
      popis: meta["og:description"] || null,
      predajca: null,
      fotka_url: meta["og:image"] || null,
    };
    return NextResponse.json({
      url,
      extracted: fallbackData,
      analysis: null,
      ai_failed: true,
      ai_error: aiRes.error || "AI extrakcia zlyhala",
      ai_debug: aiRes.debug || null,
      message: "AI extrakcia zlyhala. Pošli formulár s ručne vyplnenými údajmi pre dokončenie analýzy.",
    }, { status: 200 });
  }
  const extracted = aiRes.data;
  // OG image fallback
  if (!extracted.fotka_url && meta["og:image"]) extracted.fotka_url = meta["og:image"];

  // 4) Benchmark + analýza
  const cena = Number(extracted.cena) || 0;
  const plocha = Number(extracted.plocha) || 0;
  const eurM2 = plocha > 0 ? Math.round(cena / plocha) : 0;
  const benchmarkRes = await marketBenchmark(extracted.lokalita || "", extracted.typ_nehnutelnosti, extracted.izby);
  const benchmark = benchmarkRes.median;
  const odchylka = benchmark > 0 ? Math.round(((eurM2 - benchmark) / benchmark) * 100) : 0;
  const stav = odchylka < -10 ? "podhodnotene" : odchylka > 10 ? "nadhodnotene" : "trhova_cena";

  const ai = await aiVerdict(extracted, eurM2, benchmark, odchylka, benchmarkRes);
  const hyp = hypoteka(cena);

  // NEW — analýza okolia cez Gemini (Google Maps knowledge)
  // Beží paralelne v poradí — môžeme bezpečne ignorovať fail (vráti fallback)
  const okolie = await analyzeOkolie({
    lokalita: extracted.lokalita || "",
    typ: extracted.typ_nehnutelnosti || null,
  });

  // Popis zdroja benchmarku — povie maklérovi či bola cena merané proti reálne
  // predaným inzerátom alebo len ponukám.
  const benchmark_zdroj = (() => {
    if (benchmarkRes.source === "realized") {
      return `median REALIZAČNÝCH cien z ${benchmarkRes.realized_count} skutočne predaných inzerátov v ${extracted.lokalita} za posledný rok`;
    }
    if (benchmarkRes.source === "asking") {
      return `median z ${benchmarkRes.asking_count} aktívnych ponúk v ${extracted.lokalita} (málo predaných dát pre tento segment)`;
    }
    return `statický odhad pre ${extracted.lokalita || "SR"} (málo dát z monitora)`;
  })();

  // Uložiť do monitor_inzeraty — fire and forget
  if (extracted.cena && extracted.lokalita) {
    const supabase = getSupabaseAdmin();
    void supabase.from("monitor_inzeraty").upsert({
      url,
      nazov: extracted.nazov || extracted.lokalita,
      lokalita: extracted.lokalita,
      cena: extracted.cena,
      plocha: extracted.plocha || null,
      typ_nehnutelnosti: extracted.typ_nehnutelnosti || null,
      izby: extracted.izby || null,
      predajca_typ: "manualny",
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "url", ignoreDuplicates: false });
  }

  return NextResponse.json({
    url,
    extracted,
    analysis: {
      zaklad: { cena, plocha, eurM2, benchmark, odchylka, stav },
      benchmark_zdroj,
      // Trhové štatistiky v segmente — nech UI vie zobraziť presne čísla
      trh: {
        zdroj: benchmarkRes.source,
        asking_median: benchmarkRes.asking_median ?? null,
        asking_count: benchmarkRes.asking_count ?? 0,
        realized_median: benchmarkRes.realized_median ?? null,
        realized_count: benchmarkRes.realized_count ?? 0,
        avg_discount_pct: benchmarkRes.avg_discount_pct ?? null,
        median_dom: benchmarkRes.median_dom ?? null,
      },
      hypoteka: hyp,
      ai: ai || {
        verdikt: stav,
        silne_stranky: [], slabe_stranky: [],
        odporucanie: "Nedostatok dát pre AI analýzu",
        cielova_skupina: "—", cas_predaja: "—",
        vyjednavacie_argumenty: [],
      },
      okolie,
    },
  });
}
