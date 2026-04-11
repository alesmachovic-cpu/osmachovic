import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Žiadny súbor" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    // Strategy 1: Use Gemini (supports PDF natively via base64)
    if (process.env.GEMINI_API_KEY) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [
                  {
                    inlineData: {
                      mimeType: "application/pdf",
                      data: base64,
                    },
                  },
                  {
                    text: "Prepíš KOMPLETNE celý text z tohto PDF — vrátane naskenovaných strán (OCR). Zachovaj VŠETKY údaje: mená, adresy, čísla bytov, poschodia, parcely, výmery (m²), ceny (EUR), súpisné čísla, katastrálne územie, IČO, IBAN, dátumy, popis vybavenia (kuchyňa, kúpeľňa, podlahy, okná, dvere), vykurovanie, balkón/loggia/pivnica a ich výmery. Vráť IBA čistý text bez komentárov.",
                  },
                ],
              }],
              generationConfig: {
                temperature: 0,
                maxOutputTokens: 32000,
                thinkingConfig: { thinkingBudget: 0 },
              },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) {
            console.log(`[parse-pdf] Gemini extracted ${text.length} chars from ${file.name}`);
            return NextResponse.json({ text });
          }
        } else {
          const err = await res.text();
          console.error("[parse-pdf] Gemini HTTP", res.status, err.slice(0, 300));
        }
      } catch (e) {
        console.error("[parse-pdf] Gemini failed:", e);
      }
    }

    // Strategy 2: Use GPT-4o (supports base64 file via vision)
    if (process.env.OPENAI_API_KEY) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            temperature: 0,
            max_tokens: 16000,
            messages: [{
              role: "user",
              content: [
                {
                  type: "file",
                  file: {
                    filename: file.name,
                    file_data: `data:application/pdf;base64,${base64}`,
                  },
                },
                {
                  type: "text",
                  text: "Extrahuj celý text z tohto PDF dokumentu. Vráť IBA čistý text, žiadne komentáre.",
                },
              ],
            }],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content?.trim();
          if (text) return NextResponse.json({ text });
        }
      } catch (e) {
        console.error("[parse-pdf] GPT failed:", e);
      }
    }

    // Strategy 3: Try pdf-parse library as last resort
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

    return NextResponse.json({ error: "Nepodarilo sa prečítať PDF. Skúste skopírovať text z PDF a vložiť ho." }, { status: 500 });
  } catch (e) {
    console.error("[parse-pdf] Error:", e);
    return NextResponse.json({ error: "Nepodarilo sa prečítať PDF" }, { status: 500 });
  }
}
