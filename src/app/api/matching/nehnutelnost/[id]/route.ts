import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { vypocitajSkore } from "@/lib/matching";
import type { ObjednavkaForMatch, NehnutelnostForMatch } from "@/lib/matching";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabaseAdmin();

  const [{ data: neh }, { data: objednavky }] = await Promise.all([
    sb.from("nehnutelnosti").select("id,klient_id,typ,cena,plocha,izby,lokalita,kraj,okres,status").eq("id", id).single(),
    sb.from("objednavky").select("id,klient_id,druh,poziadavky,lokalita,cena_od,cena_do,created_at"),
  ]);

  if (!neh) return NextResponse.json({ error: "Nehnuteľnosť nenájdená" }, { status: 404 });

  type ObjWithKupujuci = ObjednavkaForMatch & { kupujuci?: { id: string; meno: string; telefon: string | null } };
  const obs = (objednavky ?? []) as ObjWithKupujuci[];

  if (obs.length > 0) {
    const klientIds = [...new Set(obs.map(o => o.klient_id))];
    const { data: klienti } = await sb.from("klienti").select("id,meno,telefon").in("id", klientIds);
    const km = new Map((klienti ?? []).map(k => [k.id, k]));
    for (const o of obs) o.kupujuci = km.get(o.klient_id) ?? undefined;
  }

  const matches = obs
    .map(o => ({ objednavka: o, score: vypocitajSkore(o, neh as NehnutelnostForMatch).score }))
    .filter(m => m.score >= 30)
    .sort((a, b) => b.score - a.score);

  return NextResponse.json(matches);
}
