/* ── Parser pre nehnutelnosti.sk ── */

import { ScrapedInzerat, MonitorFilter, PortalParser } from "../types";
import { detectFirma } from "./shared";

/**
 * nehnutelnosti.sk — najväčší slovenský portál (Next.js + MUI, JS rendered).
 *
 * URL štruktúra vyhľadávania:
 *   https://www.nehnutelnosti.sk/byty/predaj/bratislava-petrzalka/?p[price_from]=50000
 *
 * URL štruktúra listingu:
 *   https://www.nehnutelnosti.sk/detail/{ID}/{slug}
 *   kde ID je base64-like reťazec (napr. "JuNsD-G_cAb", "Ju8StS94aWw").
 *
 * Developerské projekty majú iný pattern:
 *   /detail/developersky-projekt/{id}/{slug}  ← tieto preskakujeme (nie sú to
 *   klasické inzeráty, ale marketingové stránky projektov).
 *
 * Parser stratégia: link-driven — nehnutelnosti.sk má hashnuté MUI CSS classes
 * (napr. "mui-1blo5z7"), takže nemôžeme hľadať container blocky podľa class mena.
 * Namiesto toho nájdeme všetky detail URL a z okolného kontextu extrahujeme
 * metadáta (cena, plocha, izby, meno inzerenta).
 */

const PORTAL = "nehnutelnosti.sk";
const BASE_URL = "https://www.nehnutelnosti.sk";

const TYP_URL: Record<string, string> = {
  byt: "byty",
  dom: "domy",
  pozemok: "pozemky",
};

export const nehnutelnostiSkParser: PortalParser = {
  portal: PORTAL,

  buildSearchUrl(filter: MonitorFilter): string {
    if (filter.search_url) return filter.search_url;

    const typSlug = filter.typ ? TYP_URL[filter.typ] || "nehnutelnosti" : "nehnutelnosti";
    let url = `${BASE_URL}/${typSlug}/predaj/`;

    if (filter.lokalita) {
      const slug = filter.lokalita
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-");
      url = `${BASE_URL}/${typSlug}/predaj/${slug}/`;
    }

    const params = new URLSearchParams();
    if (filter.cena_od) params.set("p[price_from]", String(filter.cena_od));
    if (filter.cena_do) params.set("p[price_to]", String(filter.cena_do));
    if (filter.plocha_od) params.set("p[area_from]", String(filter.plocha_od));
    if (filter.plocha_do) params.set("p[area_to]", String(filter.plocha_do));

    const paramStr = params.toString();
    return paramStr ? `${url}?${paramStr}` : url;
  },

  parseListings(html: string): ScrapedInzerat[] {
    const listings: ScrapedInzerat[] = [];
    const seenIds = new Set<string>();

    // Match /detail/{ID}/{slug} ako absolútnu aj relatívnu URL.
    // Skipuje /detail/developersky-projekt/{id}/{slug} (marketing, nie inzeráty).
    const detailRegex =
      /href="((?:https?:\/\/[^"]*nehnutelnosti\.sk)?\/detail\/(?!developersky-projekt\/)([A-Za-z0-9_-]{8,})\/([^"\s]+?))"/g;

    const roomRegex = /(\d+)\s*[- ]?izb/i;
    const imgRegex = /<img[^>]*src="([^"]+(?:\.jpe?g|\.png|\.webp|nehnutelnosti[^"]+))"/i;

    let match: RegExpExecArray | null;
    while ((match = detailRegex.exec(html)) !== null) {
      const hrefRaw = match[1];
      const externalId = match[2];
      const slug = match[3];

      if (seenIds.has(externalId)) continue;
      seenIds.add(externalId);

      const fullUrl = hrefRaw.startsWith("http") ? hrefRaw : `${BASE_URL}${hrefRaw}`;

      // Kontext: ~3000 znakov okolo href. Ceny a metadata bývajú v rovnakej
      // "karte" listingu (MUI Stack/Box), blízko linku.
      const pos = match.index;
      const context = html.substring(
        Math.max(0, pos - 500),
        Math.min(html.length, pos + 3000)
      );

      // Nazov — ak je link s text content, použijeme ho; inak derive zo slugu.
      const anchorTextMatch = html.substring(pos, Math.min(html.length, pos + 2000))
        .match(/<a[^>]*href="[^"]+"[^>]*>([\s\S]*?)<\/a>/);
      let nazov = anchorTextMatch?.[1]?.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() || "";
      // Ak je to prázdne alebo veľmi krátke, použijeme slug
      if (nazov.length < 5) {
        nazov = slug.replace(/-/g, " ").trim();
      }
      // Zachytí aj ak slug obsahuje "bratislava" alebo mesto — nechaj ho ako je.

      // Cena — hľadáme v context, preferujeme hodnoty > 10k (typická cena nehnuteľnosti)
      const priceMatches = Array.from(context.matchAll(/(\d[\d\s]{2,})\s*€/g));
      let cena: number | undefined;
      for (const pm of priceMatches) {
        const num = parseFloat(pm[1].replace(/\s/g, ""));
        if (!isNaN(num) && num >= 1000 && num < 100_000_000) {
          cena = num;
          break;
        }
      }

      // Plocha — berieme prvú hodnotu >= 15 (menej ako 15 m² pre byt/dom je nerealistické;
      // menšie čísla bývajú "5 m od MHD" v popise, alebo počítadlá izieb).
      let plocha: number | undefined;
      for (const am of context.matchAll(/(\d+(?:[,.]\d+)?)\s*m[²2]/g)) {
        const val = parseFloat(am[1].replace(",", "."));
        if (!isNaN(val) && val >= 15 && val < 10000) {
          plocha = val;
          break;
        }
      }

      // Izby — "3-izbový", "3 izb", "3izb"
      const roomMatch = context.match(roomRegex);
      const izby = roomMatch ? parseInt(roomMatch[1]) : undefined;

      // Foto
      const imgMatch = context.match(imgRegex);
      const foto_url = imgMatch?.[1];

      // Lokalita — heuristika: krátky text s velkým písmenom za znakom "•" alebo
      // v context bez "Izb"/"€"
      let lokalita: string | undefined;
      const lokMatch = context.match(
        /(?:Bratislava|Košice|Nitra|Žilina|Trnava|Prešov|Banská\s+Bystrica|Trenčín|Martin|Poprad|Malacky|Pezinok|Senec|Ružinov|Petržalka|Dúbravka|Staré\s+Mesto)[^<"\n]{0,60}/
      );
      if (lokMatch) lokalita = lokMatch[0].trim();

      // Typ zo slugu / názvu
      let typ = "byt";
      const slugLower = slug.toLowerCase();
      if (slugLower.includes("dom") || slugLower.includes("rodin")) typ = "dom";
      else if (slugLower.includes("pozem") || slugLower.includes("parcel")) typ = "pozemok";
      else if (slugLower.includes("byt") || slugLower.includes("izb")) typ = "byt";

      // Predajca — skúsime rôzne patterny (agent, realitka, meno)
      const sellerMatch = context.match(
        /class="[^"]*(?:advertiser|seller|agent|agency|broker|company|realitka|inzerent|maklér)[^"]*"[^>]*>\s*(?:<[^>]*>\s*)*([^<]{2,100})/i
      );
      let predajca_meno = sellerMatch?.[1]?.replace(/\s+/g, " ").trim() || undefined;
      // Fallback: hľadaj "s.r.o." alebo podobné v context
      if (!predajca_meno) {
        const companyMatch = context.match(/([A-ZČŠĽŇŽ][A-Za-záčďéíľňóšťúýž\s&.'-]{2,50}\s+(?:s\.\s*r\.\s*o\.?|a\.s\.|reality|real|estate|broker|invest|group))/);
        predajca_meno = companyMatch?.[1]?.trim();
      }

      // nehnutelnosti.sk je dominantne RK portál (>95% inzerátov je od realitiek).
      // Stratégia: ak detectFirma trafí → firma. Inak hľadáme explicitné
      // súkromné markery. Ak ich nie je → konzervatívny default "firma"
      // (radšej prepásť súkromného ako spamovať používateľa realitkami).
      const isFirma = detectFirma(nazov, predajca_meno);
      const privateMarkers = ["súkromný predaj", "sukromny predaj", "predám byt", "predam byt", "predám dom", "predam dom"];
      const textLow = (nazov + " " + (predajca_meno || "")).toLowerCase();
      const hasPrivateMarker = privateMarkers.some((m) => textLow.includes(m));
      let predajca_typ: "firma" | "sukromny" | undefined;
      if (isFirma) predajca_typ = "firma";
      else if (hasPrivateMarker) predajca_typ = "sukromny";
      else predajca_typ = "firma";

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
        predajca_meno,
        predajca_typ,
        raw_data: {},
      });
    }

    return listings;
  },
};
