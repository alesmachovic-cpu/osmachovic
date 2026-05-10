import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { vypocitajSkore } from "@/lib/matching";
import type { ObjednavkaForMatch, NehnutelnostForMatch } from "@/lib/matching";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "5");
  const sb = getSupabaseAdmin();

  const [{ data: obj }, { data: nehnutelnosti }] = await Promise.all([
    sb.from("objednavky").select("id,klient_id,druh,poziadavky,lokalita,cena_od,cena_do").eq("id", id).single(),
    sb.from("nehnutelnosti")
      .select("id,klient_id,typ,cena,plocha,izby,lokalita,kraj,okres,status,nazov,obec,ulica")
      .or("status.eq.aktivny,status.is.null"),
  ]);

  if (!obj) return NextResponse.json({ error: "Objednávka nenájdená" }, { status: 404 });

  type NehWithKlient = NehnutelnostForMatch & { predavajuci?: { id: string; meno: string; telefon: string | null } };

  // Pridaj info o predávajúcom
  const neh = (nehnutelnosti ?? []) as NehWithKlient[];
  if (neh.length > 0) {
    const klientIds = [...new Set(neh.map(n => n.klient_id).filter(Boolean))];
    if (klientIds.length > 0) {
      const { data: klienti } = await sb.from("klienti").select("id,meno,telefon").in("id", klientIds as string[]);
      const km = new Map((klienti ?? []).map(k => [k.id, k]));
      for (const n of neh) {
        if (n.klient_id) n.predavajuci = km.get(n.klient_id) ?? undefined;
      }
    }
  }

  const matches = neh
    .map(n => ({ nehnutelnost: n, score: vypocitajSkore(obj as ObjednavkaForMatch, n).score }))
    .filter(m => m.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return NextResponse.json(matches);
}
