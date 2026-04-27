import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/analyzy
 *
 * Modes:
 *   'quick'      → rýchla analýza (cena + topovanie). Vstup: nehnutelnost_id
 *   'detailed'   → detailná (cena, postup, konkurencia, zdôvodnenie). Vstup: nehnutelnost_id
 *   'from_link'  → z URL inzerátu. Vstup: url
 *   'from_data'  → z manuálnych údajov. Vstup: data { typ, plocha, izby, lokalita, cena, popis }
 *
 * GET /api/analyzy?nehnutelnost_id=X
 *   Vráti posledné analýzy pre danú nehnuteľnosť (pre zobrazenie v UI)
 */

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";

interface QuickResult {
  odhadovana_cena_eur: number;
  odporucany_cas_topovania_dni: number;
  kratke_zdovodnenie: string;
}

interface DetailedResult {
  odhadovana_cena_eur: number;
  cena_min: number;
  cena_max: number;
  analyza_text: string;
  konkurencia: Array<{ popis: string; cena_eur?: number; lokalita?: string; plocha_m2?: number }>;
  postup: string[];
  zdovodnenie: string;
}

function extractJson(text: string): unknown {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI nevrátilo JSON");
  return JSON.parse(m[0]);
}

async function quickAnalyze(input: { typ: string; plocha?: number; izby?: number; lokalita?: string; cena?: number }): Promise<QuickResult> {
  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
  const prompt = `Si realitný expert pre slovenský trh (Bratislava, Košice, Nitra...). Analyzuj túto nehnuteľnosť a vráť IBA JSON, žiadny iný text:

Nehnuteľnosť:
- Typ: ${input.typ || "—"}
- Plocha: ${input.plocha ?? "—"} m²
- Izby: ${input.izby ?? "—"}
- Lokalita: ${input.lokalita || "—"}
- Aktuálna ponúkaná cena: ${input.cena ? input.cena + " €" : "—"}

Vráť JSON formátu:
{
  "odhadovana_cena_eur": <číslo: trhová cena za ktorú by sa mala predať>,
  "odporucany_cas_topovania_dni": <číslo: po koľkých dňoch refreshnúť/topovať inzerát; typicky 5-14>,
  "kratke_zdovodnenie": "<jedna veta prečo cena, max 100 znakov>"
}`;
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content.map(b => (b.type === "text" ? b.text : "")).join("");
  return extractJson(text) as QuickResult;
}

async function detailedAnalyze(input: { typ: string; plocha?: number; izby?: number; lokalita?: string; cena?: number; nazov?: string; popis?: string; stav?: string }): Promise<DetailedResult> {
  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
  const prompt = `Si skúsený realitný analytik pre slovenský trh. Pripravuješ DETAILNÚ analýzu nehnuteľnosti pre realitného makléra ktorý ju má predávať.

Nehnuteľnosť:
- Názov: ${input.nazov || "—"}
- Typ: ${input.typ || "—"}
- Lokalita: ${input.lokalita || "—"}
- Plocha: ${input.plocha ?? "—"} m²
- Izby: ${input.izby ?? "—"}
- Stav: ${input.stav || "—"}
- Aktuálna ponúkaná cena: ${input.cena ? input.cena + " €" : "—"}
- Popis: ${input.popis || "—"}

Vráť IBA JSON v tomto presnom formáte (žiadny iný text okolo):
{
  "odhadovana_cena_eur": <int: realistická trhová cena>,
  "cena_min": <int: minimálna predajná cena>,
  "cena_max": <int: maximálna realistická cena>,
  "analyza_text": "<2-3 odstavce: stav trhu v lokalite, dopyt, prečo táto cena>",
  "zdovodnenie": "<vysvetli prečo si stanovil odhadovana_cena_eur na túto sumu, max 3 odrážky bullet>",
  "konkurencia": [
    { "popis": "<popis podobnej ponuky>", "cena_eur": <int>, "lokalita": "<...>", "plocha_m2": <int> },
    ... (3-5 príkladov podobných ponúk čo by mohli byť na trhu)
  ],
  "postup": [
    "<krok 1: napr. profesionálne foto>",
    "<krok 2: ...>",
    "<krok 3: ...>",
    ... (5-7 krokov ako efektívne predať)
  ]
}

Buď konkrétny pre slovenský trh. Ceny v EUR za celý objekt.`;
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2500,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content.map(b => (b.type === "text" ? b.text : "")).join("");
  return extractJson(text) as DetailedResult;
}

async function analyzeFromUrl(url: string): Promise<DetailedResult> {
  // Stiahni HTML obsah linku
  let html = "";
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; VianemaCRM/1.0)" } });
    if (r.ok) html = await r.text();
  } catch (e) {
    console.warn("[analyzy from-link] fetch failed:", e);
  }
  // Vyextrahuj iba textovy content (max 10k chars)
  const cleanText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 10000);

  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
  const prompt = `Si realitný analytik pre slovenský trh. Z tohto obsahu inzerátu vyextrahuj údaje o nehnuteľnosti a urob detailnú analýzu.

URL: ${url}
Obsah inzerátu (skrátený):
${cleanText || "(obsah nedostupný — analyzuj iba podľa URL)"}

Vráť IBA JSON v tomto presnom formáte:
{
  "odhadovana_cena_eur": <int>,
  "cena_min": <int>,
  "cena_max": <int>,
  "analyza_text": "<2-3 odstavce o trhu a tejto nehnutelnosti>",
  "zdovodnenie": "<prečo táto odhadovaná cena, 3 bullet points>",
  "konkurencia": [{ "popis": "<...>", "cena_eur": <int>, "lokalita": "<...>", "plocha_m2": <int> }],
  "postup": ["<krok 1>", "<krok 2>", ...]
}`;
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2500,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content.map(b => (b.type === "text" ? b.text : "")).join("");
  return extractJson(text) as DetailedResult;
}

export async function POST(req: NextRequest) {
  let body: { mode?: string; nehnutelnost_id?: string; url?: string; data?: Record<string, unknown>; makler_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  const { mode, nehnutelnost_id, url, data, makler_id } = body;
  if (!mode) return NextResponse.json({ error: "mode required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  try {
    if (mode === "quick" || mode === "detailed") {
      if (!nehnutelnost_id) return NextResponse.json({ error: "nehnutelnost_id required for mode quick/detailed" }, { status: 400 });
      const { data: n } = await sb.from("nehnutelnosti").select("*").eq("id", nehnutelnost_id).single();
      if (!n) return NextResponse.json({ error: "Nehnutelnost nenajdena" }, { status: 404 });

      const input = {
        typ: String(n.typ || ""),
        plocha: n.plocha ? Number(n.plocha) : undefined,
        izby: n.izby ? Number(n.izby) : undefined,
        lokalita: String(n.lokalita || ""),
        cena: n.cena ? Number(n.cena) : undefined,
        nazov: String(n.nazov || ""),
        popis: String(n.popis || ""),
        stav: String(n.stav || ""),
      };

      if (mode === "quick") {
        const result = await quickAnalyze(input);
        const { data: ins } = await sb.from("analyzy_nehnutelnosti").insert({
          nehnutelnost_id, typ: "quick_weekly", makler_id: makler_id || null,
          vstup: input,
          odhadovana_cena_eur: result.odhadovana_cena_eur,
          odporucany_cas_topovania_dni: result.odporucany_cas_topovania_dni,
          analyza_text: result.kratke_zdovodnenie,
        }).select().single();
        return NextResponse.json({ analyza: ins, result });
      } else {
        const result = await detailedAnalyze(input);
        const { data: ins } = await sb.from("analyzy_nehnutelnosti").insert({
          nehnutelnost_id, typ: "detailed", makler_id: makler_id || null,
          vstup: input,
          odhadovana_cena_eur: result.odhadovana_cena_eur,
          analyza_text: result.analyza_text,
          konkurencia: result.konkurencia,
          meta: { cena_min: result.cena_min, cena_max: result.cena_max, postup: result.postup, zdovodnenie: result.zdovodnenie },
        }).select().single();
        return NextResponse.json({ analyza: ins, result });
      }
    }

    if (mode === "from_link") {
      if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
      const result = await analyzeFromUrl(url);
      const { data: ins } = await sb.from("analyzy_nehnutelnosti").insert({
        typ: "from_link", makler_id: makler_id || null,
        vstup: { url },
        odhadovana_cena_eur: result.odhadovana_cena_eur,
        analyza_text: result.analyza_text,
        konkurencia: result.konkurencia,
        meta: { cena_min: result.cena_min, cena_max: result.cena_max, postup: result.postup, zdovodnenie: result.zdovodnenie, url },
      }).select().single();
      return NextResponse.json({ analyza: ins, result });
    }

    if (mode === "from_data") {
      if (!data) return NextResponse.json({ error: "data required" }, { status: 400 });
      const result = await detailedAnalyze({
        typ: String(data.typ || ""),
        plocha: data.plocha ? Number(data.plocha) : undefined,
        izby: data.izby ? Number(data.izby) : undefined,
        lokalita: String(data.lokalita || ""),
        cena: data.cena ? Number(data.cena) : undefined,
        nazov: String(data.nazov || ""),
        popis: String(data.popis || ""),
        stav: String(data.stav || ""),
      });
      const { data: ins } = await sb.from("analyzy_nehnutelnosti").insert({
        typ: "from_data", makler_id: makler_id || null,
        vstup: data,
        odhadovana_cena_eur: result.odhadovana_cena_eur,
        analyza_text: result.analyza_text,
        konkurencia: result.konkurencia,
        meta: { cena_min: result.cena_min, cena_max: result.cena_max, postup: result.postup, zdovodnenie: result.zdovodnenie },
      }).select().single();
      return NextResponse.json({ analyza: ins, result });
    }

    return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
  } catch (e) {
    console.error("[analyzy] error:", e);
    return NextResponse.json({ error: String(e).slice(0, 500) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const nehnId = req.nextUrl.searchParams.get("nehnutelnost_id");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 20), 100);
  const sb = getSupabaseAdmin();
  let q = sb.from("analyzy_nehnutelnosti").select("*").order("created_at", { ascending: false }).limit(limit);
  if (nehnId) q = q.eq("nehnutelnost_id", nehnId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ analyzy: data || [] });
}
