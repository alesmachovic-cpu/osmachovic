import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { vypocitajSkore } from "@/lib/matching";
import type { ObjednavkaForMatch, NehnutelnostForMatch } from "@/lib/matching";

export const runtime = "nodejs";

type NehWithMeta = NehnutelnostForMatch & {
  predavajuci?: { id: string; meno: string; telefon: string | null };
  source: "internal" | "monitor";
  portal?: string | null;
  url?: string | null;
  nazov?: string | null;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "5");
  const sb = getSupabaseAdmin();

  const [{ data: obj }, { data: nehnutelnosti }, { data: monitorItems }] = await Promise.all([
    sb.from("objednavky").select("id,klient_id,druh,poziadavky,lokalita,cena_od,cena_do").eq("id", id).single(),
    sb.from("nehnutelnosti")
      .select("id,klient_id,typ,cena,plocha,izby,lokalita,kraj,okres,status,nazov,obec,ulica")
      .or("status.eq.aktivny,status.is.null"),
    sb.from("monitor_inzeraty")
      .select("id,portal,url,nazov,typ,lokalita,cena,plocha,izby,predajca_meno,predajca_telefon")
      .eq("is_active", true),
  ]);

  if (!obj) return NextResponse.json({ error: "Objednávka nenájdená" }, { status: 404 });

  // Interné nehnuteľnosti
  const neh = (nehnutelnosti ?? []) as unknown as NehWithMeta[];
  for (const n of neh) n.source = "internal";

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

  // Monitor inzeráty mapované na NehnutelnostForMatch
  const monitorNeh: NehWithMeta[] = (monitorItems ?? []).map(m => ({
    id: m.id,
    klient_id: null,
    typ: m.typ,
    cena: m.cena,
    plocha: m.plocha,
    izby: m.izby,
    lokalita: m.lokalita,
    kraj: null,
    okres: null,
    status: null,
    source: "monitor" as const,
    portal: m.portal,
    url: m.url,
    nazov: m.nazov,
    predavajuci: m.predajca_meno
      ? { id: "", meno: m.predajca_meno, telefon: m.predajca_telefon ?? null }
      : undefined,
  }));

  const matches = [...neh, ...monitorNeh]
    .map(n => ({ nehnutelnost: n, score: vypocitajSkore(obj as ObjednavkaForMatch, n).score }))
    .filter(m => m.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return NextResponse.json(matches);
}
