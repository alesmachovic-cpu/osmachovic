/* ── Parser pre topreality.sk ──
 *
 * Topreality je súčasť siete nehnutelnosti.sk a má Cloudflare/anti-bot, preto
 * sa scrapuje cez ScrapingBee (NIE priamy fetch — ten po pár requestoch zablokuje).
 *
 * Listings sú v HTML ako štruktúrované `data-ga4-container-*` atribúty na kontajneri
 * každého inzerátu — spoľahlivejšie než vizuálny DOM:
 *   item_id_generic, item_name, price, currency, item_category (typ),
 *   item_category3 (lokalita), location_id, affiliation (predajca/agentúra).
 * Detail link má tvar `/<slug>-r<ID>.html`.
 */

import { ScrapedInzerat, MonitorFilter, PortalParser } from "../types";
import { detectFirma, extractPoschodie, extractStav, extractIzby, extractPlocha, extractTyp } from "./shared";

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
    // Správny tvar: /vyhladavanie/<predaj|prenajom>-<byty|domy|pozemky>/
    // (starý /predaj-byty vracal prázdnu 404 stránku). Default null typ → byty.
    const typSlug = filter.typ ? TYP_URL[filter.typ] || "byty" : "byty";
    const seg = filter.ponuka_typ === "prenajom" ? "prenajom" : "predaj";
    // Lokalitu zámerne neukladáme do URL (neistý formát → 404). Post-filter
    // matchesFilter() v scrape route ju doženie.
    return `${BASE_URL}/vyhladavanie/${seg}-${typSlug}/`;
  },

  parseListings(html: string): ScrapedInzerat[] {
    const listings: ScrapedInzerat[] = [];
    const seen = new Set<string>();

    // Pozície začiatkov listing kontajnerov (item_id_generic je prvý atribút clustra).
    const idRe = /data-ga4-container-item_id_generic="(\d+)"/g;
    const positions: Array<{ id: string; pos: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = idRe.exec(html)) !== null) positions.push({ id: m[1], pos: m.index });

    for (let i = 0; i < positions.length; i++) {
      const { id, pos } = positions[i];
      if (seen.has(id)) continue;
      seen.add(id);

      const end = i + 1 < positions.length ? positions[i + 1].pos : Math.min(html.length, pos + 3000);
      const block = html.slice(Math.max(0, pos - 800), end);

      const attr = (name: string): string | undefined => {
        const mm = block.match(new RegExp(`data-ga4-container-${name}="([^"]*)"`));
        return mm ? mm[1] : undefined;
      };

      const nazov = (attr("item_name") || "").trim();
      if (!nazov) continue;

      // URL: href obsahuje `-r<ID>.html` (id-špecifické → bezpečné aj s lookbackom).
      const hrefM = block.match(new RegExp(`href="\\.?(/?[A-Za-z0-9-]+-r${id}\\.html)"`, "i"));
      const rel = hrefM ? hrefM[1].replace(/^\.?\/?/, "/") : null;
      if (!rel) continue;
      const url = `${BASE_URL}${rel}`;

      const currency = attr("currency") || "";
      const priceRaw = attr("price") || "";
      const priceNum = parseInt(priceRaw.replace(/[^\d]/g, ""), 10);
      const cena = Number.isFinite(priceNum) && priceNum > 0 ? priceNum : undefined;

      // Predaj/prenájom: mena "€/mesiac" alebo "Prenájom" v názve.
      const ponuka_typ: "predaj" | "prenajom" =
        (/mesiac/i.test(currency) || /\bprena[jí]om|podna[jí]om|\bnaja?m\b/i.test(nazov)) ? "prenajom" : "predaj";

      // Typ: z item_category, „pozemok" v názve má prednosť (topreality dáva
      // rekreačné pozemky pod „Domy").
      const cat = (attr("item_category") || "").toLowerCase();
      let typ = cat.includes("byt") ? "byt" : cat.includes("dom") ? "dom" : cat.includes("pozem") ? "pozemok" : extractTyp(nazov);
      if (extractTyp(nazov) === "pozemok") typ = "pozemok";

      // Lokalita: item_category3 (najšpecifickejšia) alebo posledné slová location_id.
      const loc3 = attr("item_category3");
      const locId = attr("location_id");
      const lokalita = (loc3 && loc3.trim()) || (locId ? locId.split(/\s+/).slice(-2).join(" ") : undefined);

      // Predajca (affiliation) — TRANSIENTNE pre klasifikátor (neukladá sa).
      const predajca_meno = attr("affiliation") || undefined;
      const predajca_typ = detectFirma(predajca_meno, nazov) ? "firma" : undefined;

      const imgM = block.match(/(?:src|data-src)="(https:\/\/[^"]+\.(?:jpe?g|png|webp)[^"]*)"/i);

      listings.push({
        portal: PORTAL,
        external_id: id,
        url,
        nazov,
        typ,
        lokalita,
        cena,
        mena: "EUR",
        plocha: extractPlocha(nazov),
        izby: extractIzby(nazov),
        foto_url: imgM?.[1],
        predajca_meno,
        predajca_typ,
        ponuka_typ,
        poschodie: extractPoschodie(nazov),
        stav: extractStav(nazov),
        raw_data: {},
      });
    }

    return listings;
  },
};
