/* ── Parser pre nehnutelnosti.sk ── */

import { ScrapedInzerat, MonitorFilter, PortalParser } from "../types";

/**
 * nehnutelnosti.sk — najväčší slovenský portál
 *
 * URL štruktúra vyhľadávania:
 * https://www.nehnutelnosti.sk/byty/predaj/?p[price_from]=50000&p[price_to]=150000
 *
 * HTML štruktúra listingu (zjednodušená):
 * <div class="advertisement-item">
 *   <a href="/1234567/" class="advertisement-item--content__title">Názov</a>
 *   <span class="advertisement-item--content__price">120 000 €</span>
 *   <span class="advertisement-item--content__info">3-izbový byt, 75 m²</span>
 *   ...
 * </div>
 */

const PORTAL = "nehnutelnosti.sk";
const BASE_URL = "https://www.nehnutelnosti.sk";

// Mapovanie typov na URL segmenty
const TYP_URL: Record<string, string> = {
  byt: "byty",
  dom: "domy",
  pozemok: "pozemky",
};

export const nehnutelnostiSkParser: PortalParser = {
  portal: PORTAL,

  buildSearchUrl(filter: MonitorFilter): string {
    // Ak máme priamy search URL, použijeme ho
    if (filter.search_url) return filter.search_url;

    const typSlug = filter.typ ? TYP_URL[filter.typ] || "nehnutelnosti" : "nehnutelnosti";
    let url = `${BASE_URL}/${typSlug}/predaj/`;

    const params = new URLSearchParams();
    if (filter.cena_od) params.set("p[price_from]", String(filter.cena_od));
    if (filter.cena_do) params.set("p[price_to]", String(filter.cena_do));
    if (filter.plocha_od) params.set("p[area_from]", String(filter.plocha_od));
    if (filter.plocha_do) params.set("p[area_to]", String(filter.plocha_do));

    // Lokalita — ak máme napr. "bratislava-petrzalka"
    if (filter.lokalita) {
      const slug = filter.lokalita
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-");
      url = `${BASE_URL}/${typSlug}/predaj/${slug}/`;
    }

    const paramStr = params.toString();
    return paramStr ? `${url}?${paramStr}` : url;
  },

  parseListings(html: string): ScrapedInzerat[] {
    const listings: ScrapedInzerat[] = [];

    // Regex-based parsing (robustnejšie ako DOM parser na serverless)
    // Pattern pre advertisement items
    const itemRegex = /<div[^>]*class="[^"]*advertisement-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
    // Alternatívny pattern pre novší layout
    const altItemRegex = /<article[^>]*class="[^"]*property[^"]*"[^>]*>([\s\S]*?)<\/article>/g;

    // Extrahuj všetky linky na inzeráty
    const linkRegex = /<a[^>]*href="(\/\d{6,}\/?[^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    const priceRegex = /(\d[\d\s,.]*)\s*€/;
    const areaRegex = /(\d[\d,.]*)\s*m[²2]/;
    const roomRegex = /(\d+)[- ]izb/;
    const imgRegex = /<img[^>]*src="([^"]*(?:jpg|jpeg|png|webp)[^"]*)"/i;

    // Zberieme unikátne inzeráty podľa URL
    const seenIds = new Set<string>();

    // Hlavný listing pattern — hľadáme bloky s cenami a odkazmi
    const blockRegex = /<(?:div|article|li)[^>]*class="[^"]*(?:advertisement|listing|property|result)[^"]*"[^>]*>([\s\S]*?)(?=<(?:div|article|li)[^>]*class="[^"]*(?:advertisement|listing|property|result)|$)/gi;

    let blockMatch;
    while ((blockMatch = blockRegex.exec(html)) !== null) {
      const block = blockMatch[1];

      // Extrahuj URL a ID
      const urlMatch = block.match(/<a[^>]*href="((?:https?:\/\/[^"]*nehnutelnosti\.sk)?\/(\d{6,})\/?[^"]*)"/);
      if (!urlMatch) continue;

      const relUrl = urlMatch[1];
      const externalId = urlMatch[2];
      if (seenIds.has(externalId)) continue;
      seenIds.add(externalId);

      const fullUrl = relUrl.startsWith("http") ? relUrl : `${BASE_URL}${relUrl}`;

      // Extrahuj názov — text v prvom linku alebo title atribút
      const titleMatch = block.match(/<a[^>]*href="[^"]*\/\d{6,}[^"]*"[^>]*(?:title="([^"]*)")?[^>]*>([^<]*)</);
      const nazov = (titleMatch?.[1] || titleMatch?.[2] || "").trim();

      // Cena
      const priceMatch = block.match(priceRegex);
      const cena = priceMatch
        ? parseFloat(priceMatch[1].replace(/\s/g, "").replace(",", "."))
        : undefined;

      // Plocha
      const areaMatch = block.match(areaRegex);
      const plocha = areaMatch
        ? parseFloat(areaMatch[1].replace(",", "."))
        : undefined;

      // Izby
      const roomMatch = block.match(roomRegex);
      const izby = roomMatch ? parseInt(roomMatch[1]) : undefined;

      // Foto
      const imgMatch = block.match(imgRegex);
      const foto_url = imgMatch?.[1] || undefined;

      // Typ — odhadni z kontextu
      let typ = "iny";
      const blockLower = block.toLowerCase();
      if (blockLower.includes("izb") || blockLower.includes("byt")) typ = "byt";
      else if (blockLower.includes("dom") || blockLower.includes("rodin")) typ = "dom";
      else if (blockLower.includes("pozem")) typ = "pozemok";

      // Lokalita — hľadaj v texte
      const lokMatch = block.match(/(?:class="[^"]*(?:location|address|city)[^"]*"[^>]*>)\s*([^<]+)/i);
      const lokalita = lokMatch?.[1]?.trim() || undefined;

      listings.push({
        portal: PORTAL,
        external_id: externalId,
        url: fullUrl,
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

    // Fallback: ak sme nič nenašli cez bloky, skúsime jednoduchšie linky
    if (listings.length === 0) {
      let linkMatch;
      while ((linkMatch = linkRegex.exec(html)) !== null) {
        const href = linkMatch[1];
        const idMatch = href.match(/\/(\d{6,})\/?/);
        if (!idMatch) continue;

        const externalId = idMatch[1];
        if (seenIds.has(externalId)) continue;
        seenIds.add(externalId);

        // Skús nájsť okolný kontext (500 znakov okolo)
        const pos = linkMatch.index;
        const context = html.substring(Math.max(0, pos - 200), Math.min(html.length, pos + 500));

        const priceMatch = context.match(priceRegex);
        const areaMatch = context.match(areaRegex);

        listings.push({
          portal: PORTAL,
          external_id: externalId,
          url: `${BASE_URL}${href}`,
          nazov: linkMatch[2].replace(/<[^>]*>/g, "").trim(),
          cena: priceMatch ? parseFloat(priceMatch[1].replace(/\s/g, "").replace(",", ".")) : undefined,
          plocha: areaMatch ? parseFloat(areaMatch[1].replace(",", ".")) : undefined,
          raw_data: {},
        });
      }
    }

    return listings;
  },
};
