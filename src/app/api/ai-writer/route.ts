import { NextRequest, NextResponse } from "next/server";

const VIANEMA_SYSTEM = `Si profesionálny realitný copywriter pre realitnú kanceláriu VIANEMA (vianemareal.eu). Tvojou úlohou je tvoriť pútavé inzeráty, ktoré striktne dodržiavajú firemnú identitu a pravidlá inzercie.

══ POVINNÝ FORMÁT TEXTU ══

NADPIS (pole "nazov"):
- Výhradná ponuka: "IBA U NÁS! Na predaj X-izbový byt po kompletnej rekonštrukcii"
- Nevýhradná ponuka: "NA PREDAJ! X-izbový byt, Mestská časť" alebo "NA NÁJOM! ..."
- Príprava: "PRIPRAVUJEME na predaj X-izbový byt, Mestská časť"
- Ak nie je uvedený typ ponuky, použi "IBA U NÁS!"

PODNADPIS / ÚVOD TEXTU (pole "emotivny" — PRVÁ VETA):
Musí POVINNE začínať frázou:
- "VIANEMA ponúka na predaj ..."
- "VIANEMA ponúka na nájom ..."
- "VIANEMA pripravuje do ponuky na predaj ..."

══ ŠTÝL TEXTU ══

Po úvodnej vete nasleduje:
1. Odsek: Popis nehnuteľnosti — dispozícia, rozloha, stav, materiály. AK MÁŠ FOTKY, opíš KONKRÉTNE čo vidíš (farba podláh, kuchynská linka, obklady).
2. Odsek: Lokalita — PRESNÁ ulica, čo je v okolí (konkrétne názvy obchodov, škôl, MHD zastávok z prieskumu).

Potom ODRÁŽKY s technickými parametrami a výhodami:
– rozloha X m²
– kompletná rekonštrukcia (ak je)
– nové rozvody, stierky, podlahy (ak vieš z fotiek/dokumentov)
– vynikajúca lokalita / konkrétny benefit
– balkón/loggia/terasa s výmerou
– poschodie X z Y, výťah
– parkovanie, pivnica

Na záver: informácia o provízii a právnom servise (ak sú v údajoch).

══ BAŤOVSKÁ CENA ══
Predajné ceny (NIE nájom) zaokrúhli tak, aby končili na 900 alebo 99 900.
Príklad: 150 200 € → 150 900 €, 85 000 € → 84 900 €, 200 000 € → 199 900 €

══ KRITICKÉ PRAVIDLÁ ══
1. DOKUMENTY (LV, zmluvy, posudky) majú VŽDY PREDNOSŤ pred formulárom. Ak zmluva hovorí "2-izbový" a formulár "3-izbový" — POUŽI údaj z dokumentu!
2. POČET IZIEB: Ak dokument EXPLICITNE uvádza "X-izbový byt" alebo dispozíciu, použi údaj z dokumentu. Ak dokumenty NEOBSAHUJÚ počet izieb, POUŽI údaj z formulára (pole "Izby (formulár)")! NIKDY nehádaj počet izieb — ak máš z formulára "3", píš "3-izbový".
3. VÝMERY: Použi presné výmery z dokumentov. Dokument > formulár.
4. ADRESA: Použi PRESNÚ adresu z LV/zmluvy vrátane čísla domu.
5. AK MÁŠ FOTKY — opíš KONKRÉTNE čo vidíš: materiály, farby, stav, vybavenie. Nie "moderný interiér".
6. AK MÁŠ PRIESKUM LOKALITY — použi konkrétne názvy (Lidl, ZŠ Mierová, zastávka Ružinovská...).
7. Ak máš údaje o právnych ťarchách (záložné právo) — NESPOMÍNAJ v texte.
8. JAZYK: Profesionálna slovenčina, prehľadný a štruktúrovaný text.`;

const USER_PROMPT = (details: string, locationInfo: string) => `VŠETKY DOSTUPNÉ ÚDAJE O NEHNUTEĽNOSTI:
═══════════════════════════════════════
${details}
═══════════════════════════════════════

${locationInfo ? `PRIESKUM LOKALITY (z internetu):\n${locationInfo}\n` : ""}
⚠️ DÔLEŽITÉ: Dokumenty (LV, zmluva, posudok) sú AUTORITATÍVNE — ak uvádzajú iný počet izieb, plochu alebo adresu než formulár, použi údaj Z DOKUMENTU.

⚠️ FOTKY: Ak boli priložené, opíš KONKRÉTNE čo vidíš — materiály, farby, stav. Nie "moderný interiér".

ÚLOHA: Napíš kompletný inzerát podľa pravidiel VIANEMA. Použi VŠETKY dostupné údaje.

Vráť IBA JSON:
{
  "nazov": "NADPIS podľa pravidiel: 'IBA U NÁS! Na predaj X-izbový byt...' alebo 'NA PREDAJ! ...' Max 80 znakov. Počet izieb BER Z DOKUMENTOV. Ak nie je typ ponuky, použi 'IBA U NÁS!'",
  "emotivny": "MUSÍ začínať 'VIANEMA ponúka na predaj/nájom ...'. Potom 1-2 odseky (nehnuteľnosť + lokalita). Potom odrážky '– parameter/výhoda'. Na záver info o provízii ak je v údajoch. 200-300 slov. Na konci: SEP_SEO [5 slov] SEP_TAGS [5 hashtagov].",
  "technicky": "Všetky technické parametre z dokumentov: výmery, materiál, poschodie, rok výstavby, energetika, vykurovanie, parkovanie, náklady. 100-150 slov.",
  "kratky": "2-3 vety pre sociálne siete. Hlavný benefit + lokalita + 1 konkrétny detail.",
  "cena_batova": "Ak je v údajoch cena a NIE JE to nájom, zaokrúhli na Baťovskú cenu (končí na 900 alebo 99 900). Vráť ako string s medzerou a €. Ak nie je cena, vráť prázdny string."
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
              text: `Si realitný analytik. Mám nehnuteľnosť na adrese "${lokalita}". Napíš KONKRÉTNY prehľad okolia TEJTO ULICE/ADRESY:
- Čo je v bezprostrednom okolí (do 500m) — konkrétne názvy obchodov, škôl, reštaurácií
- Doprava — najbližšia zastávka MHD (meno), vzdialenosť do centra
- Charakter ulice a okolia — tichá/rušná, zeleň, parky v okolí (konkrétne názvy)
- Najbližšie nákupné centrum (názov)
- Zdravotníctvo v okolí

DÔLEŽITÉ: Píš o konkrétnej ulici/adrese "${lokalita}", nie o celej mestskej časti všeobecne.
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
        messages: [{ role: "user", content: `Si realitný analytik. Pre KONKRÉTNU adresu "${lokalita}" napíš čo je v bezprostrednom okolí tejto ulice — konkrétne názvy obchodov, škôl, MHD zastávok, parkov. Charakter ulice. Max 150 slov, slovenčina.` }],
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  } catch { return ""; }
}

/* ── Claude: generate text (with optional photos) ── */
async function generateClaude(details: string, locationInfo: string, images?: { data: string; mimeType: string }[]): Promise<Record<string, string>> {
  if (!process.env.ANTHROPIC_API_KEY) return {};
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Build multimodal content if photos available
    const content: Array<{ type: string; source?: { type: string; media_type: string; data: string }; text?: string }> = [];
    if (images && images.length > 0) {
      for (const img of images) {
        content.push({
          type: "image",
          source: { type: "base64", media_type: img.mimeType, data: img.data },
        });
      }
      content.push({
        type: "text",
        text: `Vyššie sú REÁLNE fotky nehnuteľnosti. Opíš v texte KONKRÉTNE čo vidíš — materiály, farby, stav.\n\n${USER_PROMPT(details, locationInfo)}`,
      });
    } else {
      content.push({ type: "text", text: USER_PROMPT(details, locationInfo) });
    }

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: VIANEMA_SYSTEM,
      messages: [{ role: "user", content: content as never }],
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

/* ── Gemini: generate text (with optional photos) ── */
async function generateGemini(details: string, locationInfo: string, images?: { data: string; mimeType: string }[]): Promise<Record<string, string>> {
  if (!process.env.GEMINI_API_KEY) return {};
  try {
    // Build parts: text + optional images
    const parts: Record<string, unknown>[] = [];
    // Add photos first so Gemini "sees" them
    if (images && images.length > 0) {
      for (const img of images) {
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      }
      parts.push({ text: `Vyššie sú REÁLNE FOTKY tejto nehnuteľnosti. MUSÍŠ ich použiť v texte:\n- Opíš KONKRÉTNE čo vidíš: farbu a typ podláh, kuchynskú linku (farba, materiál), obklady v kúpeľni, typ dverí, okien, svietidiel\n- Ak vidíš výhľad z okna — opíš ho\n- Ak vidíš stav rekonštrukcie — opíš konkrétne materiály\n- NEPÍŠ "moderný interiér" — píš "biela kuchynská linka s drevenou pracovnou doskou" ak to vidíš\n\n${USER_PROMPT(details, locationInfo)}` });
    } else {
      parts.push({ text: USER_PROMPT(details, locationInfo) });
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: VIANEMA_SYSTEM }] },
          contents: [{ parts }],
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
        system: `Si editor pre VIANEMA reality. Skombinuj dva návrhy do jedného. Text MUSÍ začínať "VIANEMA ponúka na predaj/nájom...". Použi odrážky pre parametre. Slovenčina.`,
        messages: [{
          role: "user",
          content: `Údaje: ${details}\n\nNÁVRH A:\n${a.emotivny}\n\nNÁVRH B:\n${b.emotivny}\n\nVráť IBA JSON:\n{"nazov":"IBA U NÁS! alebo NA PREDAJ! ... max 80 znakov","emotivny":"začni VIANEMA ponúka... + odrážky, 200-300 slov, SEP_SEO a SEP_TAGS","technicky":"100-150 slov","kratky":"max 3 vety"}`
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
            { role: "system", content: `Si editor pre VIANEMA reality. Skombinuj dva návrhy do jedného. Text MUSÍ začínať "VIANEMA ponúka...". Odrážky pre parametre. Slovenčina.` },
            { role: "user", content: `NÁVRH A:\n${a.emotivny}\n\nNÁVRH B:\n${b.emotivny}\n\nVráť IBA JSON:\n{"nazov":"IBA U NÁS! alebo NA PREDAJ! max 80 znakov","emotivny":"začni VIANEMA ponúka... + odrážky","technicky":"technický text","kratky":"max 3 vety"}` },
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
  const { nazov, typ, lokalita, cena, plocha, izby, stav, popis, photos } = await req.json();

  // popis teraz obsahuje KOMPLETNÝ kontext vrátane LV textu, dokumentov, vybavenia, vykurovania atď.
  const details = [
    `── FORMULÁROVÉ ÚDAJE (môžu byť nepresné, dokumenty majú prednosť) ──`,
    nazov && `Nehnuteľnosť: ${nazov}`,
    typ && `Typ: ${typ}`,
    lokalita && `Lokalita: ${lokalita}`,
    cena && `Cena: ${cena} €`,
    plocha && `Plocha (formulár): ${plocha} m²`,
    izby && `Izby (formulár): ${izby} — POZOR: ak dokumenty nižšie uvádzajú iný počet, použi údaj z dokumentov!`,
    stav && `Stav: ${stav}`,
    `── DOKUMENTY A KONTEXT (AUTORITATÍVNE ÚDAJE — majú prednosť) ──`,
    popis && `\n${popis}`,
    (photos?.length > 0) && `\n── FOTKY: ${photos.length} ks priložených — AI MUSÍ opísať čo na nich vidí (materiály, farby, stav interiéru) ──`,
  ].filter(Boolean).join("\n");

  // Fotky ako base64 pre Gemini multimodal
  const photoImages: { data: string; mimeType: string }[] = [];
  if (Array.isArray(photos)) {
    for (const p of photos.slice(0, 5)) {
      if (typeof p === "string" && p.startsWith("data:image/")) {
        const [header, b64] = p.split(",");
        const mime = header.match(/data:(image\/[^;]+)/)?.[1] || "image/jpeg";
        photoImages.push({ data: b64, mimeType: mime });
      }
    }
  }

  try {
    // Step 1: Research location (Gemini → GPT fallback)
    let locationInfo = await researchLocation(lokalita);
    if (!locationInfo) locationInfo = await researchLocationGPT(lokalita);

    // Step 2: Generate text with all available AIs in parallel (Gemini gets photos)
    const [claude, gpt, gemini] = await Promise.all([
      generateClaude(details, locationInfo, photoImages),
      generateGPT(details, locationInfo),
      generateGemini(details, locationInfo, photoImages),
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
