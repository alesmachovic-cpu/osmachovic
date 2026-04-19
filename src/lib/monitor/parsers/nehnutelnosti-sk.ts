/* ── Parser pre nehnutelnosti.sk ── */

import { ScrapedInzerat, MonitorFilter, PortalParser } from "../types";
import { detectFirma } from "./shared";

/**
 * Stiahne detail stránku listingu a vráti predajca info.
 * Detail HTML obsahuje JSON-ified React props s kľúčmi `advertiser.name`
 * a `advertiser.agencyName`. Ak má listing agencyName → RK. Ak meno obsahuje
 * s.r.o./a.s./spol. → RK. Inak súkromný.
 *
 * Direct fetch (bez ScrapingBee) — nehnutelnosti.sk detail pages sú SSR.
 */
export async function fetchNehnDetailInfo(url: string): Promise<{
  predajca_meno?: string;
  predajca_typ: "firma" | "sukromny";
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "sk-SK,sk;q=0.9",
      },
    });
    if (!res.ok) return { predajca_typ: "firma" }; // safe default
    const html = await res.text();

    // React-serialized JSON má escaped quotes: \"advertiser\":{...}
    // Try both escaped a non-escaped varianty.
    const agencyMatch =
      html.match(/\\"agencyName\\":\\"([^"\\]+)\\"/) ||
      html.match(/"agencyName":"([^"]+)"/);
    const nameMatch =
      html.match(/\\"advertiser\\":\{[^}]*?\\"name\\":\\"([^"\\]+)\\"/) ||
      html.match(/"advertiser":\{[^}]*?"name":"([^"]+)"/);

    const agencyName = agencyMatch?.[1];
    const advertiserName = nameMatch?.[1];

    const predajca_meno = advertiserName || agencyName || undefined;

    // Rozhodovanie:
    // 1. Ak má agencyName → firma
    // 2. Ak meno obsahuje s.r.o./a.s./spol. atď. (detectFirma) → firma
    // 3. Inak súkromný
    let predajca_typ: "firma" | "sukromny" = "sukromny";
    if (agencyName && agencyName !== "$undefined") {
      predajca_typ = "firma";
    } else if (detectFirma(advertiserName, agencyName)) {
      predajca_typ = "firma";
    }

    return { predajca_meno, predajca_typ };
  } catch {
    return { predajca_typ: "firma" }; // safe default
  } finally {
    clearTimeout(timeout);
  }
}

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
      // nehnutelnosti.sk URL pattern: /byty/predaj/bratislava-ruzinov/
      // "Bratislava - Ružinov" → "bratislava-ruzinov" (collapsing whitespace/dashes).
      const slug = filter.lokalita
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[\s-]+/g, "-")
        .replace(/^-|-$/g, "");
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

      // Predajca — nehnutelnosti.sk má v list HTML embedded JSON s
      //   "advertiser":{"name":"...","type":"AGENT|AGENCY","parent":{"name":"..."}}
      // Klasifikácia:
      //  - advertiser.type === "AGENCY"  → firma (priama agentúra)
      //  - advertiser.parent exists      → firma (agent pod agentúrou)
      //  - inak                          → sukromny
      //
      // predajca_meno = meno agentúry ak existuje parent, inak advertiser.name.
      const advBlock = context.match(/advertiser\\":\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/);
      let predajca_meno: string | undefined;
      let advType: string | undefined;
      let parentName: string | undefined;
      if (advBlock) {
        const blob = advBlock[1];
        const nameM = blob.match(/\\"name\\":\\"([^"\\]+)\\"/);
        const typeM = blob.match(/\\"type\\":\\"([A-Z_]+)\\"/);
        const parentNameM = blob.match(/\\"parent\\":\{[^}]*?\\"name\\":\\"([^"\\]+)\\"/);
        const advName = nameM?.[1];
        advType = typeM?.[1];
        parentName = parentNameM?.[1];
        predajca_meno = parentName || advName;
      }

      const isAgency = advType === "AGENCY" || !!parentName;
      const isFirmaByText = detectFirma(nazov, predajca_meno);
      const predajca_typ: "firma" | "sukromny" =
        isAgency || isFirmaByText ? "firma" : "sukromny";

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
