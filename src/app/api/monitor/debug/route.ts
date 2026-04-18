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

    return NextResponse.json({
      portal,
      searchUrl,
      needsJs,
      fetchMs,
      httpStatus: status,
      scrapingBeeCost: cost,
      htmlLength: html.length,
      htmlStart: html.slice(0, 2000),
      htmlEnd: html.slice(-500),
      parsedCount: listings.length,
      firstListing: listings[0] || null,
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
