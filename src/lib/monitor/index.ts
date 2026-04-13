/* ── Realitný Monitor — hlavná orchestrácia ── */

export { nehnutelnostiSkParser } from "./parsers/nehnutelnosti-sk";
export { realitySkParser } from "./parsers/reality-sk";
export { toprealitySkParser } from "./parsers/topreality-sk";
export { fetchPage, getScrapingBeeCredits } from "./scraper";
export { sendEmailNotification, sendTelegramNotification } from "./notifications";
export type { ScrapedInzerat, MonitorFilter, ScrapeResult, PortalParser } from "./types";

import { nehnutelnostiSkParser } from "./parsers/nehnutelnosti-sk";
import { realitySkParser } from "./parsers/reality-sk";
import { toprealitySkParser } from "./parsers/topreality-sk";
import type { PortalParser } from "./types";

/** Registry všetkých podporovaných portálov */
export const PORTALS: Record<string, PortalParser> = {
  "nehnutelnosti.sk": nehnutelnostiSkParser,
  "reality.sk": realitySkParser,
  "topreality.sk": toprealitySkParser,
};

/** Všetky portály ako pole */
export const ALL_PORTALS = Object.keys(PORTALS);
