import { NextRequest, NextResponse } from "next/server";

const SYSTEM_LV = `Si precízny analytik realitných dokumentov. Tvojou úlohou je extrahovať dáta BEZ akýchkoľvek predpokladov alebo vymýšľania. Vráť IBA JSON bez markdown.

KRITICKÉ PRAVIDLÁ:
1. LOKALITA: Pozri sa na "k.ú." (katastrálne územie). Ak je tam napísané Petržalka, NESMIEŠ uviesť Staré Mesto. Použi PRESNE to čo je v dokumente.
2. VÝMERY: Hľadaj tabuľku s podlahovou plochou alebo vetu "Vypočítaná podlahová plocha je...". Uveď PRESNÉ číslo na dve desatinné miesta ak je uvedené.
3. ZÁKAZ HALUCINÁCIÍ: Ak údaj v dokumente NEVIDÍŠ, VYNECHAJ ho z JSON. Radšej prázdne pole ako lož. NIKDY nevymýšľaj údaje.`;

const SYSTEM_POSUDOK = `Si precízny analytik znaleckých posudkov nehnuteľností. Extrahuj VŠETKY technické údaje o nehnuteľnosti. Vráť IBA JSON bez markdown.

KRITICKÉ PRAVIDLÁ:
1. LOKALITA: Použi katastrálne územie (k.ú.) PRESNE ako je v dokumente. Neplieť si mestské časti.
2. PLOCHY: Hľadaj "vypočítaná podlahová plocha", tabuľku výmer, alebo rozpis miestností. Balkón/loggia/pivnica sa NEPOČÍTA do podlahovej plochy bytu.
3. CENA: Hľadaj VŠH (všeobecná hodnota nehnuteľnosti). Uprav na Baťovský formát (zaokrúhli na 1000, odčítaj 100).
4. STAV: Hľadaj opis technického stavu, materiálu, rekonštrukcií.
5. NÁKLADY: Hľadaj mesačné náklady, fond opráv, správu domu, energie.
6. ZÁKAZ HALUCINÁCIÍ: Ak údaj NEVIDÍŠ, VYNECHAJ z JSON. NIKDY nevymýšľaj.`;

const SYSTEM_ZMLUVA = `Si precízny analytik realitných zmlúv. Extrahuj údaje o nehnuteľnosti a podmienkach z kúpnej/nájomnej zmluvy. Vráť IBA JSON bez markdown.

KRITICKÉ PRAVIDLÁ:
1. LOKALITA: Použi adresu a katastrálne územie PRESNE z dokumentu.
2. CENA: Hľadaj kúpnu cenu alebo nájomné. Uprav na Baťovský formát.
3. ZÁKAZ HALUCINÁCIÍ: Ak údaj NEVIDÍŠ, VYNECHAJ z JSON. NIKDY nevymýšľaj.`;

function getSystem(docType?: string): string {
  if (docType === "posudok" || docType === "znalecký posudok") return SYSTEM_POSUDOK;
  if (docType === "zmluva") return SYSTEM_ZMLUVA;
  return SYSTEM_LV;
}

const USER_PROMPT = (text: string) => `Analyzuj tento realitný dokument. Extrahuj IBA údaje ktoré SKUTOČNE vidíš v texte. Vráť JSON:

{
  "typ": "byt alebo dom alebo pozemok alebo garaz alebo komercne",
  "obec": "PRESNÝ názov z dokumentu — použi k.ú. (katastrálne územie) ak je uvedené",
  "okres": "názov okresu PRESNE z dokumentu",
  "kraj": "názov kraja",
  "katastralneUzemie": "katastrálne územie presne ako je v dokumente (k.ú.)",
  "ulica": "ulica a orientačné číslo PRESNE z dokumentu",
  "cena": "VŠH alebo kúpna cena v Baťovskom formáte IBA číslo (zaokrúhli na tisícky a odčítaj 100: 150000→149900)",
  "plocha": "podlahová plocha bytu BEZ balkóna/loggie — PRESNÉ číslo z dokumentu (hľadaj 'podlahová plocha' alebo tabuľku výmer)",
  "uzitkova_plocha": "úžitková plocha ak je uvedená IBA číslo",
  "stav": "novostavba alebo povodny-stav alebo uplne-prerobeny alebo ciastocne-prerobeny alebo vo-vystavbe",
  "material": "tehla alebo panel alebo skelet alebo drevo alebo ine — PRESNE z dokumentu",
  "rok_kolaudacie": "rok začiatku užívania alebo kolaudácie IBA číslo",
  "rok_vystavby": "rok výstavby IBA číslo",
  "poschodie": "číslo poschodia IBA číslo",
  "izby": "počet izieb IBA číslo",
  "vytah": "true alebo false",
  "balkon": "true ak má balkón",
  "balkon_plocha": "plocha balkóna v m² PRESNÉ číslo",
  "loggia": "true ak má loggiu",
  "loggia_plocha": "plocha loggie v m² PRESNÉ číslo",
  "terasa": "true ak má terasu",
  "terasa_plocha": "plocha terasy v m² PRESNÉ číslo",
  "pivnica": "true ak má pivnicu/sklad",
  "pivnica_plocha": "plocha pivnice/skladu v m² PRESNÉ číslo",
  "garaz": "true ak má garáž alebo parkovacie státie",
  "parkovanie": "garaz alebo statie alebo ine",
  "vykurovanie": "centralne alebo lokalne alebo podlahove alebo kozub alebo ine",
  "klimatizacia": "true alebo false",
  "energeticky_certifikat": "A0/A1/A/B/C/D/E/F/G",
  "mesacne_naklady": "SÚČET mesačných nákladov v EUR IBA číslo (správa + fond opráv + energie)",
  "naklady_detail": "rozpis: správa X€, fond opráv X€, energie X€ — IBA ak sú v dokumente",
  "vlastnictvo": "osobné alebo družstevné alebo štátne",
  "kategoria": "predaj alebo prenajom",
  "parcela": "číslo parcely",
  "supisne_cislo": "súpisné číslo",
  "orientacia": "svetová strana (S/J/V/Z/SV/SZ/JV/JZ)",
  "inzinierske_siete": "true ak sú uvedené",
  "pravne_vady": "ČASŤ C listu vlastníctva: záložné práva, vecné bremená (doživotné bývanie, prechod), exekúcie — PRESNE cituj z dokumentu",
  "poznamka": "ďalšie dôležité info"
}

KRITICKÉ PRAVIDLÁ EXTRAKCIE:
1. Ak údaj v texte NEVIDÍŠ → VYNECHAJ kľúč z JSON (žiadne null, "", "Nezistené", "N/A")
2. LOKALITA: Použi PRESNE hodnotu z "k.ú." (katastrálne územie). Nekombinuj s inými údajmi
3. PLOCHA: Hľadaj "podlahová plocha" alebo "vypočítaná podlahová plocha". Balkón/loggia sa NEPOČÍTA do plochy bytu — uveď zvlášť
4. CENA: Ak nájdeš VŠH (všeobecná hodnota) alebo kúpnu cenu → uprav na Baťu (zaokrúhli na 1000, odčítaj 100)
5. MESAČNÉ NÁKLADY: Hľadaj sumy za správu, fond opráv, energie. Ak sú rozpísané, SČÍTAJ do mesačného odhadu
6. PRÁVNE VADY: Hľadaj v časti C listu vlastníctva. Identifikuj: hypotéky (záložné práva), vecné bremená (doživotné bývanie, prechod), exekúcie
7. MATERIÁL a STAV: Použi presne tieto hodnoty — tehla/panel/skelet/drevo/ine a novostavba/povodny-stav/uplne-prerobeny/ciastocne-prerobeny/vo-vystavbe
8. Čísla (plocha, izby, poschodie, rok) uvádzaj IBA ako číslo bez jednotky

Dokument:
${text}`;

function extractJSON(raw: string): Record<string, string> | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try { return JSON.parse(jsonMatch[0]); } catch { return null; }
}

/* ── Strategy 1: Gemini Flash (najrýchlejší, vie čítať PDF natívne) ── */
async function parseByGemini(text: string, system: string, pdfBase64?: string): Promise<Record<string, string> | null> {
  if (!process.env.GEMINI_API_KEY) { console.log("[parse-doc] Gemini: no API key"); return null; }
  try {
    // Ak máme PDF base64, pošleme ho priamo — Gemini vie čítať PDF natívne
    const parts: Array<Record<string, unknown>> = [];
    if (pdfBase64) {
      parts.push({ inlineData: { mimeType: "application/pdf", data: pdfBase64 } });
      parts.push({ text: USER_PROMPT("(viď priložený PDF dokument)") });
    } else {
      parts.push({ text: USER_PROMPT(text) });
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ parts }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
        }),
      }
    );
    if (!res.ok) { const err = await res.text(); console.error("[parse-doc] Gemini HTTP", res.status, err.slice(0, 300)); return null; }
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    console.log("[parse-doc] Gemini raw length:", raw.length, pdfBase64 ? "(from PDF)" : "(from text)");
    return extractJSON(raw);
  } catch (e) {
    console.error("[parse-doc] Gemini failed:", e);
    return null;
  }
}

/* ── Strategy 2: GPT-4o-mini ── */
async function parseByGPT(text: string, system: string): Promise<Record<string, string> | null> {
  if (!process.env.OPENAI_API_KEY) { console.log("[parse-doc] GPT: no API key"); return null; }
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 2000,
        messages: [
          { role: "system", content: system },
          { role: "user", content: USER_PROMPT(text) },
        ],
      }),
    });
    if (!res.ok) { const err = await res.text(); console.error("[parse-doc] GPT HTTP", res.status, err.slice(0, 300)); return null; }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || "";
    console.log("[parse-doc] GPT raw length:", raw.length);
    return extractJSON(raw);
  } catch (e) {
    console.error("[parse-doc] GPT failed:", e);
    return null;
  }
}

/* ── Strategy 3: Claude Haiku (fallback) ── */
async function parseByClaude(text: string, system: string): Promise<Record<string, string> | null> {
  if (!process.env.ANTHROPIC_API_KEY) { console.log("[parse-doc] Claude: no API key"); return null; }
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 2000,
      system: system,
      messages: [{ role: "user", content: USER_PROMPT(text) }],
    });
    const raw = (msg.content[0] as { type: string; text: string }).text.trim();
    return extractJSON(raw);
  } catch (e) {
    console.error("[parse-doc] Claude failed:", e);
    return null;
  }
}

/* ══════ MAIN — Gemini (najrýchlejší) → GPT → Claude ══════ */
export async function POST(req: NextRequest) {
  const { lv_text, doc_type, pdf_base64 } = await req.json();

  if (!lv_text?.trim()) {
    return NextResponse.json({ error: "Prázdny text" }, { status: 400 });
  }

  const system = getSystem(doc_type);
  console.log(`[parse-doc] Document type: ${doc_type || "lv"}, has PDF: ${!!pdf_base64}`);

  const strategies = [
    (t: string) => parseByGemini(t, system, pdf_base64),
    (t: string) => parseByGPT(t, system),
    (t: string) => parseByClaude(t, system),
  ];
  const names = ["Gemini", "GPT", "Claude"];

  for (let i = 0; i < strategies.length; i++) {
    console.log(`[parse-doc] Trying ${names[i]}...`);
    const result = await strategies[i](lv_text);
    if (result && (result.obec || result.okres || result.plocha || result.typ || result.stav || result.cena || result.mesacne_naklady || result.pravne_vady || result.material)) {
      console.log(`[parse-doc] ✓ ${names[i]} succeeded`);
      return NextResponse.json({ ...result, _ai: names[i], _docType: doc_type || "lv" });
    }
  }

  return NextResponse.json({ error: "Žiadna AI nedokázala spracovať dokument. Skontroluj API kľúče." }, { status: 500 });
}
