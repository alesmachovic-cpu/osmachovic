/* ── Parser pre topreality.sk ── */

import { ScrapedInzerat, MonitorFilter, PortalParser } from "../types";
import { detectFirma } from "./shared";

const PORTAL = "topreality.sk";
const BASE_URL = "https://www.topreality.sk";

const TYP_URL: Record<string, string> = {
  byt: "byty",
  dom: "domy",
  pozemok: "pozemky",
};

export const toprealitySkParser: PortalParser = {
  portal: PORTAL,

  buildSearchUrl(filter: MonitorFilter): string {
    if (filter.search_url) return filter.search_url;

    const typSlug = filter.typ ? TYP_URL[filter.typ] || "nehnutelnosti" : "nehnutelnosti";
    let url = `${BASE_URL}/predaj-${typSlug}`;

    if (filter.lokalita) {
      const slug = filter.lokalita
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-");
      url += `-${slug}`;
    }

    const params = new URLSearchParams();
    if (filter.cena_od) params.set("cena_od", String(filter.cena_od));
    if (filter.cena_do) params.set("cena_do", String(filter.cena_do));
    if (filter.plocha_od) params.set("plocha_od", String(filter.plocha_od));
    if (filter.plocha_do) params.set("plocha_do", String(filter.plocha_do));

    const paramStr = params.toString();
    return paramStr ? `${url}?${paramStr}` : url;
  },

  parseListings(html: string): ScrapedInzerat[] {
    const listings: ScrapedInzerat[] = [];
    const seenIds = new Set<string>();

    const priceRegex = /(\d[\d\s,.]*)\s*€/;
    const areaRegex = /(\d[\d,.]*)\s*m[²2]/;
    const roomRegex = /(\d+)[- ]izb/;

    // topreality.sk — reálne URL majú tvar /title-slug-r<NNNN>.html
    // Predošlý regex `\/(\d{5,})` hľadal "/1234..." (digits priamo za /), čo
    // nikdy nesedelo so skutočným formátom, preto nič nenachádzal.
    const detailRegex = /<a[^>]*href="((?:https?:\/\/[^"]*topreality\.sk)?\/[a-z0-9-]+-r(\d+)\.html)"/gi;

    let match;
    while ((match = detailRegex.exec(html)) !== null) {
      const href = match[1];
      const externalId = match[2];
      if (seenIds.has(externalId)) continue;
      seenIds.add(externalId);

      const fullUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;

      const pos = match.index;
      const context = html.substring(
        Math.max(0, pos - 300),
        Math.min(html.length, pos + 600)
      );

      const titleMatch = context.match(
        /(?:title|alt)="([^"]+)"|<h[23][^>]*>([^<]+)/
      );
      const nazov = (titleMatch?.[1] || titleMatch?.[2] || "").trim();

      const priceMatch = context.match(priceRegex);
      const cena = priceMatch
        ? parseFloat(priceMatch[1].replace(/\s/g, "").replace(",", "."))
        : undefined;

      const areaMatch = context.match(areaRegex);
      const plocha = areaMatch
        ? parseFloat(areaMatch[1].replace(",", "."))
        : undefined;

      const roomMatch = context.match(roomRegex);
      const izby = roomMatch ? parseInt(roomMatch[1]) : undefined;

      let typ = "iny";
      const ctxLower = context.toLowerCase();
      if (ctxLower.includes("izb") || ctxLower.includes("byt")) typ = "byt";
      else if (ctxLower.includes("dom") || ctxLower.includes("rodin")) typ = "dom";
      else if (ctxLower.includes("pozem")) typ = "pozemok";

      const imgMatch = context.match(
        /<img[^>]*src="([^"]*(?:jpg|jpeg|png|webp)[^"]*)"/i
      );

      const lokMatch = context.match(
        /(?:location|address|city|lokalita)[^>]*>([^<]+)/i
      );

      const sellerMatch = context.match(
        /class="[^"]*(?:advertiser|seller|agent|agency|broker|company|realitka|inzerent)[^"]*"[^>]*>\s*(?:<[^>]*>\s*)*([^<]{2,100})/i
      );
      const predajca_meno = sellerMatch?.[1]?.replace(/\s+/g, " ").trim() || undefined;
      const isFirma = detectFirma(nazov, predajca_meno);

      listings.push({
        portal: PORTAL,
        external_id: externalId,
        url: fullUrl,
        nazov,
        typ,
        lokalita: lokMatch?.[1]?.trim(),
        cena,
        plocha,
        izby,
        foto_url: imgMatch?.[1],
        predajca_meno,
        predajca_typ: isFirma ? "firma" : undefined,
        raw_data: {},
      });
    }

    return listings;
  },
};
