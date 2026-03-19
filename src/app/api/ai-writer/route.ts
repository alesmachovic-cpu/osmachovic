import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { nazov, typ, lokalita, cena, plocha, izby, stav, popis } = await req.json();

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [{
      role: "user",
      content: `Si skúsený realitný copywriter na Slovensku. Napíš 3 verzie inzerátu pre túto nehnuteľnosť.

Nehnuteľnosť:
- ${nazov}
- Typ: ${typ}, Lokalita: ${lokalita}
- Cena: ${cena} €${plocha ? `, Plocha: ${plocha} m²` : ""}${izby ? `, Izby: ${izby}` : ""}${stav ? `, Stav: ${stav}` : ""}
${popis ? `- Popis: ${popis}` : ""}

Vráť IBA JSON:
{
  "emotivny": "Emotívny text (100-150 slov, príbehy, pocity, životný štýl)",
  "technicky": "Technický text (konkrétne parametre, fakty, čísla, stav)",
  "kratky": "Krátky text na Facebook/Instagram (max 3 vety, výrazný)"
}`,
    }],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: "No JSON" }, { status: 500 });

  try {
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch {
    return NextResponse.json({ error: "Parse error" }, { status: 500 });
  }
}
