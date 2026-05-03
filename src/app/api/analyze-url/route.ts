import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

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

/** Vráti median €/m² zo skutočných monitor_inzeraty + count alebo null. */
async function marketBenchmark(
  lokalita: string,
  typ: string | null,
  izby: number | null,
): Promise<{ median: number; count: number; source: "monitor" | "static" }> {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("monitor_inzeraty")
    .select("cena, plocha, lokalita, typ, izby")
    .not("cena", "is", null)
    .not("plocha", "is", null)
    .gt("cena", 0)
    .gt("plocha", 0);
  if (lokalita) q = q.ilike("lokalita", `%${lokalita.split(" ")[0]}%`);
  if (typ) q = q.ilike("typ", `%${typ}%`);
  if (izby != null) q = q.eq("izby", izby);
  const { data } = await q.limit(200);
  const vals = (data || [])
    .map(r => Number(r.cena) / Number(r.plocha))
    .filter(v => Number.isFinite(v) && v > 100 && v < 30000)
    .sort((a, b) => a - b);
  if (vals.length >= 5) {
    const mid = Math.floor(vals.length / 2);
    const median = vals.length % 2 === 0 ? Math.round((vals[mid - 1] + vals[mid]) / 2) : Math.round(vals[mid]);
    return { median, count: vals.length, source: "monitor" };
  }
  return { median: staticBenchmark(lokalita), count: 0, source: "static" };
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
  popis: string | null;
  predajca: string | null;
  fotka_url: string | null;
}

async function aiExtract(text: string, meta: Record<string, string>, url: string): Promise<ExtractedListing | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[analyze-url] ANTHROPIC_API_KEY missing");
    return null;
  }
  const system = `Si extraktor údajov z realitných inzerátov v slovenčine. Vráť IBA validný JSON bez markdown, bez komentárov.`;
  const user = `Z týchto údajov vytiahni informácie o nehnuteľnosti a vráť JSON v presnom formáte:

{
  "nazov": string|null,
  "typ_nehnutelnosti": "byt"|"rodinny_dom"|"pozemok"|"chata"|"komercna"|"garaz"|null,
  "lokalita": string|null,
  "cena": number|null,
  "plocha": number|null,
  "izby": number|null,
  "stav": "novostavba"|"po_rekonstrukcii"|"povodny_stav"|"developersky_projekt"|null,
  "popis": string|null,
  "predajca": string|null,
  "fotka_url": string|null
}

Pre cenu: iba číslo v eurách (bez €, čiarok, "od", "vrátane DPH" atď).
Pre plochu: iba číslo v m² (úžitková ak je viac plôch).
Pre izby: iba číslo (ak píše "3-izbový" → 3, "garsónka" → 1, "1+kk" → 1).
Pre lokalitu: konkrétna obec/mestská časť (napr. "Bratislava-Ružinov", nie len "Bratislava").

URL: ${url}
Title: ${meta.title || meta["og:title"] || "—"}
OG image: ${meta["og:image"] || "—"}
OG description: ${meta["og:description"] || "—"}

Text inzerátu:
${text}`;

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
        max_tokens: 1500,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      console.error("[analyze-url] Anthropic HTTP", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    const raw = data?.content?.[0]?.text?.trim() || "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    return JSON.parse(m[0]) as ExtractedListing;
  } catch (e) {
    console.error("[analyze-url] AI extract failed:", e);
    return null;
  }
}

async function aiVerdict(item: ExtractedListing, eurM2: number, benchmark: number, odchylka: number): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const system = `Si senior realitný analytik na Slovensku. Stručne, vecne, po slovensky. Vráť IBA JSON bez markdown.`;
  const prompt = `Analyzuj túto nehnuteľnosť:
Názov: ${item.nazov || item.typ_nehnutelnosti}
Lokalita: ${item.lokalita}
Cena: ${item.cena}€ | Plocha: ${item.plocha}m² | €/m²: ${eurM2}
Trhový benchmark (median): ${benchmark}€/m² | Odchýlka: ${odchylka > 0 ? "+" : ""}${odchylka}%
Typ: ${item.typ_nehnutelnosti} | Stav: ${item.stav || "—"} | Izby: ${item.izby || "—"}
Popis (úryvok): ${(item.popis || "").slice(0, 800)}

Vráť JSON:
{
  "verdikt": "podhodnotene"|"trhova_cena"|"nadhodnotene",
  "silne_stranky": ["max 3 body, krátke"],
  "slabe_stranky": ["max 3 body, krátke"],
  "odporucanie": "1-2 vety čo by mal maklér urobiť",
  "cielova_skupina": "kto je ideálny kupujúci",
  "cas_predaja": "odhad v týždňoch (číslo + stručný kontext)",
  "vyjednavacie_argumenty": ["max 3 body — čo môže maklér použiť pri vyjednávaní ceny"]
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
  let body: { url?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  const url = String(body.url || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "Zadaj platný HTTP/HTTPS odkaz" }, { status: 400 });
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
  const extracted = await aiExtract(text, meta, url);
  if (!extracted) {
    return NextResponse.json({ error: "AI extrakcia zlyhala — skús neskôr alebo vlož údaje ručne" }, { status: 500 });
  }
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

  const ai = await aiVerdict(extracted, eurM2, benchmark, odchylka);
  const hyp = hypoteka(cena);

  return NextResponse.json({
    url,
    extracted,
    analysis: {
      zaklad: { cena, plocha, eurM2, benchmark, odchylka, stav },
      benchmark_zdroj: benchmarkRes.source === "monitor"
        ? `median z ${benchmarkRes.count} skutočných inzerátov v ${extracted.lokalita}`
        : `statický odhad pre ${extracted.lokalita || "SR"}`,
      hypoteka: hyp,
      ai: ai || {
        verdikt: stav,
        silne_stranky: [], slabe_stranky: [],
        odporucanie: "Nedostatok dát pre AI analýzu",
        cielova_skupina: "—", cas_predaja: "—",
        vyjednavacie_argumenty: [],
      },
    },
  });
}
