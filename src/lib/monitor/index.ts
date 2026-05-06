/* ── Realitný Monitor — hlavná orchestrácia ── */

export { nehnutelnostiSkParser, fetchNehnDetailInfo } from "./parsers/nehnutelnosti-sk";
export { realitySkParser, fetchRealitySkIsAgency } from "./parsers/reality-sk";
export { toprealitySkParser } from "./parsers/topreality-sk";
export { bazosSkParser, isBazosListingFirma } from "./parsers/bazos-sk";
export { bytySkParser } from "./parsers/byty-sk";
export { fetchPage, getScrapingBeeCredits } from "./scraper";
export { sendEmailNotification, sendTelegramNotification } from "./notifications";
export { sendPushForNewListings, sendPushToAll, recordInAppNotifications, notifyKupujuciMatches } from "./push";
export type { ScrapedInzerat, MonitorFilter, ScrapeResult, PortalParser } from "./types";

import { nehnutelnostiSkParser } from "./parsers/nehnutelnosti-sk";
import { realitySkParser } from "./parsers/reality-sk";
import { toprealitySkParser } from "./parsers/topreality-sk";
import { bazosSkParser } from "./parsers/bazos-sk";
import { bytySkParser } from "./parsers/byty-sk";
import type { PortalParser } from "./types";

/** Registry všetkých podporovaných portálov */
export const PORTALS: Record<string, PortalParser> = {
  "reality.sk": realitySkParser,              // funguje bez ScrapingBee
  "bazos.sk": bazosSkParser,                  // funguje bez ScrapingBee (hlavný zdroj súkromných)
  "nehnutelnosti.sk": nehnutelnostiSkParser,  // vyžaduje ScrapingBee (Next.js RSC)
  "byty.sk": bytySkParser,                    // vyžaduje ScrapingBee (SPA)
  "topreality.sk": toprealitySkParser,        // vyžaduje ScrapingBee
};

/** Portály ktoré fungujú bez ScrapingBee (server-rendered HTML) */
export const PORTALS_NO_SCRAPINGBEE = ["reality.sk", "bazos.sk"];

/** Portály ktoré vyžadujú ScrapingBee (JS-rendered) */
export const PORTALS_NEED_SCRAPINGBEE = ["nehnutelnosti.sk", "byty.sk", "topreality.sk"];

/** Všetky portály ako pole */
export const ALL_PORTALS = Object.keys(PORTALS);
