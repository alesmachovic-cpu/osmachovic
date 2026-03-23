import { NextRequest, NextResponse } from "next/server";

const VIANEMA_SYSTEM = `Si elitný realitný copywriter pre značku VIANEMA. Tvojou úlohou je napísať text inzerátu v "Apple štýle" – minimalistický, prémiový, bez klišé, so zameraním na svetlo, materiály a emóciu bývania.

TVOJ VZOR (Kvalita a štruktúra):
Inšpiruj sa týmto štýlom: "Interiér je príkladom praktického využitia priestoru. Dubové podlahy dodávajú teplý pocit, zatiaľ čo zasklená fínska loggia poskytuje priestor na relaxáciu. Lokalita na Robotníckej ponúka rovnováhu medzi mestským životom a pokojom."

STRIKTNÉ PRAVIDLÁ:
- ŽIADNE NADPISY: Nepíš cenu, lokalitu ani "IBA U NÁS" do generovaného textu. To robí systém.
- ŽIADNY PÁTOS: Vyhni sa slovám ako "úžasný", "rozprávkový", "ponúkame vám". Píš vecne a elegantne.
- JAZYK: Profesionálna slovenčina, 3. osoba.
- Píš konkrétne o materiáloch, svetle, dispozícii a emócii bývania.`;

const USER_PROMPT = (details: string, locationInfo: string) => `Na základe týchto údajov vygeneruj text inzerátu:

${details}

${locationInfo ? `INFORMÁCIE O LOKALITE (z prieskumu):\n${locationInfo}\n` : ""}
POVINNÁ ŠTRUKTÚRA — vráť IBA JSON v tomto formáte:
{
  "nazov": "Krátky, výstižný názov inzerátu max 60 znakov. Formát: typ nehnuteľnosti + hlavný benefit + lokalita. Napr: '3-izbový byt s terasou, Ružinov' alebo 'Moderný rodinný dom, Koliba'. BEZ ceny, BEZ 'na predaj'.",
  "emotivny": "TRI ODSEKY: 1) Interiér (materiály, svetelnosť, dispozícia) 2) Bytový dom/Budova (stav, atmosféra, pridaná hodnota) 3) Lokalita (poloha, vybavenosť, okolie — POUŽI údaje z prieskumu lokality ak sú k dispozícii). Potom 4 odrážky s kľúčovými benefitmi. Na konci: SEP_SEO [5 slov] a SEP_TAGS [5 hashtagov]. Elegantný Apple štýl, 150-200 slov.",
  "technicky": "Technický text so zameraním na parametre, rekonštrukciu, výmery, orientáciu, energetiku. Konkrétne fakty a čísla. 100-150 slov.",
  "kratky": "Max 3 vety pre Facebook/Instagram. Výrazný, minimalistický, prémiový tón."
}`;

function extractJSON(raw: string): Record<string, string> {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return {};
  try { return JSON.parse(jsonMatch[0]); } catch { return {}; }
}

/* ── Gemini: research location ── */
async function researchLocation(lokalita: string): Promise<string> {
  if (!lokalita?.trim() || !process.env.GEMINI_API_KEY) return "";
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Si realitný analytik. Pre lokalitu "${lokalita}" na Slovensku napíš stručný prehľad občianskej vybavenosti a okolia. Zahrň:
- Doprava (MHD, zastávky, diaľnica, vlak)
- Školy a škôlky v okolí
- Obchody a nákupné centrá
- Zdravotníctvo (nemocnica, poliklinika, lekáreň)
- Šport a relax (parky, ihriská, fitness)
- Reštaurácie a kaviarne
- Celkový charakter lokality (tichá/rušná, rodinná, mestská)

Píš stručne, konkrétne fakty, max 150 slov. Slovenčina.`
            }]
          }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
        }),
      }
    );
    if (!res.ok) return "";
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  } catch { return ""; }
}

/* ── Fallback: research via GPT ── */
async function researchLocationGPT(lokalita: string): Promise<string> {
  if (!lokalita?.trim() || !process.env.OPENAI_API_KEY) return "";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o", temperature: 0.3, max_tokens: 500,
        messages: [{ role: "user", content: `Si realitný analytik. Pre lokalitu "${lokalita}" na Slovensku napíš stručný prehľad občianskej vybavenosti (doprava, školy, obchody, zdravotníctvo, šport, charakter). Max 150 slov, slovenčina.` }],
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  } catch { return ""; }
}

/* ── Claude: generate text ── */
async function generateClaude(details: string, locationInfo: string): Promise<Record<string, string>> {
  if (!process.env.ANTHROPIC_API_KEY) return {};
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: VIANEMA_SYSTEM,
      messages: [{ role: "user", content: USER_PROMPT(details, locationInfo) }],
    });
    const raw = (msg.content[0] as { type: string; text: string }).text.trim();
    return extractJSON(raw);
  } catch (e) {
    console.error("[ai-writer] Claude failed:", e);
    return {};
  }
}

/* ── GPT: generate text ── */
async function generateGPT(details: string, locationInfo: string): Promise<Record<string, string>> {
  if (!process.env.OPENAI_API_KEY) return {};
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o", temperature: 0.7, max_tokens: 2000,
        messages: [
          { role: "system", content: VIANEMA_SYSTEM },
          { role: "user", content: USER_PROMPT(details, locationInfo) },
        ],
      }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || "";
    return extractJSON(raw);
  } catch (e) {
    console.error("[ai-writer] GPT failed:", e);
    return {};
  }
}

/* ── Gemini: generate text (fallback) ── */
async function generateGemini(details: string, locationInfo: string): Promise<Record<string, string>> {
  if (!process.env.GEMINI_API_KEY) return {};
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: VIANEMA_SYSTEM }] },
          contents: [{ parts: [{ text: USER_PROMPT(details, locationInfo) }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
        }),
      }
    );
    if (!res.ok) return {};
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    return extractJSON(raw);
  } catch (e) {
    console.error("[ai-writer] Gemini failed:", e);
    return {};
  }
}

/* ── Combine best from two results ── */
async function combineBest(
  a: Record<string, string>,
  b: Record<string, string>,
  details: string
): Promise<Record<string, string>> {
  if (!a.emotivny && !b.emotivny) return a;
  if (!b.emotivny) return a;
  if (!a.emotivny) return b;

  // Try Claude for combining
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: `Si editor pre značku VIANEMA. Skombinuj dva návrhy do jedného. Apple-like štýl. Slovenčina.`,
        messages: [{
          role: "user",
          content: `Údaje: ${details}\n\nNÁVRH A:\n${a.emotivny}\n\nNÁVRH B:\n${b.emotivny}\n\nVráť IBA JSON:\n{"nazov":"max 60 znakov","emotivny":"skombinovaný text 150-200 slov so SEP_SEO a SEP_TAGS","technicky":"100-150 slov","kratky":"max 3 vety"}`
        }],
      });
      const raw = (msg.content[0] as { type: string; text: string }).text.trim();
      const result = extractJSON(raw);
      if (result.emotivny) return result;
    } catch (e) {
      console.error("[ai-writer] Claude combine failed:", e);
    }
  }

  // Fallback: GPT for combining
  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: "gpt-4o", temperature: 0.5, max_tokens: 2000,
          messages: [
            { role: "system", content: `Si editor pre značku VIANEMA. Skombinuj dva návrhy do jedného. Apple-like štýl. Slovenčina.` },
            { role: "user", content: `NÁVRH A:\n${a.emotivny}\n\nNÁVRH B:\n${b.emotivny}\n\nVráť IBA JSON:\n{"nazov":"max 60 znakov","emotivny":"skombinovaný text","technicky":"technický text","kratky":"max 3 vety"}` },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content?.trim() || "";
        const result = extractJSON(raw);
        if (result.emotivny) return result;
      }
    } catch (e) {
      console.error("[ai-writer] GPT combine failed:", e);
    }
  }

  return a.emotivny?.length > (b.emotivny?.length || 0) ? a : b;
}

/* ══════ MAIN HANDLER ══════ */
export async function POST(req: NextRequest) {
  const { nazov, typ, lokalita, cena, plocha, izby, stav, popis } = await req.json();

  const details = [
    nazov && `Nehnuteľnosť: ${nazov}`,
    typ && `Typ: ${typ}`,
    lokalita && `Lokalita: ${lokalita}`,
    cena && `Cena: ${cena} €`,
    plocha && `Plocha: ${plocha} m²`,
    izby && `Izby: ${izby}`,
    stav && `Stav: ${stav}`,
    popis && `Detaily:\n${popis}`,
  ].filter(Boolean).join("\n");

  try {
    // Step 1: Research location (Gemini → GPT fallback)
    let locationInfo = await researchLocation(lokalita);
    if (!locationInfo) locationInfo = await researchLocationGPT(lokalita);

    // Step 2: Generate text with all available AIs in parallel
    const [claude, gpt, gemini] = await Promise.all([
      generateClaude(details, locationInfo),
      generateGPT(details, locationInfo),
      generateGemini(details, locationInfo),
    ]);

    console.log(`[ai-writer] Results — Claude: ${!!claude.emotivny}, GPT: ${!!gpt.emotivny}, Gemini: ${!!gemini.emotivny}`);

    // Step 3: Pick the best results and combine
    const results = [
      { name: "Claude", data: claude },
      { name: "GPT", data: gpt },
      { name: "Gemini", data: gemini },
    ].filter(r => !!r.data.emotivny);

    let final: Record<string, string>;

    if (results.length >= 2) {
      final = await combineBest(results[0].data, results[1].data, details);
    } else if (results.length === 1) {
      final = results[0].data;
    } else {
      return NextResponse.json({ error: "Žiadna AI nedokázala vygenerovať text. Skontroluj API kľúče." }, { status: 500 });
    }

    return NextResponse.json({
      ...final,
      _meta: {
        location_research: !!locationInfo,
        claude_ok: !!claude.emotivny,
        gpt_ok: !!gpt.emotivny,
        gemini_ok: !!gemini.emotivny,
      },
    });
  } catch (err) {
    console.error("[ai-writer] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
