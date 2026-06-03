import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { assertFileSize, assertMime, ALLOWED_DOC_MIMES, UPLOAD_LIMITS } from "@/lib/uploadGuards";

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

/* GDPR 2026-06-03 (F2): klientske dokumenty (LV, posudky, OP — obsahujú meno,
   dátum narodenia, adresu) spracúva VÝHRADNE Anthropic (jediný AI subprocessor
   s DPA/SCC). Gemini a OpenAI odstránené z PII parse flow. Claude číta natívne
   PDF (document blok), rasterizované stránky (image bloky) aj text. */
type ClaudeDocBlock = { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };
type ClaudeImgBlock = { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } };
type ClaudeTxtBlock = { type: "text"; text: string };

function imgMedia(mime: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  if (mime === "image/png") return "image/png";
  if (mime === "image/gif") return "image/gif";
  if (mime === "image/webp") return "image/webp";
  return "image/jpeg";
}

async function callClaude(input: { parts?: Array<{ base64: string; mime: string }>; text?: string }): Promise<{ data?: Record<string, unknown>; error?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { error: "Chýba ANTHROPIC_API_KEY" };
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const content: Array<ClaudeDocBlock | ClaudeImgBlock | ClaudeTxtBlock> = [];
    if (input.parts && input.parts.length > 0) {
      for (const p of input.parts) {
        if (p.mime === "application/pdf") {
          content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: p.base64 } });
        } else {
          content.push({ type: "image", source: { type: "base64", media_type: imgMedia(p.mime), data: p.base64 } });
        }
      }
      content.push({ type: "text", text: "Extrahuj všetky dostupné údaje o nehnuteľnosti z tohto dokumentu. Vráť IBA JSON podľa schémy vyššie." });
    } else {
      content.push({ type: "text", text: `Dokument:\n\n${input.text || ""}\n\nExtrahuj údaje o nehnuteľnosti. Vráť IBA JSON podľa schémy.` });
    }
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8000,
      temperature: 0.1,
      system: SYSTEM + "\n" + SCHEMA,
      messages: [{ role: "user", content }],
    });
    const raw = msg.content.map(b => (b.type === "text" ? b.text : "")).join("").trim();
    console.log("[parse-doc] Claude finish:", msg.stop_reason, "raw length:", raw.length);
    const parsed = extractJSON(raw);
    if (!parsed) return { error: `Claude vrátil neparsovateľný JSON (${raw.length} znakov, finish: ${msg.stop_reason})` };
    return { data: parsed };
  } catch (e) {
    console.error("[parse-doc] Claude exception:", e);
    return { error: `Claude výnimka: ${String(e).slice(0, 200)}` };
  }
}

export async function POST(req: NextRequest) {
  try {
    // 🚨 P1 fix: auth + size limit + MIME whitelist + base64 size guard.
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    const ctype = req.headers.get("content-type") || "";
    let parts: Array<{ base64: string; mime: string }> = [];
    let filename = "document.pdf";
    let pdfBase64 = "";
    let pdfMime = "application/pdf";

    if (ctype.includes("application/json")) {
      const body = await req.json();
      filename = body.filename || "document.pdf";

      // Guard base64 payloady — útočník môže poslať obrovský payload v JSON.
      // base64 délka ~ 1.37× pôvodný bajt → limit 20 MB * 1.5 = 30 MB base64.
      const maxBase64 = Math.ceil(UPLOAD_LIMITS.PARSE_DOC_MAX_BYTES * 1.5);

      if (Array.isArray(body.images) && body.images.length > 0) {
        if (body.images.length > 50) {
          return NextResponse.json({ error: "Maximum 50 obrázkov v jednom požiadavku" }, { status: 413 });
        }
        const totalSize = body.images.reduce((s: number, b: string) => s + (typeof b === "string" ? b.length : 0), 0);
        if (totalSize > maxBase64) {
          return NextResponse.json({ error: "Príliš veľký JSON payload (limit 30 MB base64)" }, { status: 413 });
        }
        parts = body.images.map((b64: string) => ({ base64: b64, mime: "image/jpeg" }));
        console.log(`[parse-doc] JSON images: ${parts.length}`);
      } else if (body.pdf_base64) {
        if (typeof body.pdf_base64 !== "string" || body.pdf_base64.length > maxBase64) {
          return NextResponse.json({ error: "Príliš veľký PDF payload (limit 30 MB base64)" }, { status: 413 });
        }
        pdfBase64 = body.pdf_base64;
        parts = [{ base64: pdfBase64, mime: pdfMime }];
      }
    } else {
      const fd = await req.formData();
      const file = fd.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "Žiadny súbor" }, { status: 400 });

      const sz = assertFileSize(file, UPLOAD_LIMITS.PARSE_DOC_MAX_BYTES);
      if (!sz.ok) return NextResponse.json({ error: sz.error }, { status: sz.status });
      const mi = assertMime(file, ALLOWED_DOC_MIMES);
      if (!mi.ok) return NextResponse.json({ error: mi.error }, { status: mi.status });

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
          const clT = await callClaude({ text });
          if (clT.data && Object.keys(clT.data).length > 0) {
            return NextResponse.json({ ...clT.data, _ai: "claude-text" });
          }
          return NextResponse.json({ error: `Claude DOCX: ${clT.error || "empty"}` }, { status: 500 });
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

    // Výhradne Claude (PDF, rasterizované stránky aj text), bez fallbacku.
    const cl = await callClaude({ parts });
    if (cl.data && Object.keys(cl.data).length > 0) {
      console.log("[parse-doc] ✓ Claude success, fields:", Object.keys(cl.data).length);
      return NextResponse.json({ ...cl.data, _ai: "claude" });
    }

    return NextResponse.json({
      error: `AI nedokázalo spracovať dokument. ${cl.error || "prázdna odpoveď"}.`,
    }, { status: 500 });
  } catch (e) {
    console.error("[parse-doc] fatal:", e);
    return NextResponse.json({ error: `Server error: ${String(e).slice(0, 300)}` }, { status: 500 });
  }
}
