import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { getUserScope } from "@/lib/scope";
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

/**
 * GET /api/matching/klient/[id]?limit=5
 *
 * Matching pre kupujúceho BEZ objednávky — cez profil klienta (lokalita + rozpočet
 * z karty). Hrubšie ako cez objednávku (chýba druh/izby), preto widget ukáže výzvu
 * doplniť objednávku.
 *
 * Bezpečnosť: requireUser + company scope + cross-tenant check klienta. Vracia
 * kontakty predávajúcich (PII) → musí byť za auth. (Staré matching routes auth
 * nemajú — to rieši security okno; tento endpoint je vzor ako majú vyzerať.)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const scope = await getUserScope(auth.user.id);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });

  const { id } = await params;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "5");
  const sb = getSupabaseAdmin();

  // Klient musí patriť do firmy callera (cross-tenant ochrana).
  const { data: klient } = await sb
    .from("klienti")
    .select("id,lokalita,rozpocet_max,company_id")
    .eq("id", id)
    .maybeSingle();
  if (!klient || klient.company_id !== scope.company_id) {
    return NextResponse.json({ error: "Klient nenájdený" }, { status: 404 });
  }

  const [{ data: nehnutelnosti }, { data: monitorItems }] = await Promise.all([
    sb.from("nehnutelnosti")
      .select("id,klient_id,typ,cena,plocha,izby,lokalita,kraj,okres,status,nazov,lat,lng")
      .eq("company_id", scope.company_id)
      .or("status.eq.aktivny,status.is.null"),
    // Monitor = verejné scraped inzeráty konkurencie (nie PII), bez company filtra.
    sb.from("monitor_inzeraty")
      .select("id,portal,url,nazov,typ,lokalita,cena,plocha,izby,lat,lng")
      .eq("is_active", true),
  ]);

  // Pseudo-objednávka z profilu — bez druhu/izieb (tie sú len v objednávke).
  // Skóre vznikne z lokality (klient.lokalita) a ceny (rozpocet_max) cez klient fallback.
  const pseudoObj: ObjednavkaForMatch = {
    id: `profil-${klient.id}`,
    klient_id: klient.id,
    druh: null,
    poziadavky: null,
    lokalita: null,
    cena_od: null,
    cena_do: null,
  };
  const klientForMatch: KlientForMatch = {
    id: klient.id,
    lokalita: klient.lokalita,
    rozpocet_max: klient.rozpocet_max,
  };

  // Interné nehnuteľnosti + kontakt predávajúceho
  const neh = (nehnutelnosti ?? []) as unknown as NehWithMeta[];
  for (const n of neh) n.source = "internal";
  if (neh.length > 0) {
    const klientIds = [...new Set(neh.map(n => n.klient_id).filter(Boolean))];
    if (klientIds.length > 0) {
      const { data: predavajuci } = await sb.from("klienti").select("id,meno,telefon").in("id", klientIds as string[]);
      const km = new Map((predavajuci ?? []).map(k => [k.id, k]));
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
    lat: m.lat,
    lng: m.lng,
    kraj: null,
    okres: null,
    status: null,
    source: "monitor" as const,
    portal: m.portal,
    url: m.url,
    nazov: m.nazov,
    predavajuci: undefined,
  }));

  const matches = [...neh, ...monitorNeh]
    .map(n => ({ nehnutelnost: n, score: vypocitajSkore(pseudoObj, n, klientForMatch).score }))
    .filter(m => m.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return NextResponse.json(matches);
}
