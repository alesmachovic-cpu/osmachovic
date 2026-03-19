import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { nazov, typ, lokalita, cena, plocha, izby, stav, popis } = await req.json();
  if (!nazov || !cena) return NextResponse.json({ error: "nazov and cena required" }, { status: 400 });

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    messages: [{
      role: "user",
      content: `Si skúsený realitný analytik na slovenskom trhu. Analyzuj túto nehnuteľnosť a vráť IBA JSON:

Nehnuteľnosť:
- Názov: ${nazov}
- Typ: ${typ}
- Lokalita: ${lokalita}
- Cena: ${cena} €
- Plocha: ${plocha ?? "—"} m²
- Izby: ${izby ?? "—"}
- Stav: ${stav ?? "—"}
- Popis: ${popis ?? "—"}

Vráť JSON:
{
  "skore": číslo 0-10 (trhové skóre),
  "analyza": "2-3 vety o nehnuteľnosti, silné/slabé stránky",
  "odporucanie": "Odporúčam / Zvážiť zľavu / Znížiť cenu / OK",
  "trhova_cena_min": číslo v €,
  "trhova_cena_max": číslo v €
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
