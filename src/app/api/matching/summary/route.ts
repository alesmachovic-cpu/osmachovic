import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { vypocitajSkore } from "@/lib/matching";
import type { ObjednavkaForMatch, NehnutelnostForMatch, KlientForMatch } from "@/lib/matching";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const companyId = auth.user.company_id;

  const ids = (req.nextUrl.searchParams.get("objednavky") ?? "")
    .split(",").map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({});

  const sb = getSupabaseAdmin();
  // 🔒 Scope na company_id — objednávky aj nehnuteľnosti len z firmy používateľa (cross-tenant guard)
  const [{ data: objednavky }, { data: nehnutelnosti }] = await Promise.all([
    sb.from("objednavky").select("id,klient_id,druh,poziadavky,lokalita,cena_od,cena_do,created_at,lat,lng").in("id", ids).eq("company_id", companyId),
    sb.from("nehnutelnosti").select("id,klient_id,typ,cena,plocha,izby,lokalita,kraj,okres,status,lat,lng").eq("company_id", companyId),
  ]);

  // 🐛 BUG FIX 2026-05-22: fallback na klient.lokalita keď obj.lokalita je prázdne
  const klientIds = [...new Set(((objednavky ?? []) as Array<{ klient_id: string | null }>).map(o => o.klient_id).filter(Boolean) as string[])];
  const { data: klientiData } = klientIds.length > 0
    ? await sb.from("klienti").select("id,lokalita,rozpocet_max").in("id", klientIds).eq("company_id", companyId)
    : { data: [] };
  const klientMap = new Map<string, KlientForMatch>((klientiData ?? []).map(k => [k.id, { id: k.id, lokalita: k.lokalita, rozpocet_max: k.rozpocet_max }]));

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
