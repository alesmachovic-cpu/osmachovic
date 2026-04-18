/* ── Parser pre byty.sk ── */

import { ScrapedInzerat, MonitorFilter, PortalParser } from "../types";

/**
 * byty.sk — slovenský realitný portál (SPA, potrebuje ScrapingBee JS rendering)
 *
 * URL formát: https://www.byty.sk/vyhladavanie?search[typ]=byty&search[forma]=predaj
 * Listing detail: https://www.byty.sk/byt/nazov-XYZ123
 */

const PORTAL = "byty.sk";
const BASE_URL = "https://www.byty.sk";

const TYP_URL: Record<string, string> = {
  byt: "byty",
  dom: "domy",
  pozemok: "pozemky",
};

export const bytySkParser: PortalParser = {
  portal: PORTAL,

  buildSearchUrl(filter: MonitorFilter): string {
    if (filter.search_url) return filter.search_url;

    const typSlug = filter.typ ? TYP_URL[filter.typ] || "nehnutelnosti" : "nehnutelnosti";
    let url = `${BASE_URL}/${typSlug}/predaj/`;

    const params = new URLSearchParams();
    if (filter.cena_od) params.set("cena_od", String(filter.cena_od));
    if (filter.cena_do) params.set("cena_do", String(filter.cena_do));
    if (filter.lokalita) params.set("lokalita", filter.lokalita);

    const qs = params.toString();
    if (qs) url += `?${qs}`;
    return url;
  },

  parseListings(html: string): ScrapedInzerat[] {
    const listings: ScrapedInzerat[] = [];
    const seenIds = new Set<string>();

    // Strategy 1: __NEXT_DATA__ JSON (ak je to Next.js app)
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const data = JSON.parse(nextDataMatch[1]);
        const items = findListingsInObject(data);
        for (const item of items) {
          const id = String(item.id || item.uid || item.slug || "");
          if (!id || seenIds.has(id)) continue;
          seenIds.add(id);

          const price = Number(item.price || item.cena || 0) || undefined;
          const area = Number(item.area || item.plocha || item.rozloha || 0) || undefined;
          const rooms = Number(item.rooms || item.izby || 0) || undefined;
          const title = String(item.title || item.nazov || item.name || "");
          const url = item.url
            ? (String(item.url).startsWith("http") ? String(item.url) : `${BASE_URL}${item.url}`)
            : `${BASE_URL}/byt/${id}`;
          const loc = item.location as Record<string, unknown> | undefined;
          const location = String(loc?.city || item.lokalita || item.mesto || "");

          listings.push({
            portal: PORTAL,
            external_id: id,
            url,
            nazov: title,
            typ: String(item.type || item.typ || "byt"),
            lokalita: location || undefined,
            cena: price,
            plocha: area,
            izby: rooms,
            foto_url: (item.image || item.photo || item.foto) as string | undefined,
            raw_data: {},
          });
        }
        if (listings.length > 0) return listings;
      } catch { /* ignore, fallback to HTML parsing */ }
    }

    // Strategy 2: Regex-based HTML parsing (pre ne-Next.js verzie alebo HTML output)
    // Hľadáme bloky s class obsahujúcou listing/property/advertisement
    const blockRegex = /<(?:div|article|li)[^>]*class="[^"]*(?:result|listing|property|advertisement|byt-card)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|article|li)>/gi;

    let match;
    while ((match = blockRegex.exec(html)) !== null) {
      const block = match[1];

      // URL + ID
      const urlMatch = block.match(/href="(\/(?:byt|dom|pozemok)\/[^"]*(\d{4,})[^"]*)"/);
      if (!urlMatch) continue;
      const relUrl = urlMatch[1];
      const externalId = urlMatch[2];
      if (seenIds.has(externalId)) continue;
      seenIds.add(externalId);

      const titleMatch = block.match(/<(?:h2|h3|a)[^>]*>([^<]+)</);
      const nazov = titleMatch?.[1]?.trim() || "";

      const priceMatch = block.match(/([\d\s][\d\s,.]*)\s*€/);
      const cena = priceMatch ? parseFloat(priceMatch[1].replace(/\s/g, "").replace(",", ".")) : undefined;

      const areaMatch = block.match(/(\d+(?:[,.]\d+)?)\s*m[²2]/);
      const plocha = areaMatch ? parseFloat(areaMatch[1].replace(",", ".")) : undefined;

      const roomMatch = block.match(/(\d+)\s*[-]?\s*izb/i);
      const izby = roomMatch ? parseInt(roomMatch[1]) : undefined;

      const imgMatch = block.match(/<img[^>]+src="(https?:\/\/[^"]+)"/);
      const foto_url = imgMatch?.[1];

      let typ = "byt";
      if (relUrl.startsWith("/dom")) typ = "dom";
      else if (relUrl.startsWith("/pozemok")) typ = "pozemok";

      listings.push({
        portal: PORTAL,
        external_id: externalId,
        url: `${BASE_URL}${relUrl}`,
        nazov, typ,
        cena, plocha, izby, foto_url,
        raw_data: {},
      });
    }

    return listings;
  },
};

/** Helper: rekurzívne nájdi listing-like objekty v nested Next.js data */
function findListingsInObject(obj: unknown): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  if (!obj || typeof obj !== "object") return results;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item && typeof item === "object") {
        // Heuristika: listing má id + cenu ALEBO title + area
        const rec = item as Record<string, unknown>;
        if (rec.id && (rec.price || rec.cena || rec.rozloha)) {
          results.push(rec);
        } else {
          results.push(...findListingsInObject(rec));
        }
      }
    }
    return results;
  }

  for (const key of Object.keys(obj)) {
    if (key.match(/^(listings|results|data|items|estates|properties|ads|byty|domy)$/i)) {
      results.push(...findListingsInObject((obj as Record<string, unknown>)[key]));
    } else {
      results.push(...findListingsInObject((obj as Record<string, unknown>)[key]));
    }
  }

  return results;
}
