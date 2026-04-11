import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;
export const runtime = "nodejs";

const SYSTEM = `Si expertný analytik slovenských realitných dokumentov — rozumieš KAŽDÉMU typu dokumentu:
list vlastníctva, znalecký posudok, kúpna zmluva, rezervačná zmluva, budúca kúpna zmluva, darovacia,
nájomná, nadobúdací doklad, pôdorys, energetický certifikát, výpis z katastra.

PRINCÍPY:
1. Nájdi časť dokumentu kde je POPÍSANÁ nehnuteľnosť (nie osoby, nie právne doložky).
2. V zmluvách hľadaj "PREDMET ZMLUVY" / "Predmet kúpy". V posudkoch "ÚVOD", "Vo veci", "Dispozičné riešenie".
3. NEZAMIEŇAJ bydlisko predávajúceho/kupujúceho s adresou nehnuteľnosti.
4. Lokalita: k.ú. (katastrálne územie) je najpresnejšie; okres pri Bratislave rozlíš I–V; nevymýšľaj mestské časti.
5. Izby = počet OBYTNÝCH miestností (nie kuchyňa, kúpeľňa, WC, chodba, hala, pivnica). KRITICKÉ: ak dokument píše "1-izbový byt" / "jednoizbový" / "garsónka" / "1-izb." → izby:1 a typ:byt. "2-izbový"/"dvojizbový"→2, "3-izbový"→3 atď. NIKDY si nepočítaj izby z opisu miestností — vždy ber EXPLICITNÉ "X-izbový" označenie z dokumentu. Ak dokument hovorí "jednoizbový byt s kuchyňou", izby je 1 (kuchyňa sa nepočíta).
6. Plocha bytu = podlahová plocha BEZ balkóna/loggie/terasy. Ak dokument pridáva pivnicu, odpočítaj ju.
7. Materiál: "panelový"→panel, "tehla/pálená tehla/murovaná"→tehla, "skelet"→skelet, "drevo/zrub"→drevo.
8. Rok výstavby = ROK KEDY BOLA BUDOVA PÔVODNE POSTAVENÁ. Ak dokument uvádza viac rokov (kolaudácia, rekonštrukcia, obnova, zateplenie, nadstavba), NIKDY si neber rok rekonštrukcie/zateplenia ako rok výstavby — tie dávaj do "rok_rekonstrukcie". "Vek X rokov (od roku YYYY)" → YYYY je rok výstavby. Ak nevidíš jednoznačný rok výstavby, pole VYNECHAJ (nehalucinuj).
9. Cena (Baťu): zaokrúhli na 1000 nadol a odčítaj 100 (150000→149900, 112990→112900).
10. Ak rezervačná zmluva: SČÍTAJ zálohu + doplatok.
11. Balkón/loggia/terasa/pivnica/garáž: true iba ak sú explicitne pri tomto byte.
12. ZÁKAZ HALUCINÁCIÍ: Ak údaj NEVIDÍŠ, VYNECHAJ kľúč z JSON. Nikdy "N/A", null, prázdne stringy.
13. Čísla vracaj bez jednotiek (nie "65 m²", len "65").

Vráť IBA validný JSON podľa tejto schémy (všetky polia sú voliteľné):`;

const SCHEMA = `{
  "typ": "byt | rodinny-dom | pozemok | garaz | komercne",
  "obec": "mesto",
  "okres": "okres (napr. Bratislava V)",
  "kraj": "kraj",
  "katastralneUzemie": "k.ú.",
  "ulica": "ulica a číslo",
  "cena": "číslo v EUR (Baťu formát)",
  "plocha": "podlahová plocha bytu v m² (číslo)",
  "uzitkova_plocha": "úžitková plocha v m² (číslo)",
  "stav": "novostavba | povodny-stav | uplne-prerobeny | ciastocne-prerobeny | vo-vystavbe",
  "material": "tehla | panel | skelet | drevo | ine",
  "rok_vystavby": "rok pôvodnej stavby (číslo)",
  "rok_kolaudacie": "rok kolaudácie (číslo)",
  "rok_rekonstrukcie": "rok poslednej rekonštrukcie / zateplenia (číslo)",
  "poschodie": "číslo poschodia bytu",
  "poschodia_vyssie": "celkový počet nadzemných podlaží budovy",
  "poschodia_nizsie": "počet podzemných podlaží budovy",
  "cislo_bytu": "číslo bytu (napr. 51, A5.1)",
  "vchod": "číslo vchodu",
  "supisne_cislo": "súpisné číslo budovy",
  "parcela": "číslo parcely",
  "izby": "počet obytných miestností",
  "balkon": "true/false",
  "balkon_plocha": "v m²",
  "loggia": "true/false",
  "loggia_plocha": "v m²",
  "terasa": "true/false",
  "terasa_plocha": "v m²",
  "pivnica": "true/false",
  "pivnica_plocha": "v m²",
  "garaz": "true/false",
  "vytah": "true/false",
  "vykurovanie": "centralne | lokalne | podlahove | kozub | ine",
  "klimatizacia": "true/false",
  "energeticky_certifikat": "A0|A1|A|B|C|D|E|F|G",
  "mesacne_naklady": "v EUR",
  "vlastnictvo": "osobné | družstevné",
  "pravne_vady": "krátko ťarchy z časti C / záložné práva / vecné bremená",
  "kategoria": "predaj | prenajom",
  "orientacia": "S|J|V|Z|SV|SZ|JV|JZ",
  "parkovanie": "garaz | parkovacie-miesto | ulica",
  "inzinierske_siete": "true/false",
  "naklady_detail": "rozpis mesačných nákladov",
  "poznamka": "iné dôležité info"
}`;

function extractJSON(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  // Odstráň markdown obal ak je
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function callGeminiText(text: string): Promise<{ data?: Record<string, unknown>; error?: string }> {
  if (!process.env.GEMINI_API_KEY) return { error: "Chýba GEMINI_API_KEY" };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM + "\n" + SCHEMA }] },
          contents: [{ parts: [{ text: `Dokument:\n\n${text}\n\nExtrahuj údaje o nehnuteľnosti. Vráť IBA JSON podľa schémy.` }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 16000, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    if (!res.ok) { const err = await res.text(); return { error: `Gemini HTTP ${res.status}: ${err.slice(0,200)}` }; }
    const j = await res.json();
    const raw = j.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    const parsed = extractJSON(raw);
    if (!parsed) return { error: `Gemini text neparsovateľný (${raw.length} znakov)` };
    return { data: parsed };
  } catch (e) { return { error: `Gemini výnimka: ${String(e).slice(0,200)}` }; }
}

async function callGemini(parts: Array<{ base64: string; mime: string }>): Promise<{ data?: Record<string, unknown>; error?: string }> {
  if (!process.env.GEMINI_API_KEY) return { error: "Chýba GEMINI_API_KEY" };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM + "\n" + SCHEMA }] },
          contents: [{
            parts: [
              ...parts.map(p => ({ inlineData: { mimeType: p.mime, data: p.base64 } })),
              { text: "Extrahuj všetky dostupné údaje o nehnuteľnosti z tohto dokumentu. Vráť IBA JSON podľa schémy vyššie." },
            ],
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 16000,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error("[parse-doc] Gemini HTTP", res.status, err.slice(0, 500));
      return { error: `Gemini HTTP ${res.status}: ${err.slice(0, 200)}` };
    }
    const j = await res.json();
    const raw = j.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    const finishReason = j.candidates?.[0]?.finishReason;
    console.log("[parse-doc] Gemini finish:", finishReason, "raw length:", raw.length);
    const parsed = extractJSON(raw);
    if (!parsed) return { error: `Gemini vrátil neparsovateľný JSON (${raw.length} znakov, finish: ${finishReason})` };
    return { data: parsed };
  } catch (e) {
    console.error("[parse-doc] Gemini exception:", e);
    return { error: `Gemini výnimka: ${String(e).slice(0, 200)}` };
  }
}

async function callGPT(base64: string, mime: string, filename: string): Promise<{ data?: Record<string, unknown>; error?: string }> {
  if (!process.env.OPENAI_API_KEY) return { error: "Chýba OPENAI_API_KEY" };
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.1,
        max_tokens: 8000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM + "\n" + SCHEMA },
          { role: "user", content: [
            { type: "file", file: { filename, file_data: `data:${mime};base64,${base64}` } },
            { type: "text", text: "Extrahuj údaje o nehnuteľnosti. Vráť IBA JSON." },
          ]},
        ],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { error: `GPT HTTP ${res.status}: ${err.slice(0, 200)}` };
    }
    const j = await res.json();
    const raw = j.choices?.[0]?.message?.content?.trim() || "";
    const parsed = extractJSON(raw);
    if (!parsed) return { error: "GPT vrátil neparsovateľný JSON" };
    return { data: parsed };
  } catch (e) {
    return { error: `GPT výnimka: ${String(e).slice(0, 200)}` };
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctype = req.headers.get("content-type") || "";
    let parts: Array<{ base64: string; mime: string }> = [];
    let filename = "document.pdf";
    let pdfBase64 = "";
    let pdfMime = "application/pdf";

    if (ctype.includes("application/json")) {
      const body = await req.json();
      filename = body.filename || "document.pdf";
      if (Array.isArray(body.images) && body.images.length > 0) {
        parts = body.images.map((b64: string) => ({ base64: b64, mime: "image/jpeg" }));
        console.log(`[parse-doc] JSON images: ${parts.length}`);
      } else if (body.pdf_base64) {
        pdfBase64 = body.pdf_base64;
        parts = [{ base64: pdfBase64, mime: pdfMime }];
      }
    } else {
      const fd = await req.formData();
      const file = fd.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "Žiadny súbor" }, { status: 400 });
      filename = file.name;
      pdfMime = file.type || "application/pdf";
      const buf = Buffer.from(await file.arrayBuffer());
      const lower = filename.toLowerCase();
      const isDocx = lower.endsWith(".docx") || pdfMime.includes("wordprocessingml");
      const isDoc = lower.endsWith(".doc") && !isDocx;
      if (isDocx) {
        try {
          const mammoth = await import("mammoth");
          const { value: text } = await mammoth.extractRawText({ buffer: buf });
          console.log(`[parse-doc] docx ${filename}, text length: ${text.length}`);
          if (!text || text.length < 20) return NextResponse.json({ error: "Prázdny DOCX" }, { status: 400 });
          const gemT = await callGeminiText(text);
          if (gemT.data && Object.keys(gemT.data).length > 0) {
            return NextResponse.json({ ...gemT.data, _ai: "gemini-text" });
          }
          return NextResponse.json({ error: `Gemini DOCX: ${gemT.error || "empty"}` }, { status: 500 });
        } catch (e) {
          return NextResponse.json({ error: `DOCX parsing zlyhal: ${String(e).slice(0,200)}` }, { status: 500 });
        }
      }
      if (isDoc) {
        return NextResponse.json({ error: "Starý .doc formát nie je podporovaný — uložte ako .docx alebo PDF." }, { status: 400 });
      }
      pdfBase64 = buf.toString("base64");
      parts = [{ base64: pdfBase64, mime: pdfMime }];
      console.log(`[parse-doc] multipart ${file.name}, size: ${buf.length}`);
    }

    if (parts.length === 0) return NextResponse.json({ error: "Prázdny vstup" }, { status: 400 });

    // 1. Gemini
    const gem = await callGemini(parts);
    if (gem.data && Object.keys(gem.data).length > 0) {
      console.log("[parse-doc] ✓ Gemini success, fields:", Object.keys(gem.data).length);
      return NextResponse.json({ ...gem.data, _ai: "gemini" });
    }
    console.log("[parse-doc] Gemini failed:", gem.error);

    // 2. GPT-4o fallback (len pre PDF, nie pre images array)
    if (!pdfBase64) {
      return NextResponse.json({ error: `Gemini: ${gem.error || "empty"}` }, { status: 500 });
    }
    const gpt = await callGPT(pdfBase64, pdfMime, filename);
    if (gpt.data && Object.keys(gpt.data).length > 0) {
      console.log("[parse-doc] ✓ GPT success");
      return NextResponse.json({ ...gpt.data, _ai: "gpt" });
    }

    return NextResponse.json({
      error: `AI nedokázala spracovať dokument. Gemini: ${gem.error || "empty"}. GPT: ${gpt.error || "empty"}.`,
    }, { status: 500 });
  } catch (e) {
    console.error("[parse-doc] fatal:", e);
    return NextResponse.json({ error: `Server error: ${String(e).slice(0, 300)}` }, { status: 500 });
  }
}
