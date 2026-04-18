import { NextResponse } from "next/server";
import { PORTALS, PORTALS_NO_SCRAPINGBEE, fetchPage } from "@/lib/monitor";
import type { MonitorFilter } from "@/lib/monitor";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/monitor/debug?portal=nehnutelnosti.sk&lokalita=bratislava-ruzinov&typ=byt
 *
 * Diagnostický endpoint — pre daný portál vráti:
 * - search URL ktorý parser zostaví
 * - dĺžku HTML ktorú dostal
 * - prvých 2000 znakov HTML
 * - počet parsnutých inzerátov + ukážku prvého
 *
 * Slúži na diagnostiku prečo konkrétny parser vracia 0 inzerátov.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const portal = searchParams.get("portal") || "nehnutelnosti.sk";

  const parser = PORTALS[portal];
  if (!parser) {
    return NextResponse.json({ error: `Unknown portal: ${portal}` }, { status: 400 });
  }

  const filter: MonitorFilter = {
    id: "debug",
    nazov: "debug",
    portal: portal as MonitorFilter["portal"],
    typ: (searchParams.get("typ") as MonitorFilter["typ"]) || "byt",
    lokalita: searchParams.get("lokalita") || undefined,
    cena_od: searchParams.get("cena_od") ? Number(searchParams.get("cena_od")) : undefined,
    cena_do: searchParams.get("cena_do") ? Number(searchParams.get("cena_do")) : undefined,
    is_active: true,
    len_sukromni: false,
    notify_email: false,
    notify_telegram: false,
    created_at: "",
    updated_at: "",
  } as MonitorFilter;

  const searchUrl = parser.buildSearchUrl(filter);
  const needsJs = !PORTALS_NO_SCRAPINGBEE.includes(portal);

  try {
    const t0 = Date.now();
    const { html, status, cost } = await fetchPage({
      url: searchUrl,
      renderJs: needsJs,
      waitMs: needsJs ? 2000 : 0,
    });
    const fetchMs = Date.now() - t0;

    const listings = parser.parseListings(html);

    // Diagnostika HTML — extrahuj ukážky href odkazov
    const hrefWithNum = Array.from(html.matchAll(/href="(\/[^"]*\/\d{5,}[^"]*)"/g)).map((m) => m[1]);
    const uniqueHrefs = Array.from(new Set(hrefWithNum)).slice(0, 10);

    // Všetky href obsahujúce /byty/, /domy/, /detail/, /ponuka/, /byt-, /dom- atď.
    const listingHrefs = Array.from(
      html.matchAll(/href="(\/(?:byty|domy|pozemky|detail|ponuka|ponuky|byt-|dom-|inzerat)[^"]*)"/g)
    ).map((m) => m[1]);
    const uniqueListingHrefs = Array.from(new Set(listingHrefs)).slice(0, 15);

    // Absolútne URL na nehnutelnosti/byty/byt/detail
    const absHrefs = Array.from(
      html.matchAll(/href="(https?:\/\/[^"]*(?:byty|domy|byt-|dom-|detail|ponuka)[^"]*)"/g)
    ).map((m) => m[1]);
    const uniqueAbsHrefs = Array.from(new Set(absHrefs)).slice(0, 10);

    const classMatches = Array.from(
      html.matchAll(/<(?:div|article|li|section)[^>]*class="([^"]{5,120})"/g)
    ).map((m) => m[1]);
    // Zgrupuj a spočítaj, vráť top 20 najčastejších
    const classCounts: Record<string, number> = {};
    for (const c of classMatches) classCounts[c] = (classCounts[c] || 0) + 1;
    const topClasses = Object.entries(classCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 25)
      .map(([cls, count]) => ({ cls, count }));

    // __NEXT_DATA__ — Next.js appky často majú data v JSON script tagu
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]{1,500})/);
    const nextDataPreview = nextDataMatch?.[1]?.slice(0, 400);

    // Hľadaj textové markery typické pre inzeráty (ceny, izby)
    const priceCount = (html.match(/\d[\d\s]*\s*€/g) || []).length;
    const izbyCount = (html.match(/\d[- ]izb/g) || []).length;

    return NextResponse.json({
      portal,
      searchUrl,
      needsJs,
      fetchMs,
      httpStatus: status,
      scrapingBeeCost: cost,
      htmlLength: html.length,
      parsedCount: listings.length,
      firstListing: listings[0] || null,
      allListings: listings.map((l) => ({
        nazov: l.nazov,
        predajca_typ: l.predajca_typ,
        predajca_meno: l.predajca_meno,
      })),
      diagnostics: {
        priceOccurrences: priceCount,
        izbyOccurrences: izbyCount,
        uniqueHrefsWithNumbers: uniqueHrefs,
        listingLikeHrefs: uniqueListingHrefs,
        absoluteListingHrefs: uniqueAbsHrefs,
        topContainerClasses: topClasses,
        hasNextData: !!nextDataMatch,
        nextDataPreview,
      },
      htmlStart: html.slice(0, 1500),
    });
  } catch (e) {
    return NextResponse.json({
      portal,
      searchUrl,
      needsJs,
      error: String(e),
    });
  }
}
