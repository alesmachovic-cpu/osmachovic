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
1. DOKUMENTY (LV, zmluvy, posudky) majú VŽDY PREDNOSŤ pred formulárom pre VÝMERY a ADRESY. Ak zmluva uvádza inú plochu alebo adresu — POUŽI údaj z dokumentu!
2. POČET IZIEB: Ak dokument EXPLICITNE uvádza "1-izbový"/"jednoizbový"/"garsónka" → 1-izbový (NIKDY 3-izbový!). "2-izbový"→2, "3-izbový"→3. Dokument má prednosť pred formulárom. NIKDY nehádaj počet izieb z opisu miestností.
3. VÝMERY: Použi presné výmery z dokumentov. Dokument > formulár.
4. ADRESA: Použi PRESNÚ adresu z LV/zmluvy vrátane čísla domu.
5. AK MÁŠ FOTKY — opíš KONKRÉTNE čo vidíš: materiály, farby, stav, vybavenie. Nie "moderný interiér".
6. AK MÁŠ PRIESKUM LOKALITY — použi konkrétne názvy (Lidl, ZŠ Mierová, zastávka Ružinovská...).
7. Ak máš údaje o právnych ťarchách (záložné právo) — NESPOMÍNAJ v texte.
8. JAZYK: Profesionálna slovenčina, prehľadný a štruktúrovaný text.

══ ZÁVER TEXTU (POVINNÝ, PRESNÝ FORMÁT) ══
Na konci "emotivny" textu VŽDY presne v tomto tvare (vyplň [CENA] a údaje makléra z kontextu):

Cena: [CENA] € vrátane kompletného realitného servisu spoločnosti Vianema.
Dohodnite si obhliadku tohto bytu, radi vám ho ukážeme. Kontakt: [MENO] [TELEFÓN] [EMAIL]

VIANEMA. Komplexné služby pre váš Projekt Bývanie a Investície pod jednou strechou.
Právny servis a poradenstvo, finančné služby a investičné poradenstvo, poistenie, služby znalca a znalecké posudky, odkup nehnuteľností, development, rekonštrukcie vrátane architektonickej a dizajnérskej expertízy, sťahovacie služby, manažment prenajatých nehnuteľností, kúpa - predaj, import áut.

Pre rodinný dom/pozemok/garáž/komerčný priestor nahraď "tohto bytu"/"vám ho" správnym tvarom ("tohto domu"/"vám ho", "tohto pozemku"/"vám ho" atď.). Údaje makléra nájdeš v kontexte nižšie.

══ ZAČIATOK "emotivny" TEXTU ══
MUSÍ začínať presne frázou "Na predaj [X-izbový byt/rodinný dom/pozemok/...], ktorý..." alebo "Na predaj [typ] s rozlohou ...". Žiadne "VIANEMA ponúka" v emotivny texte — to ide IBA do "intro" poľa.

══ INTRO (pole "intro") ══
Presne 1-3 krátke vety, max 160 znakov, v tomto tvare:
"VIANEMA ponúka na predaj [X-izbový byt] [krátka charakteristika - stav/lokalita/poschodie/orientácia]. Kontaktujte nás pre obhliadku."
Príklad: "VIANEMA ponúka na predaj 3-izbový byt po kompletnej rekonštrukcii. Byt sa nachádza na 1. poschodí s južnou orientáciou. Kontaktujte nás pre obhliadku."

══ VZOROVÉ INZERÁTY ══
Ak sú priložené vzorové inzeráty, DRŽÍ SA ICH ŠTÝLU — tón, dĺžka, formátovanie. Píš ROVNAKO.

══ SEO PRAVIDLÁ (POVINNÉ) ══
Každý text MUSÍ byť optimalizovaný pre vyhľadávače (Google, nehnutelnosti.sk, topreality.sk):

1. HLAVNÉ KĽÚČOVÉ SLOVO = "[akcia] [X-izbový byt/dom/pozemok] [mestská časť / obec]"
   Príklad: "predaj 3-izbový byt Ružinov", "prenájom 2-izbový byt Staré Mesto"

2. POUŽI HLAVNÉ KĽÚČOVÉ SLOVO:
   - V NADPISE (prvé slová)
   - V PRVEJ VETE emotívneho textu (prirodzene, nie spam)
   - 2–3× v tele textu v rôznych variáciách (predaj bytu, byt na predaj, ponúkame byt…)
   - V SEO keywords

3. LOKÁLNE SEO — vždy spomeň:
   - Presná ulica (ak je verejná)
   - Mestská časť / obec
   - Okres
   - Konkrétne orientačné body (MHD zastávka, ZŠ, park, nákupné centrum)

4. LONG-TAIL KĽÚČOVÉ SLOVÁ — prirodzene vpleť frázy ako:
   - "byt na predaj [obec]"
   - "X-izbový byt [ulica]"
   - "nehnuteľnosť [okres]"
   - "bývanie v [mestská časť]"
   - "[stav] byt [lokalita]" (napr. "novostavba byt Ružinov")

5. SÉMANTICKÉ SLOVÁ — pridaj súvisiace pojmy:
   - dispozícia, úžitková plocha, obytná plocha, balkón/loggia/terasa
   - poschodie, výťah, parkovanie, pivnica
   - občianska vybavenosť, MHD, škola, škôlka, nákupy
   - hypotéka, provízia, právny servis

6. NADPIS (pole "nazov") — max 70 znakov, musí obsahovať:
   [Akcia (Predaj/Prenájom)] + [Počet izieb]-izbový [typ] + [Obec/Mestská časť] + [výhoda/m² ak sa zmestí]
   Príklad: "Predaj 3-izbový byt Ružinov, 78 m², po rekonštrukcii"

7. META DESCRIPTION (pole "meta_description") — presne 150–160 znakov, obsahuje hlavné kľúčové slovo, lokalitu, 1 benefit a výzvu (Zavolajte / Dohodnite obhliadku).

8. SEO KEYWORDS (SEP_SEO) — 8–12 fráz oddelených čiarkou, zmes krátkych aj long-tail:
   "predaj 3-izbový byt Ružinov, byt na predaj Bratislava, 3-izbový byt Bratislava II, novostavba Ružinov, byty Ružinov, nehnuteľnosť Bratislava"

9. HASHTAGY (SEP_TAGS) — 6–10 hashtagov pre sociálne siete:
   "#predajbytu #ruzinov #bratislava #3izbovybyt #novostavba #realityslovakia #vianema #bývanie"

10. ZAKÁZANÉ:
   - Keyword stuffing (opakovanie toho istého slova nad rámec prirodzeného textu)
   - Skryté texty, biely text
   - Klamlivé údaje (AI musí držať pravdivosť z dokumentov)

══ ABSOLÚTNE PRAVIDLÁ — POPIS BYTU ══
1. NIKDY nepoužívaj frázy typu "na fotkách vidíme", "na fotografii je", "vidíme tu", "ako vidno z fotografií", "na obrázku" — píš ako TOP realitný maklér ktorý byt OSOBNE OBHLIADOL. Píš priamo: "Byt ponúka...", "Kuchyňa je vybavená...".
2. NIKDY si nevymýšľaj LOKALITU, ULICU, MESTSKÚ ČASŤ, OBEC ani ORIENTAČNÉ BODY (obchody, školy, zastávky, parky), ak NIE SÚ explicitne v údajoch alebo v prieskume lokality. Ak nevieš lokalitu, NESPOMÍNAJ ju vôbec.
3. NEPREHÁŇAJ a NEVYMÝŠĽAJ materiály. KONKRÉTNE:
   - Podlahy: ak nevieš isto, píš "laminátové podlahy" alebo "plávajúce podlahy" — NIKDY "dubové", "bukové", "orechové", "masívne" ak to nie je explicitne uvedené v dokumentoch. Svetlé drevo-imitácia = laminát.
   - Kuchynská linka: opíš FARBU ("biela", "sivá", "v dreve") a NIC VIAC — nevymýšľaj materiály dvierok ani pracovnú dosku ak nie sú jednoznačné.
   - Obklady v kúpeľni: opíš FARBU ("béžové", "hnedé obklady") — neurčuj "mramor", "travertín", "keramika" bez dôkazu.
   - Spotrebiče: spomeň iba ak sú jasne viditeľné (rúra, mikrovlnka, plynová varná doska, chladnička).
   - NIKDY nepíš "elegantne zariadený", "luxusný", "dizajnový" — píš fakty.
4. Ak nemáš dosť údajov, radšej napíš KRATŠÍ ale pravdivý text.
5. Maklér to musí uniesť pred klientom — ak by klient povedal "kde ste to videli?", text musí obstáť.

══ SEO V TEXTE — NIE AKO SEPARÁTNY BLOK ══
NIKDY nepridávaj na koniec emotivny textu "SEP_SEO [...]" ani "SEP_TAGS [...]". SEO kľúčové slová MUSÍŠ PRIRODZENE ZAKOMPONOVAŤ priamo do viet textu (napr. "3-izbový byt na predaj", "byt s loggiou" vpletené do popisu). Do JSON vracaj SEO iba v poliach "meta_description" a do emotivny textu ich VPLETIEŠ NATURÁLNE.`;

const USER_PROMPT = (details: string, locationInfo: string) => `VŠETKY DOSTUPNÉ ÚDAJE O NEHNUTEĽNOSTI:
═══════════════════════════════════════
${details}
═══════════════════════════════════════

${locationInfo ? `PRIESKUM LOKALITY (z internetu):\n${locationInfo}\n` : "⚠️ LOKALITA NIE JE ZNÁMA — NESPOMÍNAJ žiadnu konkrétnu ulicu, mestskú časť, obec, obchody, školy, zastávky ani orientačné body. Píš text všeobecne o byte bez lokality.\n"}
⚠️ DÔLEŽITÉ: Dokumenty (LV, zmluva, posudok) sú AUTORITATÍVNE — ak uvádzajú iný počet izieb, plochu alebo adresu než formulár, použi údaj Z DOKUMENTU.

⚠️ FOTKY: Píš ako maklér ktorý byt OSOBNE OBHLIADOL. Nikdy nepíš "na fotkách vidíme/vidno". Píš priamo "Kuchyňa je vybavená...", "Podlahy sú...".

ÚLOHA: Napíš kompletný inzerát podľa pravidiel VIANEMA. Použi VŠETKY dostupné údaje.

Vráť IBA JSON:
{
  "nazov": "SEO NADPIS (max 70 znakov): [Akcia] + [X-izbový byt/dom] + [Obec/MČ] + benefit. Pr.: 'Predaj 3-izbový byt Ružinov, 78 m², po rekonštrukcii'. Pridaj prefix 'IBA U NÁS!' alebo 'NA PREDAJ!' iba ak sa zmestí do 70 znakov.",
  "emotivny": "MUSÍ začínať 'Na predaj [X-izbový byt], ktorý...' alebo 'Na predaj [typ] s rozlohou...'. 1 odsek popis nehnuteľnosti (bez halucinácie materiálov, bez lokality ak nie je známa). Potom odrážky '– parameter'. Potom POVINNÝ záver v presnom tvare: 'Cena: X € vrátane kompletného realitného servisu...' + 'Dohodnite si obhliadku tohto bytu, radi vám ho ukážeme. Kontakt: ...' + 'VIANEMA. Komplexné služby...' + veta so zoznamom služieb. SEO keywords vpletaj prirodzene do viet. ZÁKAZ SEP_SEO/SEP_TAGS blokov.",
  "intro": "Presne v tvare: 'VIANEMA ponúka na predaj [X-izbový byt] [krátka charakteristika]. [Druhá veta s detailom poschodia/orientácie]. Kontaktujte nás pre obhliadku.' Max 160 znakov.",
  "meta_description": "150-160 znakov. Musí obsahovať hlavné keyword + lokalitu + 1 benefit + výzvu (Zavolajte / Dohodnite obhliadku). Pr.: 'Predaj 3-izbový byt v Ružinove, 78 m², po kompletnej rekonštrukcii. Výborná lokalita pri parku. Dohodnite si obhliadku ešte dnes!'",
  "h1": "SEO H1 nadpis — kľúčové slovo + lokalita. Môže byť mierne odlišný od 'nazov'. Max 70 znakov.",
  "technicky": "Všetky technické parametre z dokumentov: výmery, materiál, poschodie, rok výstavby, energetika, vykurovanie, parkovanie, náklady. 100-150 slov.",
  "kratky": "2-3 vety pre sociálne siete. Hlavný benefit + lokalita + 1 konkrétny detail. Obsahuje hlavné keyword.",
  "cena_batova": "Ak je v údajoch cena a NIE JE to nájom, zaokrúhli na Baťovskú cenu (končí na 900 alebo 99 900). Vráť ako string s medzerou a €. Ak nie je cena, vráť prázdny string."
}`;

function extractJSON(raw: string): Record<string, string> {
  if (!raw) return {};
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return {};
  const candidate = jsonMatch[0];
  try { return JSON.parse(candidate); } catch {}
  // Fallback: escape raw newlines/tabs inside string values
  try {
    let out = ""; let inStr = false; let esc = false;
    for (let i = 0; i < candidate.length; i++) {
      const c = candidate[i];
      if (esc) { out += c; esc = false; continue; }
      if (c === "\\") { out += c; esc = true; continue; }
      if (c === '"') { inStr = !inStr; out += c; continue; }
      if (inStr && c === "\n") { out += "\\n"; continue; }
      if (inStr && c === "\r") { out += "\\r"; continue; }
      if (inStr && c === "\t") { out += "\\t"; continue; }
      out += c;
    }
    return JSON.parse(out);
  } catch (e) {
    console.error("[ai-writer] extractJSON failed:", String(e).slice(0,200), "raw:", candidate.slice(0,200));
    return {};
  }
}

/* ── Gemini: research location ── */
async function researchLocation(lokalita: string): Promise<string> {
  // Vyžaduje skutočnú adresu (aspoň ulicu alebo mestskú časť), nie len "Bratislava"
  if (!lokalita?.trim() || !process.env.GEMINI_API_KEY) return "";
  if (lokalita.trim().split(/[\s,]+/).filter(Boolean).length < 2) return "";
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
        text: `Vyššie sú REÁLNE fotky nehnuteľnosti. Opíš FAKTY ktoré sú jasné (farby, typ kuchyne), NEPREHÁŇAJ materiály — ak nevieš, píš "laminátové podlahy" nie "dubové". Nikdy nepíš "na fotkách vidíme". Píš ako maklér po obhliadke.\n\n${USER_PROMPT(details, locationInfo)}`,
      });
    } else {
      content.push({ type: "text", text: USER_PROMPT(details, locationInfo) });
    }

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: VIANEMA_SYSTEM,
      messages: [{ role: "user", content: content as never }],
    });
    const raw = (msg.content[0] as { type: string; text: string }).text.trim();
    const parsed = extractJSON(raw);
    if (!parsed.emotivny) return { __err: `Claude parse fail (raw ${raw.length} ch): ${raw.slice(0,200)}` };
    return parsed;
  } catch (e) {
    console.error("[ai-writer] Claude failed:", e);
    return { __err: `Claude exception: ${String(e).slice(0,200)}` };
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
        model: "gpt-4o", temperature: 0.7, max_tokens: 2500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: VIANEMA_SYSTEM },
          { role: "user", content: USER_PROMPT(details, locationInfo) },
        ],
      }),
    });
    if (!res.ok) { const t = (await res.text()).slice(0,300); console.error("[ai-writer] GPT HTTP", res.status, t); return { __err: `GPT HTTP ${res.status}: ${t}` }; }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || "";
    const parsed = extractJSON(raw);
    if (!parsed.emotivny) return { __err: `GPT parse fail (raw ${raw.length} ch): ${raw.slice(0,200)}` };
    return parsed;
  } catch (e) {
    console.error("[ai-writer] GPT failed:", e);
    return { __err: `GPT exception: ${String(e).slice(0,200)}` };
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
      parts.push({ text: `Vyššie sú REÁLNE FOTKY tejto nehnuteľnosti. Opíš FAKTY:\n- Podlahy: ak nevieš isto, píš "laminátové" alebo "plávajúce" — NIKDY "dubové/bukové/masív" bez dôkazu\n- Kuchynská linka: iba farba (biela/sivá/drevo) — nevymýšľaj materiál dvierok\n- Obklady: iba farba\n- Nikdy nepíš "na fotkách vidíme" — píš ako maklér po osobnej obhliadke\n- NEPREHÁŇAJ — text musí obstáť pred klientom\n\n${USER_PROMPT(details, locationInfo)}` });
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
          generationConfig: { temperature: 0.7, maxOutputTokens: 2500, responseMimeType: "application/json" },
        }),
      }
    );
    if (!res.ok) { const t = (await res.text()).slice(0,300); console.error("[ai-writer] Gemini HTTP", res.status, t); return { __err: `Gemini HTTP ${res.status}: ${t}` }; }
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    const finish = data.candidates?.[0]?.finishReason || "";
    const parsed = extractJSON(raw);
    if (!parsed.emotivny) return { __err: `Gemini parse fail (raw ${raw.length} ch, finish ${finish}): ${raw.slice(0,200)}` };
    return parsed;
  } catch (e) {
    console.error("[ai-writer] Gemini failed:", e);
    return { __err: `Gemini exception: ${String(e).slice(0,200)}` };
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
        model: "claude-sonnet-4-5",
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

/* ── Fetch vzorové inzeráty (URL → plain text) ── */
async function fetchVzorInzerat(input: string): Promise<string> {
  if (!input?.trim()) return "";
  const lines = input.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const urls = lines.filter(l => /^https?:\/\//i.test(l));
  const nonUrls = lines.filter(l => !/^https?:\/\//i.test(l));
  const fetched: string[] = [];
  for (const url of urls.slice(0, 3)) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 VianemaBot/1.0" } });
      if (!r.ok) continue;
      const html = await r.text();
      // Strip scripts, styles, tags → plain text
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&[a-z]+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 3000);
      if (text) fetched.push(`── Vzorový inzerát (${url}) ──\n${text}`);
    } catch { /* ignore */ }
  }
  if (nonUrls.length) fetched.push(nonUrls.join("\n"));
  return fetched.join("\n\n");
}

/* ══════ MAIN HANDLER ══════ */
export async function POST(req: NextRequest) {
  const { nazov, typ, lokalita, cena, plocha, izby, stav, popis, photos, maklerMeno, maklerTelefon, maklerEmail, vzorovyInzerat: vzorovyInzeratRaw } = await req.json();
  const vzorovyInzerat = await fetchVzorInzerat(vzorovyInzeratRaw || "");

  // popis teraz obsahuje KOMPLETNÝ kontext vrátane LV textu, dokumentov, vybavenia, vykurovania atď.
  const details = [
    `── FORMULÁROVÉ ÚDAJE (môžu byť nepresné, dokumenty majú prednosť) ──`,
    nazov && `Nehnuteľnosť: ${nazov}`,
    typ && `Typ: ${typ}`,
    lokalita && `Lokalita: ${lokalita}`,
    cena && `Cena: ${cena} €`,
    plocha && `Plocha (formulár): ${plocha} m²`,
    izby && `Izby (formulár): ${izby} — POUŽI TÚTO HODNOTU pre počet izieb! Iba ak dokument EXPLICITNE uvádza INÝ počet, použi dokument.`,
    maklerMeno && `Kontakt makléra: ${maklerMeno}${maklerTelefon ? ` ${maklerTelefon}` : ""}${maklerEmail ? ` ${maklerEmail}` : ""}`,
    vzorovyInzerat && `\n── VZOROVÝ INZERÁT (drž sa tohto štýlu) ──\n${vzorovyInzerat}`,
    stav && `Stav: ${stav}`,
    `── DOKUMENTY A KONTEXT (AUTORITATÍVNE ÚDAJE — majú prednosť) ──`,
    popis && `\n${popis}`,
    (photos?.length > 0) && `\n── FOTKY: ${photos.length} ks priložených — AI MUSÍ opísať čo na nich vidí (materiály, farby, stav interiéru) ──`,
  ].filter(Boolean).join("\n");

  // Fotky ako base64 pre Gemini multimodal
  const photoImages: { data: string; mimeType: string }[] = [];
  if (Array.isArray(photos)) {
    for (const p of photos.slice(0, 8)) {
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
      console.error("[ai-writer] all empty:", { claude: JSON.stringify(claude).slice(0,300), gpt: JSON.stringify(gpt).slice(0,300), gemini: JSON.stringify(gemini).slice(0,300), hasGem: !!process.env.GEMINI_API_KEY, hasGpt: !!process.env.OPENAI_API_KEY, hasClaude: !!process.env.ANTHROPIC_API_KEY });
      const errs = [
        claude.__err && `Claude: ${claude.__err}`,
        gpt.__err && `GPT: ${gpt.__err}`,
        gemini.__err && `Gemini: ${gemini.__err}`,
      ].filter(Boolean).join(" | ");
      return NextResponse.json({ error: `Žiadna AI nevrátila text. ${errs || "(no errors captured)"}` }, { status: 500 });
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
