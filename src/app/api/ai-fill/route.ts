import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Text is required" }, { status: 400 });

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{
      role: "user",
      content: `Z tohto textu (email/správa od klienta) vytiahni údaje a vráť IBA JSON bez komentárov:

TEXT: "${text}"

JSON formát:
{
  "meno": "meno a priezvisko alebo null",
  "mobil": "telefón alebo null",
  "email": "email alebo null",
  "typ": "byt alebo dom alebo pozemok alebo null",
  "lokalita": "kraj/mesto alebo null",
  "rozpocet_max": číslo v € alebo null,
  "poznamka": "krátka poznámka z kontextu alebo null"
}`,
    }],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: "No JSON returned" }, { status: 500 });

  try {
    const data = JSON.parse(jsonMatch[0]);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Parse error" }, { status: 500 });
  }
}
