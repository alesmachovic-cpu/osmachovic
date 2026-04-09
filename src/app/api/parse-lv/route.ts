import { NextRequest, NextResponse } from "next/server";

// SYSTEM_LV/POSUDOK/ZMLUVA definované nižšie po SYSTEM_UNIVERSAL

const SYSTEM_UNIVERSAL = `Si expertný analytik slovenských realitných dokumentov — rozumieš KAŽDÉMU typu dokumentu:
list vlastníctva, znalecký posudok, kúpna zmluva, rezervačná zmluva, budúca kúpna zmluva, darovacia,
nájomná, nadobúdací doklad, pôdorys, energetický certifikát, výpis z katastra, rozhodnutie o vklade.

AKO UVAŽOVAŤ NAD DOKUMENTOM:

1. ROZPOZNAJ O ČOM DOKUMENT JE
   - Najprv identifikuj typ dokumentu (posudok/zmluva/LV) z nadpisu a kontextu.
   - Potom nájdi "predmet" — tú časť kde je POPÍSANÁ nehnuteľnosť (nie osoby, nie právne doložky).
   - V zmluvách hľadaj článok "PREDMET ZMLUVY" / "Predmet kúpy" / "Opis nehnuteľnosti".
   - V posudkoch hľadaj "ÚVOD POSUDKU", "Vo veci", "Opis stavby", "Dispozičné riešenie".

2. NEZAMIEŇAJ OSOBU A NEHNUTEĽNOSŤ
   - "Bytom" / "trvalé bydlisko" / "adresa sídla" v identifikácii strán zmluvy = bydlisko OSOBY, NIE predmetu.
   - Adresa nehnuteľnosti je VŽDY v sekcii ktorá popisuje predmet prevodu/ohodnotenia.
   - Ak sa v dokumente spomínajú 3 adresy, vyber tú pri popise bytu/domu/pozemku.

3. LOKALITA — HIERARCHIA
   - Katastrálne územie (k.ú.) = NAJPRESNEJŠIE (použi vždy keď je).
   - Obec = mesto/dedina; pri Bratislave/Košiciach aj mestská časť ("m.č.").
   - Okres — pri Bratislave rozlíš I/II/III/IV/V (Karlova Ves = IV, Petržalka = V, Ružinov = II, Staré Mesto = I, Nové Mesto = III).
   - NIKDY neprepisuj mestskú časť z vlastnej pamäti — ber len to čo vidíš.

4. POSCHODIE, IZBY, PLOCHA — LOGIKA
   - "5.p." / "na 5. poschodí" / "piate nadzemné podlažie" → poschodie=5.
   - "-1.p." / "suterén" / "podzemné podlažie" → poschodie=-1.
   - Izby = POČET OBYTNÝCH MIESTNOSTÍ, nepočítaj kuchyňu, kúpeľňu, WC, chodbu, halu, pivnicu, balkón.
     * "garsónka" / "1-izbový" = 1, "dvojizbový" = 2, "3-izbový" / "3 obytných miestností" = 3, atď.
   - Plocha bytu = podlahová plocha BEZ balkóna/loggie/terasy. Pivnica je sporná — ak je v dokumente rozpis,
     skontroluj či ju pripočítali (slovenské posudky niekedy áno) a odpočítaj ju.
   - Ak vidíš tabuľku miestností s plochami, sčítaj len obytnú časť; ak vidíš rovno "celková podlahová plocha
     bytu, bez loggie, je X m²", použi X.
   - Celkový počet nadzemných/podzemných podlaží budovy ≠ poschodie bytu (nemýľ si to).

5. MATERIÁL STAVBY
   - "panelový" / "montovaný panelový" / "z betónových panelov" → panel
   - "tehlový" / "pálená tehla" / "murovaná z tehly" → tehla
   - "skelet" / "železobetónový skelet" → skelet
   - "drevený" / "zrub" → drevo
   - Ak sa neuvádza, vynechaj — nevymýšľaj.

6. ROK VÝSTAVBY / KOLAUDÁCIE
   - Posudok: "vek X rokov (od roku YYYY)" → rok_vystavby=YYYY.
   - Zmluva: málokedy obsahuje; ak áno hľadaj "kolaudačné rozhodnutie zo dňa", "postavený v roku".

7. CENA — BAŤU FORMÁT
   - Kúpna cena / VŠH / všeobecná hodnota v EUR.
   - Ak rezervačná zmluva: SČÍTAJ rezervačnú zálohu + doplatok.
   - Uprav do Baťu: zaokrúhli na 1000 nadol a odčítaj 100 (150000→149900, 112990→112900, 89500→89400).

8. VYBAVENIE A PRÍSLUŠENSTVO
   - Hľadaj popisy kuchyne (linka, spotrebiče), kúpeľne (vaňa/sprcha/umývadlo), podláh, okien, dverí, vykurovania.
   - Balkón/loggia/terasa/pivnica/garáž: označ true len keď ich dokument explicitne uvedie pri tomto konkrétnom byte.
   - Ak sa uvádza výmera doplnku ("pivnica 1,70 m²", "loggia 4,5 m²"), zachyť ju samostatne.

9. PRÁVNE VADY (časť C listu vlastníctva alebo "Ťarchy" v posudku)
   - Záložné práva (hypotéky) — skrátene zachyť ktorá banka.
   - Vecné bremená (právo doživotného bývania, právo prechodu) — cituj krátko.
   - Exekúcie, plomby — cituj.

10. DÔSLEDNÁ POCTIVOSŤ
    - Ak údaj v dokumente NIE JE, VYNECHAJ kľúč z JSON. NEpoužívaj "N/A", prázdne stringy, null.
    - Radšej polovica polí ako vymyslené údaje.
    - Čísla vráť ako číslo (bez "m²", "€", medzier).

Vráť IBA validný JSON bez markdown obalu.`;

const SYSTEM_LV = SYSTEM_UNIVERSAL;
const SYSTEM_POSUDOK = SYSTEM_UNIVERSAL;
const SYSTEM_ZMLUVA = SYSTEM_UNIVERSAL;

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
  "poschodie": "číslo poschodia bytu IBA číslo (napr. 5)",
  "poschodia_vyssie": "celkový počet nadzemných podlaží v budove IBA číslo",
  "poschodia_nizsie": "počet podzemných podlaží v budove IBA číslo",
  "cislo_bytu": "číslo bytu podľa zmluvy/posudku (napr. 51, 16, A5.1)",
  "vchod": "číslo vchodu alebo orientačné číslo vchodu",
  "izby": "počet obytných miestností IBA číslo (nie kuchyňa, kúpeľňa, chodba)",
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
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 16000,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 }, // vypnúť thinking aby sa output nekrátil
          },
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
        max_tokens: 4000,
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
      max_tokens: 4000,
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
    // Považuj za úspech ak AI vráti HOCIJAKÉ užitočné pole (aj len katastrálne územie, izby, poschodie, ulicu)
    const hasAnyField = result && Object.values(result).some(v => v !== undefined && v !== null && String(v).trim() !== "" && String(v).toLowerCase() !== "n/a");
    if (hasAnyField) {
      console.log(`[parse-doc] ✓ ${names[i]} succeeded with fields:`, Object.keys(result!).join(", "));
      return NextResponse.json({ ...result, _ai: names[i], _docType: doc_type || "lv" });
    }
    console.log(`[parse-doc] ✗ ${names[i]} returned empty, trying next...`);
  }

  return NextResponse.json({ error: "Žiadna AI nedokázala spracovať dokument. Skontroluj API kľúče." }, { status: 500 });
}
