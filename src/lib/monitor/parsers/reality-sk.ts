/* ── Parser pre reality.sk ── */

import { ScrapedInzerat, MonitorFilter, PortalParser } from "../types";

const PORTAL = "reality.sk";
const BASE_URL = "https://www.reality.sk";

const TYP_URL: Record<string, string> = {
  byt: "byty",
  dom: "rodinne-domy",
  pozemok: "pozemky",
};

export const realitySkParser: PortalParser = {
  portal: PORTAL,

  buildSearchUrl(filter: MonitorFilter): string {
    if (filter.search_url) return filter.search_url;

    const typSlug = filter.typ ? TYP_URL[filter.typ] || "" : "";
    let url = `${BASE_URL}/predaj/${typSlug}`;

    // reality.sk používa query parametre
    const params = new URLSearchParams();
    if (filter.cena_od) params.set("cena_od", String(filter.cena_od));
    if (filter.cena_do) params.set("cena_do", String(filter.cena_do));
    if (filter.plocha_od) params.set("vymera_od", String(filter.plocha_od));
    if (filter.plocha_do) params.set("vymera_do", String(filter.plocha_do));

    if (filter.lokalita) {
      const slug = filter.lokalita
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-");
      url += `/${slug}`;
    }

    const paramStr = params.toString();
    return paramStr ? `${url}/?${paramStr}` : `${url}/`;
  },

  parseListings(html: string): ScrapedInzerat[] {
    const listings: ScrapedInzerat[] = [];
    const seenIds = new Set<string>();

    const priceRegex = /(\d[\d\s,.]*)\s*€/;
    const areaRegex = /(\d[\d,.]*)\s*m[²2]/;
    const roomRegex = /(\d+)[- ]izb/;

    // reality.sk — hľadáme linky na detaily inzerátov
    const detailRegex = /<a[^>]*href="([^"]*\/detail\/([^/"]+)[^"]*)"/g;

    let match;
    while ((match = detailRegex.exec(html)) !== null) {
      const href = match[1];
      const slug = match[2];
      if (seenIds.has(slug)) continue;
      seenIds.add(slug);

      const fullUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;

      // Kontext okolo linku
      const pos = match.index;
      const context = html.substring(
        Math.max(0, pos - 300),
        Math.min(html.length, pos + 600)
      );

      // Názov
      const titleMatch = context.match(
        /(?:title|alt)="([^"]+)"|<h[23][^>]*>([^<]+)/
      );
      const nazov = (titleMatch?.[1] || titleMatch?.[2] || slug).trim();

      // Cena
      const priceMatch = context.match(priceRegex);
      const cena = priceMatch
        ? parseFloat(priceMatch[1].replace(/\s/g, "").replace(",", "."))
        : undefined;

      // Plocha
      const areaMatch = context.match(areaRegex);
      const plocha = areaMatch
        ? parseFloat(areaMatch[1].replace(",", "."))
        : undefined;

      // Izby
      const roomMatch = context.match(roomRegex);
      const izby = roomMatch ? parseInt(roomMatch[1]) : undefined;

      // Typ
      let typ = "iny";
      const ctxLower = context.toLowerCase();
      if (ctxLower.includes("izb") || ctxLower.includes("byt")) typ = "byt";
      else if (ctxLower.includes("dom") || ctxLower.includes("rodin")) typ = "dom";
      else if (ctxLower.includes("pozem")) typ = "pozemok";

      // Foto
      const imgMatch = context.match(
        /<img[^>]*src="([^"]*(?:jpg|jpeg|png|webp)[^"]*)"/i
      );

      // Lokalita
      const lokMatch = context.match(
        /(?:location|address|city|lokalita)[^>]*>([^<]+)/i
      );

      listings.push({
        portal: PORTAL,
        external_id: slug,
        url: fullUrl,
        nazov,
        typ,
        lokalita: lokMatch?.[1]?.trim(),
        cena,
        plocha,
        izby,
        foto_url: imgMatch?.[1],
        raw_data: {},
      });
    }

    return listings;
  },
};
