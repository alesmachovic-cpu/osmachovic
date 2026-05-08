import { NextRequest, NextResponse } from "next/server";
import { analyzeOkolie } from "@/lib/okolie";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/okolie-analysis
 * Body: { lokalita: string, ulica?: string, cislo?: string, typ?: string }
 *
 * Vráti analýzu okolia (plusy/mínusy/doprava/občianska vybavenosť) z Gemini.
 * Používa sa ako samostatný re-fetch z UI (napr. v karte nehnuteľnosti).
 */
export async function POST(req: NextRequest) {
  let body: { lokalita?: string; ulica?: string; cislo?: string; typ?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  if (!body.lokalita) {
    return NextResponse.json({ error: "lokalita je povinná" }, { status: 400 });
  }

  const result = await analyzeOkolie({
    lokalita: body.lokalita,
    ulica: body.ulica || null,
    cislo: body.cislo || null,
    typ: body.typ || null,
  });

  return NextResponse.json(result);
}
