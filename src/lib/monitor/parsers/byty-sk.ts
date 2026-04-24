/* ── Parser pre byty.sk ── */

import { ScrapedInzerat, MonitorFilter, PortalParser } from "../types";
import { detectFirma } from "./shared";

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

          // Predajca: bežné polia v byty.sk Next.js dátach
          const sellerObj = (item.advertiser || item.agent || item.broker || item.seller || item.owner) as
            | Record<string, unknown>
            | string
            | undefined;
          const sellerName =
            typeof sellerObj === "string"
              ? sellerObj
              : String(
                  (sellerObj?.name as string | undefined) ||
                  (sellerObj?.title as string | undefined) ||
                  (sellerObj?.company as string | undefined) ||
                  item.predajca ||
                  ""
                );
          const predajca_meno = sellerName.trim() || undefined;
          const isFirma = detectFirma(title, predajca_meno);

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
            predajca_meno,
            predajca_typ: isFirma ? "firma" : undefined,
            raw_data: {},
          });
        }
        if (listings.length > 0) return listings;
      } catch { /* ignore, fallback to HTML parsing */ }
    }

    // Strategy 2: reálne URL na byty.sk sú na mobilnej subdoméne:
    // https://m.byty.sk/<id>/<slug>/detail  (alebo /kontakt, /foto…)
    // Extrahujeme všetky unikátne id, okolie (~1500 znakov pred/800 po) použijeme
    // na cenu, title, fotku, plochu, izby.
    const urlRegex = /https?:\/\/m\.byty\.sk\/(\d{5,})\/([a-z0-9-]+)\/[a-z]+/gi;
    let match;
    while ((match = urlRegex.exec(html)) !== null) {
      const externalId = match[1];
      const slug = match[2];
      if (seenIds.has(externalId)) continue;
      seenIds.add(externalId);

      const pos = match.index;
      const context = html.substring(
        Math.max(0, pos - 1500),
        Math.min(html.length, pos + 800)
      );

      // Title — buď text hneď za linkom, alebo derived zo slugu
      let nazov = "";
      const titleRe = new RegExp(
        `href="https?://m\\.byty\\.sk/${externalId}/[^"]+"[^>]*>\\s*([^<]{5,200})`,
        "i"
      );
      const titleMatch = context.match(titleRe);
      nazov = titleMatch?.[1]?.replace(/\s+/g, " ").trim() || "";
      if (!nazov || nazov.length < 5) {
        nazov = slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      }

      // Cena — prvá hodnota s €, pravdepodobne s thousand separators
      const priceMatch = context.match(/([\d]{2,3}(?:[\s\u00A0,.][\d]{3})+|\d{4,})\s*€/);
      const cena = priceMatch ? parseFloat(priceMatch[1].replace(/[\s\u00A0,.]/g, "")) : undefined;

      const areaMatch = context.match(/(\d+(?:[,.]\d+)?)\s*m[²2]/);
      const plocha = areaMatch ? parseFloat(areaMatch[1].replace(",", ".")) : undefined;

      const roomMatch = context.match(/(\d+)\s*[-]?\s*izb/i);
      const izby = roomMatch ? parseInt(roomMatch[1]) : undefined;

      const imgMatch = context.match(/<img[^>]+src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp))"/i);
      const foto_url = imgMatch?.[1];

      // Typ + lokalita zo slugu
      const slugLower = slug.toLowerCase();
      let typ = "byt";
      if (slugLower.includes("dom") || slugLower.includes("rodin")) typ = "dom";
      else if (slugLower.includes("pozem") || slugLower.includes("parcel")) typ = "pozemok";

      const lokMatch = slugLower.match(/(bratislava|kosice|nitra|zilina|trnava|presov|banska-bystrica|trencin|martin|poprad|malacky|pezinok|senec|ruzinov|petrzalka|dubravka|stare-mesto|karlova-ves|nove-mesto|vajnory|devin|lamac|raca|vrakuna)/);
      const lokalita = lokMatch?.[1]?.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

      const isFirma = detectFirma(nazov, slug);

      listings.push({
        portal: PORTAL,
        external_id: externalId,
        url: `https://m.byty.sk/${externalId}/${slug}/`,
        nazov, typ,
        lokalita,
        cena, plocha, izby, foto_url,
        predajca_typ: isFirma ? "firma" : undefined,
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
