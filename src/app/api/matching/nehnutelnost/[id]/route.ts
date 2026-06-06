import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { vypocitajSkore } from "@/lib/matching";
import type { ObjednavkaForMatch, NehnutelnostForMatch, KlientForMatch } from "@/lib/matching";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabaseAdmin();

  const [{ data: neh }, { data: objednavky }] = await Promise.all([
    sb.from("nehnutelnosti").select("id,klient_id,typ,cena,plocha,izby,lokalita,kraj,okres,status,lat,lng").eq("id", id).single(),
    sb.from("objednavky").select("id,klient_id,druh,poziadavky,lokalita,cena_od,cena_do,created_at,lat,lng"),
  ]);

  if (!neh) return NextResponse.json({ error: "Nehnuteľnosť nenájdená" }, { status: 404 });

  type ObjWithKupujuci = ObjednavkaForMatch & { kupujuci?: { id: string; meno: string; telefon: string | null } };
  const obs = (objednavky ?? []) as ObjWithKupujuci[];

  // Klienti objednávok — kontakt + lokalita pre fallback. Lokalitu posielame do
  // vypocitajSkore (3. arg), aby skóre bolo symetrické s objednavka/[id] a summary
  // (objednávka s prázdnou lokalitou padne na klient.lokalita rovnako z oboch strán).
  const km = new Map<string, { id: string; meno: string; telefon: string | null; lokalita: string | null; rozpocet_max: number | null }>();
  if (obs.length > 0) {
    const klientIds = [...new Set(obs.map(o => o.klient_id))];
    const { data: klienti } = await sb.from("klienti").select("id,meno,telefon,lokalita,rozpocet_max").in("id", klientIds);
    for (const k of klienti ?? []) km.set(k.id, k);
    for (const o of obs) {
      const k = km.get(o.klient_id);
      o.kupujuci = k ? { id: k.id, meno: k.meno, telefon: k.telefon } : undefined;
    }
  }

  const matches = obs
    .map(o => {
      const k = km.get(o.klient_id);
      const klient: KlientForMatch | undefined = k ? { id: k.id, lokalita: k.lokalita, rozpocet_max: k.rozpocet_max } : undefined;
      return { objednavka: o, score: vypocitajSkore(o, neh as NehnutelnostForMatch, klient).score };
    })
    .filter(m => m.score >= 30)
    .sort((a, b) => b.score - a.score);

  return NextResponse.json(matches);
}
