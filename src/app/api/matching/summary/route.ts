import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { vypocitajSkore } from "@/lib/matching";
import type { ObjednavkaForMatch, NehnutelnostForMatch } from "@/lib/matching";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("objednavky") ?? "")
    .split(",").map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({});

  const sb = getSupabaseAdmin();
  const [{ data: objednavky }, { data: nehnutelnosti }] = await Promise.all([
    sb.from("objednavky").select("id,klient_id,druh,poziadavky,lokalita,cena_od,cena_do,created_at").in("id", ids),
    sb.from("nehnutelnosti").select("id,klient_id,typ,cena,plocha,izby,lokalita,kraj,okres,status"),
  ]);

  const result: Record<string, { totalMatches: number; topScore: number; daysSinceCreated: number }> = {};

  for (const o of (objednavky ?? []) as ObjednavkaForMatch[]) {
    let top = 0, count = 0;
    for (const n of (nehnutelnosti ?? []) as NehnutelnostForMatch[]) {
      const { score } = vypocitajSkore(o, n);
      if (score >= 30) {
        count++;
        if (score > top) top = score;
      }
    }
    const created = (o as unknown as { created_at?: string }).created_at;
    result[o.id] = {
      totalMatches: count,
      topScore: top,
      daysSinceCreated: created
        ? Math.floor((Date.now() - new Date(created).getTime()) / 86400000)
        : 0,
    };
  }

  return NextResponse.json(result);
}
