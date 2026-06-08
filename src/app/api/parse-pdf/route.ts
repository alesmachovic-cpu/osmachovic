import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { assertFileSize, assertMime, ALLOWED_DOC_MIMES, UPLOAD_LIMITS } from "@/lib/uploadGuards";
import { aiParseDisabled, AI_DISABLED_BODY } from "@/lib/aiFlag";
import { logParseFailure } from "@/lib/parseFailure";

export async function POST(req: NextRequest) {
  try {
    // 🚨 P1 fix: auth + size limit + MIME whitelist.
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    // #8 kill-switch — keď je AI parsing vypnutý, vráť signál na manuálne vyplnenie.
    if (aiParseDisabled()) return NextResponse.json(AI_DISABLED_BODY, { status: 503 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Žiadny súbor" }, { status: 400 });

    const sz = assertFileSize(file, UPLOAD_LIMITS.PARSE_DOC_MAX_BYTES);
    if (!sz.ok) return NextResponse.json({ error: sz.error }, { status: sz.status });
    const mi = assertMime(file, ALLOWED_DOC_MIMES);
    if (!mi.ok) return NextResponse.json({ error: mi.error }, { status: mi.status });

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    // Strategy 1: Claude OCR (číta PDF aj sken natívne).
    // GDPR 2026-06-03 (F2): klientske dokumenty (LV, posudky — meno, dátum
    // narodenia, adresa) spracúva VÝHRADNE Anthropic (jediný AI subprocessor
    // s DPA/SCC). Gemini a OpenAI odstránené z PII parse flow.
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const content: Array<
          | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
          | { type: "text"; text: string }
        > = [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          { type: "text", text: "Prepíš KOMPLETNE celý text z tohto PDF — vrátane naskenovaných strán (OCR). Zachovaj VŠETKY údaje: mená, adresy, čísla bytov, poschodia, parcely, výmery (m²), ceny (EUR), súpisné čísla, katastrálne územie, IČO, IBAN, dátumy, popis vybavenia (kuchyňa, kúpeľňa, podlahy, okná, dvere), vykurovanie, balkón/loggia/pivnica a ich výmery. Vráť IBA čistý text bez komentárov." },
        ];
        const msg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 16000,
          temperature: 0,
          messages: [{ role: "user", content }],
        });
        const text = msg.content.map(b => (b.type === "text" ? b.text : "")).join("").trim();
        if (text) {
          console.log(`[parse-pdf] Claude extracted ${text.length} chars from ${file.name}`);
          return NextResponse.json({ text });
        }
      } catch (e) {
        console.error("[parse-pdf] Claude failed:", e);
      }
    }

    // Strategy 2: pdf-parse library (lokálne, bez prenosu dát) ako last resort
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      const text = result.text?.trim();
      await parser.destroy();
      if (text) return NextResponse.json({ text });
    } catch (e) {
      console.error("[parse-pdf] pdf-parse failed:", e);
    }

    await logParseFailure({ source: "parse-pdf", error: "Claude OCR aj pdf-parse zlyhali", filename: file.name, doc_type: "pdf", actor_id: auth.user.id });
    return NextResponse.json({ error: "Nepodarilo sa prečítať PDF. Skúste skopírovať text z PDF a vložiť ho." }, { status: 500 });
  } catch (e) {
    console.error("[parse-pdf] Error:", e);
    return NextResponse.json({ error: "Nepodarilo sa prečítať PDF" }, { status: 500 });
  }
}
