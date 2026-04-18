/* ── Parser pre bazos.sk (reality.bazos.sk) ── */

import { ScrapedInzerat, MonitorFilter, PortalParser } from "../types";
import { detectFirma } from "./shared";

const PORTAL = "bazos.sk";
const BASE_URL = "https://reality.bazos.sk";

const TYP_URL: Record<string, string> = {
  byt: "byty",
  dom: "domy",
  pozemok: "pozemky",
};

/** Detekcia súkromný vs realitka podľa mena predajcu. */
function detectPredajca(nameDecoded: string): "sukromny" | "firma" {
  const lower = nameDecoded.toLowerCase();
  const firemneMarkery = [
    "s.r.o", "s. r. o", "spol.", "a.s.", "a. s.",
    "real", "reality", "invest", "group", "property",
    "estate", "broker", "bývanie", "domy", "byty",
  ];
  if (firemneMarkery.some((m) => lower.includes(m))) return "firma";
  return "sukromny";
}

/** URL decode bazos meno (napr. "Katar%C3%ADna+%C4%8Comov%C3%A1") */
function decodeBazosName(encoded: string): string {
  try {
    return decodeURIComponent(encoded.replace(/\+/g, " "));
  } catch {
    return encoded.replace(/\+/g, " ");
  }
}

export const bazosSkParser: PortalParser = {
  portal: PORTAL,

  buildSearchUrl(filter: MonitorFilter): string {
    if (filter.search_url) return filter.search_url;

    const typSlug = filter.typ ? TYP_URL[filter.typ] || "" : "";
    // Base URL: https://reality.bazos.sk/byty/predaj/
    let url = typSlug ? `${BASE_URL}/${typSlug}/predaj/` : `${BASE_URL}/byty/predaj/`;

    // Bazos podporuje filter cez query params — ?hledat=XXX&cenaod=&cenado=&Okres=
    const params = new URLSearchParams();
    if (filter.lokalita) params.set("hlokalita", filter.lokalita);
    if (filter.cena_od) params.set("cenaod", String(filter.cena_od));
    if (filter.cena_do) params.set("cenado", String(filter.cena_do));
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    return url;
  },

  parseListings(html: string): ScrapedInzerat[] {
    const listings: ScrapedInzerat[] = [];
    const seenIds = new Set<string>();

    // Každý inzerát je v bloku medzi dvoma "listainzerat inzeratyflex" divmi
    // alebo medzi <div class="inzeratyakce"> blokmi. Použijem lookahead cez inzeratynadpis.
    const blockRegex = /class="inzeratynadpis">[\s\S]*?class="inzeratyakce">[\s\S]*?<\/div>/gi;
    const blocks = html.match(blockRegex) || [];

    for (const block of blocks) {
      // URL + external ID: href="/inzerat/190872375/slug.php"
      const urlMatch = block.match(/href="(\/inzerat\/(\d+)\/[^"]+)"/);
      if (!urlMatch) continue;
      const relUrl = urlMatch[1];
      const externalId = urlMatch[2];
      if (seenIds.has(externalId)) continue;
      seenIds.add(externalId);

      // Skip prenájmy / podnájmy — bazos niekedy v /predaj/ výsledkoch
      // zobrazuje aj boosted prenájmy (slug obsahuje "prenajom"/"podnajom").
      const slugLow = relUrl.toLowerCase();
      if (slugLow.includes("prenajom") || slugLow.includes("prenájom") || slugLow.includes("podnajom")) {
        continue;
      }

      // Title z href textu (druhá časť URL) alebo z anchor textu
      const titleMatch = block.match(/href="\/inzerat\/\d+\/[^"]+"[^>]*>([^<]+)<\/a>/);
      let nazov = titleMatch?.[1]?.trim() || "";
      // Fallback: slug z URL
      if (!nazov) {
        const slugMatch = relUrl.match(/\/inzerat\/\d+\/([^./]+)/);
        if (slugMatch) nazov = slugMatch[1].replace(/-/g, " ");
      }

      // Price: <span translate="no">229 000 €</span>
      const priceMatch = block.match(/translate="no">\s*([\d\s.,]+)\s*€/);
      let cena: number | undefined;
      if (priceMatch) {
        const priceStr = priceMatch[1].replace(/\s/g, "").replace(",", ".");
        const num = parseFloat(priceStr);
        cena = isNaN(num) ? undefined : num;
      }

      // Location: <div class="inzeratylok">Košice<br>040 01</div>
      const locMatch = block.match(/class="inzeratylok">([\s\S]*?)<\/div>/);
      const lokalita = locMatch?.[1]
        ?.replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]*>/g, "")
        .trim()
        .replace(/\s+/g, " ")
        || undefined;

      // Image
      const imgMatch = block.match(/<img[^>]+src="(https:\/\/[^"]+bazos[^"]+)"/);
      const foto_url = imgMatch?.[1];

      // Opis (krátky preview)
      const popisMatch = block.match(/class="popis">([\s\S]*?)<\/div>/);
      const popis = popisMatch?.[1]?.replace(/<[^>]*>/g, "").trim().slice(0, 500) || undefined;

      // Predajca: odeslatakci('rating','USER_ID','PROFILE_ID','NAME_URLENCODED')
      const sellerMatch = block.match(/odeslatakci\('rating','[^']+','[^']+','([^']+)'\)/);
      const sellerNameRaw = sellerMatch?.[1] || "";
      const sellerName = sellerNameRaw ? decodeBazosName(sellerNameRaw) : "";
      // RK detekcia: najprv striktná na meno predajcu (detectPredajca),
      // potom shared detectFirma aj na názov + popis (zachytí "RK", "exkluzívne", "v ponuke"
      // aj keď je meno predajcu čisté osobné meno RK agenta).
      let predajca_typ: "sukromny" | "firma" = sellerName
        ? detectPredajca(sellerName)
        : "sukromny";
      if (predajca_typ === "sukromny" && detectFirma(nazov, popis)) {
        predajca_typ = "firma";
      }

      // Typ from URL
      let typ = "iny";
      if (relUrl.includes("/inzerat/")) {
        // Bazos kategorizuje cez URL segments — /byty/, /domy/, /pozemky/ — ale listing URL je /inzerat/ID/slug
        // Detekujeme z názvu / slugu
        const slugLower = relUrl.toLowerCase();
        if (slugLower.match(/byt|izb|garsonka/)) typ = "byt";
        else if (slugLower.match(/dom|chalupa|chata/)) typ = "dom";
        else if (slugLower.match(/pozemk|parcela|zeme/)) typ = "pozemok";
      }

      // Area parsing z názvu (napr. "3i 68m2" alebo "4-izbový byt 74 m²")
      const areaMatch = nazov.match(/(\d{2,3})\s*m[²2]/i);
      const plocha = areaMatch ? parseFloat(areaMatch[1]) : undefined;

      // Rooms from name
      const roomMatch = nazov.match(/(\d+)\s*[-]?\s*izb/i) || nazov.match(/\b(\d+)i\b/);
      const izby = roomMatch ? parseInt(roomMatch[1]) : undefined;

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
        predajca_meno: sellerName || undefined,
        predajca_typ,
        raw_data: {},
      });
    }

    return listings;
  },
};
