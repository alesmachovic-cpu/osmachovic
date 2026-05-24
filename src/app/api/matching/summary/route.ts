import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { vypocitajSkore } from "@/lib/matching";
import type { ObjednavkaForMatch, NehnutelnostForMatch, KlientForMatch } from "@/lib/matching";

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

  // 🐛 BUG FIX 2026-05-22: fallback na klient.lokalita keď obj.lokalita je prázdne
  const klientIds = [...new Set(((objednavky ?? []) as Array<{ klient_id: string | null }>).map(o => o.klient_id).filter(Boolean) as string[])];
  const { data: klientiData } = klientIds.length > 0
    ? await sb.from("klienti").select("id,lokalita").in("id", klientIds)
    : { data: [] };
  const klientMap = new Map<string, KlientForMatch>((klientiData ?? []).map(k => [k.id, { id: k.id, lokalita: k.lokalita, rozpocet_max: null }]));

  const result: Record<string, { totalMatches: number; topScore: number; daysSinceCreated: number }> = {};

  for (const o of (objednavky ?? []) as ObjednavkaForMatch[]) {
    const klient = klientMap.get(o.klient_id);
    let top = 0, count = 0;
    for (const n of (nehnutelnosti ?? []) as NehnutelnostForMatch[]) {
      const { score } = vypocitajSkore(o, n, klient);
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
