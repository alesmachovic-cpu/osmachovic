import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { vypocitajSkore } from "@/lib/matching";
import type { ObjednavkaForMatch, NehnutelnostForMatch, KlientForMatch } from "@/lib/matching";

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
      .select("id,portal,url,nazov,typ,lokalita,cena,plocha,izby")
      .eq("is_active", true),
  ]);

  if (!obj) return NextResponse.json({ error: "Objednávka nenájdená" }, { status: 404 });

  // 🐛 BUG FIX 2026-05-22: niektoré objednávky majú prázdnu lokalita (kraje:[], okresy:[])
  // → matching ignoroval lokalitu úplne (klient čo chce Žilinu dostával 55% na Bratislavu).
  // Fallback: keď obj.lokalita je prázdne, použijeme klient.lokalita ("Vlčince, Žilina").
  let klientForMatch: KlientForMatch | undefined;
  if (obj.klient_id) {
    const { data: k } = await sb.from("klienti").select("id,lokalita,rozpocet_max").eq("id", obj.klient_id).maybeSingle();
    if (k) klientForMatch = { id: k.id, lokalita: k.lokalita, rozpocet_max: k.rozpocet_max };
  }

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
    // GDPR data-min: monitor neukladá kontakt predajcu. Maklér nájde kontakt
    // priamo v inzeráte cez `url`.
    predavajuci: undefined,
  }));

  const matches = [...neh, ...monitorNeh]
    .map(n => ({ nehnutelnost: n, score: vypocitajSkore(obj as ObjednavkaForMatch, n, klientForMatch).score }))
    .filter(m => m.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return NextResponse.json(matches);
}
