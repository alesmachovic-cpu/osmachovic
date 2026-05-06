/* ── Parser pre reality.sk ── */

import { ScrapedInzerat, MonitorFilter, PortalParser } from "../types";
import { detectFirma, extractPoschodie, extractStav } from "./shared";

/**
 * Stiahne detail stránku reality.sk a zistí či inzerát patrí realitke.
 * Spoľahlivý DOM signál: prítomnosť linky na profil RK
 *   /realitna-kancelaria/<slug>/<UUID>/
 * Ak link existuje → RK (firma). Ak nie → kandidát na súkromného.
 */
export async function fetchRealitySkIsAgency(url: string): Promise<boolean> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "sk-SK,sk;q=0.9",
      },
    });
    if (!res.ok) return false;
    const html = await res.text();
    return /href="[^"]*\/realitna-kancelaria\/[^"]*"/.test(html);
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

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
    // Ak user zadal vlastný URL, použijeme ho
    if (filter.search_url) return filter.search_url;

    const typSlug = filter.typ ? TYP_URL[filter.typ] || "" : "";
    // Bez lokality: celý slovenský trh pre daný typ
    // S lokalitou: pokusíme sa vytvoriť slug, ale fallback na celé SK
    if (typSlug) {
      return `${BASE_URL}/${typSlug}/predaj/`;
    }
    return `${BASE_URL}/vyhladavanie/predaj/`;
  },

  parseListings(html: string): ScrapedInzerat[] {
    const listings: ScrapedInzerat[] = [];
    const seenIds = new Set<string>();

    // reality.sk — blok "offer-item-in" obsahuje jednu ponuku
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

      // Title
      const titleMatch = block.match(/class="offer-title[^"]*"[^>]*>[\s]*<a[^>]*title="([^"|]+)/);
      const titleAlt = block.match(/title="([^"|]+?)(?:\s*\|\s*Reality\.sk)?"/);
      const nazov = (titleMatch?.[1] || titleAlt?.[1] || "").trim();

      // Price: "139,900 €"
      const priceMatch = block.match(/([\d][,.\d\s]*)\s*€/);
      let cena: number | undefined;
      if (priceMatch) {
        const priceStr = priceMatch[1].replace(/\s/g, "").replace(",", "");
        cena = parseFloat(priceStr);
        if (isNaN(cena)) cena = undefined;
      }

      // Area
      const areaMatch = block.match(/(\d+(?:[,.]\d+)?)\s*m[²2&]/);
      const plocha = areaMatch ? parseFloat(areaMatch[1].replace(",", ".")) : undefined;

      // Rooms
      const roomMatch = (nazov + block).match(/(\d+)[- ]izb/);
      const izby = roomMatch ? parseInt(roomMatch[1]) : undefined;

      // Image
      const imgMatch = block.match(/(?:data-src|src)="(https:\/\/img\.[^"]+)"/);
      const foto_url = imgMatch?.[1]?.replace(/&amp;/g, "&");

      // Location
      const locMatch = block.match(/class="offer-location[^"]*"[^>]*>([\s\S]*?)<\//);
      const lokalita = locMatch?.[1]?.replace(/<[^>]*>/g, "").trim() || undefined;

      // Typ from URL
      let typ = "iny";
      if (relUrl.startsWith("/byty")) typ = "byt";
      else if (relUrl.startsWith("/domy") || relUrl.startsWith("/rodinne")) typ = "dom";
      else if (relUrl.startsWith("/pozemky")) typ = "pozemok";

      // Popis z offer-desc
      const descMatch = block.match(/class="offer-desc[^"]*"[^>]*>([\s\S]*?)<\/p>/);
      const popis = descMatch?.[1]?.replace(/<[^>]*>/g, "").trim().slice(0, 500) || undefined;

      // Poschodie + stav z titulu, popisu a celého bloku
      const textForMeta = `${nazov} ${popis || ""} ${block.replace(/<[^>]*>/g, " ")}`;
      const poschodie = extractPoschodie(textForMeta);
      const stav = extractStav(textForMeta);

      // Detekcia firmy: nazov + popis. undefined = neznámy (prejde filtrom len_sukromni).
      // Zámerne NEskenujeme celý blok — obsahuje breadcrumby a related listings kde
      // sa môže objaviť "realit" aj pri súkromnom inzeráte (false positive).
      const predajca_typ = detectFirma(nazov, popis) ? "firma" : undefined;

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
        popis,
        predajca_typ,
        poschodie,
        stav,
        raw_data: {},
      });
    }

    return listings;
  },
};
