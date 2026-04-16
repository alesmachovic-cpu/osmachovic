/* ── Parser pre reality.sk ── */

import { ScrapedInzerat, MonitorFilter, PortalParser } from "../types";

const PORTAL = "reality.sk";
const BASE_URL = "https://www.reality.sk";

const TYP_URL: Record<string, string> = {
  byt: "byty",
  dom: "domy",
  pozemok: "pozemky",
};

export const realitySkParser: PortalParser = {
  portal: PORTAL,

  buildSearchUrl(filter: MonitorFilter): string {
    if (filter.search_url) return filter.search_url;

    const typSlug = filter.typ ? TYP_URL[filter.typ] || "vyhladavanie" : "vyhladavanie";
    let url = `${BASE_URL}/${typSlug}/`;

    // Lokalita
    if (filter.lokalita) {
      const slug = filter.lokalita
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-");
      // reality.sk format: /byty/2-izbovy-byt/bratislava-petrzalka/predaj/
      if (filter.typ === "byt") {
        url = `${BASE_URL}/byty/${slug}/predaj/`;
      } else {
        url += `${slug}/predaj/`;
      }
    } else {
      url += "predaj/";
    }

    return url;
  },

  parseListings(html: string): ScrapedInzerat[] {
    const listings: ScrapedInzerat[] = [];
    const seenIds = new Set<string>();

    // reality.sk has offer blocks with class "offer-item-in"
    // Each block contains: offer-title, offer-location, price, area, rooms, image
    const blockRegex = /class="offer-item-in\s*"[\s\S]*?(?=class="offer-item-in\s*"|<\/section|<\/main|$)/gi;
    const blocks = html.match(blockRegex) || [];

    for (const block of blocks) {
      // URL & ID: /byty/slug/UNIQUE_ID/
      const urlMatch = block.match(/href="(\/(?:byty|domy|pozemky|rodinne-domy)\/([^\/]+)\/([A-Za-z0-9_-]{8,})\/)"/);
      if (!urlMatch) continue;

      const relUrl = urlMatch[1];
      const externalId = urlMatch[3];
      if (seenIds.has(externalId)) continue;
      seenIds.add(externalId);

      // Title from title attribute or offer-title class
      const titleMatch = block.match(/class="offer-title[^"]*"[^>]*>[\s]*<a[^>]*title="([^"|]+)/);
      const titleAlt = block.match(/title="([^"|]+?)(?:\s*\|\s*Reality\.sk)?"/);
      const nazov = (titleMatch?.[1] || titleAlt?.[1] || "").trim();

      // Price: "139,900 €" format
      const priceMatch = block.match(/([\d][,.\d\s]*)\s*€/);
      let cena: number | undefined;
      if (priceMatch) {
        const priceStr = priceMatch[1].replace(/\s/g, "").replace(",", "");
        cena = parseFloat(priceStr);
        if (isNaN(cena)) cena = undefined;
      }

      // Area: "86 m²"
      const areaMatch = block.match(/(\d+(?:[,.]\d+)?)\s*m[²2&]/);
      const plocha = areaMatch ? parseFloat(areaMatch[1].replace(",", ".")) : undefined;

      // Rooms from title or text
      const roomMatch = (nazov + block).match(/(\d+)[- ]izb/);
      const izby = roomMatch ? parseInt(roomMatch[1]) : undefined;

      // Image
      const imgMatch = block.match(/(?:data-src|src)="(https:\/\/img\.[^"]+)"/);
      const foto_url = imgMatch?.[1]?.replace(/&amp;/g, "&");

      // Location: offer-location class
      const locMatch = block.match(/class="offer-location[^"]*"[^>]*>([\s\S]*?)<\//);
      const lokalita = locMatch?.[1]?.replace(/<[^>]*>/g, "").trim() || undefined;

      // Typ from URL
      let typ = "iny";
      if (relUrl.startsWith("/byty")) typ = "byt";
      else if (relUrl.startsWith("/domy") || relUrl.startsWith("/rodinne")) typ = "dom";
      else if (relUrl.startsWith("/pozemky")) typ = "pozemok";

      listings.push({
        portal: PORTAL,
        external_id: externalId,
        url: `${BASE_URL}${relUrl}`,
        nazov,
        typ,
        lokalita,
        cena,
        plocha,
        izby,
        foto_url,
        raw_data: {},
      });
    }

    return listings;
  },
};
