import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  PORTALS,
  ALL_PORTALS,
  PORTALS_NO_SCRAPINGBEE,
  fetchPage,
  fetchNehnDetailInfo,
  fetchRealitySkIsAgency,
  isBazosListingFirma,
  sendPushForNewListings,
  recordInAppNotifications,
  notifyKupujuciMatches,
} from "@/lib/monitor";
import { classify, toLegacyDbEnum, type ClassifierResult, type ClassifierDbContext } from "@/lib/monitor/classifier";
import type { ScrapedInzerat, MonitorFilter, ScrapeResult } from "@/lib/monitor";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 30; // Vercel hobby limit

/**
 * /api/cron/scrape
 *
 * Pipeline: Stiahni → Parsuj → Porovnaj s DB → Ulož nové → Notifikuj
 *
 * Triggery:
 * 1. Vercel Cron — 1x denne o 8:00 (hobby plan limit)
 * 2. Externý cron (cron-job.org) — každých 15 min: GET /api/cron/scrape?key=CRON_SECRET
 * 3. Manuálne z UI — tlačidlo "Spustiť scrape" na /monitor
 *
 * Stratégia pre 30s limit:
 * - Spracúvame MAX 3 filtre za jeden request
 * - Ak je filtrov viac, spracujeme tie s najstarším last_scraped
 * - Ďalšie sa spracujú v nasledujúcom crone (za 15 min)
 *
 * Cold start optimalizácia:
 * - Žiadne ťažké importy (no puppeteer, no cheerio)
 * - Regex-based parsing (rýchle, nízka pamäť)
 * - ScrapingBee robí rendering externe
 */

const MAX_FILTERS_PER_RUN = 3;

/** Normalizuje lokalitu: lowercase, bez diakritiky, bez interpunkcie. */
function normLok(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Skontroluje či listing zodpovedá filter lokality.
 *
 * Podporuje 2 formáty needle:
 *   1) Jedna lokalita s hierarchiou cez " - " alebo "/":
 *      "Bratislava - Ružinov" → match na najšpecifickejšiu časť ("Ružinov")
 *   2) Viacero lokalít oddelených čiarkou alebo bodkočiarkou (OR):
 *      "Bernolákovo, Ivanka pri Dunaji, Senec" → match ak ktorákoľvek sedí.
 *      Užitočné pre dediny kde jediné slovo nepokrýva celú oblasť záujmu.
 */
function matchesLokalita(needle: string, haystackParts: Array<string | undefined | null>): boolean {
  // 1) Multi-lokality (OR): ak obsahuje `,` alebo `;` — rozdeľ a match ktorúkoľvek.
  if (/[,;]/.test(needle)) {
    const alternativy = needle.split(/\s*[,;]\s*/).map((s) => s.trim()).filter(Boolean);
    if (alternativy.length > 1) {
      return alternativy.some((alt) => matchesLokalita(alt, haystackParts));
    }
  }
  // 2) Single lokalita s hierarchiou (Bratislava - Ružinov) — existujúca logika
  const parts = needle.split(/\s*[-/]\s*/).map((p) => p.trim()).filter(Boolean);
  const specific = parts[parts.length - 1] || needle;
  const specificNorm = normLok(specific);
  if (!specificNorm) return true;
  const haystack = normLok(haystackParts.filter(Boolean).join(" "));
  if (haystack.includes(specificNorm)) return true;
  if (parts.length === 1) {
    return haystack.includes(normLok(needle));
  }
  return false;
}

/**
 * Komplexný post-parse filter: typ (byt/dom/pozemok), cena od/do, plocha, izby,
 * prenájom/predaj (podľa URL/nazvu), lokalita. Vracia true ak listing prejde všetky.
 */
function matchesFilter(listing: ScrapedInzerat, filter: MonitorFilter): boolean {
  // Typ (byt/dom/pozemok/iny) — ak filter.typ je nastavený, vyžadujeme presný match.
  // Zámerne tvrdé: "iny" (napr. garáž, sklad, pozemok) sa NEbude matchovať ak user chce byt.
  if (filter.typ && listing.typ && listing.typ !== filter.typ) return false;

  // Predaj vs prenájom — portály niekedy prepúšťajú prenájmy do /predaj/ listov.
  // Kontrolujeme URL + názov + popis (popis obsahuje "prenájom" aj keď URL nie).
  const textLow = ((listing.url || "") + " " + (listing.nazov || "") + " " + (listing.popis || ""))
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  void textLow; // predaj/prenájom sa NEzahadzuje — ukladáme oboje, len tag cez ponuka_typ

  // Cena — ak máme cena_od/do, vyžadujeme aby listing cena bola v rozsahu.
  // Ak listing nemá cenu (undefined), nechávame ju ako potenciálne relevantnú (nechytí všetko).
  if (filter.cena_od && listing.cena !== undefined && listing.cena < filter.cena_od) return false;
  if (filter.cena_do && listing.cena !== undefined && listing.cena > filter.cena_do) return false;

  // Plocha
  if (filter.plocha_od && listing.plocha !== undefined && listing.plocha < filter.plocha_od) return false;
  if (filter.plocha_do && listing.plocha !== undefined && listing.plocha > filter.plocha_do) return false;

  // Izby
  if (filter.izby_od && listing.izby !== undefined && listing.izby < filter.izby_od) return false;
  if (filter.izby_do && listing.izby !== undefined && listing.izby > filter.izby_do) return false;

  // Lokalita
  if (filter.lokalita && !matchesLokalita(filter.lokalita, [listing.lokalita, listing.nazov, listing.url])) {
    return false;
  }

  return true;
}

/**
 * Poskladá nadpis inzerátu z FAKTOV o objekte — nie z pôvodného titulku
 * portálu (ten môže obsahovať meno predajcu / RK značku / kontakt).
 * GDPR data-min: do DB ukladáme len neosobný, fakticky odvodený nadpis.
 * Napr. "Byt · 2-izb · Bratislava-Petržalka · 149 900 €".
 */
const TYP_LABEL: Record<string, string> = { byt: "Byt", dom: "Dom", pozemok: "Pozemok", iny: "Nehnuteľnosť" };
function buildNazovZFaktov(l: ScrapedInzerat): string {
  const parts: string[] = [];
  if (l.ponuka_typ === "prenajom") parts.push("Prenájom");
  parts.push(TYP_LABEL[l.typ || ""] || "Nehnuteľnosť");
  if (l.izby) parts.push(`${l.izby}-izb`);
  if (l.plocha) parts.push(`${l.plocha} m²`);
  if (l.lokalita) parts.push(l.lokalita);
  if (l.cena) parts.push(`${l.cena.toLocaleString("sk-SK")} €${l.ponuka_typ === "prenajom" ? "/mes" : ""}`);
  return parts.join(" · ");
}

/** Spustí async fn nad items s max `limit` súbežne — chráni 30s/HTTP rozpočet. */
async function mapCapped<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += limit) {
    await Promise.all(items.slice(i, i + limit).map(fn));
  }
}

export async function GET(request: Request) {
  const startTime = Date.now();

  // Bezpečnosť: overenie CRON_SECRET
  // Vercel cron posiela header, externý cron posiela ?key= parameter
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const queryKey = searchParams.get("key");
  const cronSecret = process.env.CRON_SECRET;

  // Povolíme: 1) Vercel cron header, 2) externý cron ?key=, 3) interné volanie z UI (__internal__)
  const isInternal = queryKey === "__internal__";
  if (cronSecret && !isInternal && authHeader !== `Bearer ${cronSecret}` && queryKey !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: ScrapeResult[] = [];
  const allNewInzeraty: ScrapedInzerat[] = [];

  try {
    const sb = getSupabaseAdmin();
    // 1. Načítaj aktívne filtre
    const { data: filtre, error: filtreErr } = await sb
      .from("monitor_filtre")
      .select("*")
      .eq("is_active", true)
      .order("updated_at", { ascending: true }) // najstaršie najskôr
      .limit(MAX_FILTERS_PER_RUN);

    if (filtreErr) {
      console.error("[scrape] filter query error:", filtreErr);
      return NextResponse.json({ error: filtreErr.message }, { status: 500 });
    }

    if (!filtre?.length) {
      return NextResponse.json({
        message: "Žiadne aktívne filtre",
        results: [],
      });
    }

    // 2. Spracuj každý filter
    for (const filter of filtre as MonitorFilter[]) {
      // Kontrola času — zostáva nám aspoň 8s?
      if (Date.now() - startTime > 22000) {
        console.warn("[scrape] Čas vyprší, preskakujem ďalšie filtre");
        break;
      }

      // Segmentácia: 'oboje' → scrapni predaj aj prenájom (2 prechody).
      const segments: Array<"predaj" | "prenajom"> =
        filter.ponuka_typ === "prenajom" ? ["prenajom"]
        : filter.ponuka_typ === "oboje" ? ["predaj", "prenajom"]
        : ["predaj"];

      // Aktualizuj updated_at filtra (aby sa rotovali)
      await sb
        .from("monitor_filtre")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", filter.id);

      for (const segment of segments) {
      if (Date.now() - startTime > 22000) break;
      const result = await processFilter(sb, { ...filter, ponuka_typ: segment });
      results.push(result);

      // Loguj výsledok scrape-u
      await sb.from("monitor_scrape_log").insert({
        portal: result.portal,
        status: result.status,
        total_found: result.total_found,
        new_count: result.new_count,
        updated_count: result.updated_count,
        duration_ms: result.duration_ms,
        error_msg: result.error_msg || null,
      });

      // Zbieraj nové inzeráty pre notifikácie
      if (result.new_count > 0 && (result as ScrapeResult & { newItems?: ScrapedInzerat[] }).newItems) {
        const newItems = (result as ScrapeResult & { newItems?: ScrapedInzerat[] }).newItems!;
        allNewInzeraty.push(...newItems);

        // Web push notifikácie — jediný kanál notifikácií pre Monitor.
        // Pošle sa všetkým subscribnutým zariadeniam maklérov ktorí majú
        // 'monitor' povolený v users.notification_prefs.
        if (newItems.length > 0) {
          try {
            await sendPushForNewListings(newItems);
          } catch (e) {
            console.warn("[scrape] push failed:", e);
          }
          // In-app notifikácie pre bell ikonu v navbare
          try {
            await recordInAppNotifications(newItems);
          } catch (e) {
            console.warn("[scrape] in-app notif failed:", e);
          }
          // TASK 13 — porovnaj nové inzeráty s aktívnymi objednávkami kupujúcich
          // a urob "match" notifikáciu pre toho ktorý daného kupujúceho spravuje.
          try {
            await notifyKupujuciMatches(newItems);
          } catch (e) {
            console.warn("[scrape] kupujuci-match notif failed:", e);
          }
        }
      }
      } // koniec segment loop
    }

    const totalNew = results.reduce((s, r) => s + r.new_count, 0);
    const totalFound = results.reduce((s, r) => s + r.total_found, 0);

    // Audit trail behu scrape (GDPR — evidencia spracúvania). Bez PII.
    await logAudit({
      action: "monitor.scrape",
      actor_id: null,
      actor_name: isInternal ? "monitor/manual" : "cron/scrape",
      target_type: "monitor_inzeraty",
      detail: { filters: results.length, total_found: totalFound, new: totalNew },
    });

    return NextResponse.json({
      message: `Spracované ${results.length} filtre: ${totalFound} inzerátov, ${totalNew} nových`,
      duration_ms: Date.now() - startTime,
      results,
    });
  } catch (e) {
    console.error("[scrape] critical error:", e);
    return NextResponse.json(
      { error: String(e), duration_ms: Date.now() - startTime },
      { status: 500 }
    );
  }
}

/**
 * Spracuje jeden filter: stiahne, parsuje, uloží, vráti výsledok.
 */
async function processFilter(
  sb: ReturnType<typeof getSupabaseAdmin>,
  filter: MonitorFilter
): Promise<ScrapeResult & { newItems?: ScrapedInzerat[] }> {
  const filterStart = Date.now();
  const portalsToScrape =
    filter.portal === "vsetky" ? ALL_PORTALS : [filter.portal];

  let totalFound = 0;
  let newCount = 0;
  let updatedCount = 0;
  const newItems: (ScrapedInzerat & { db_id?: string })[] = [];

  try {
    // 1. Stiahni + parsuj všetky portály PARALELNE (šetrí ~15-20s vs sekvenčne).
    //    reality.sk a bazos.sk idú cez priamy fetch (scraper.ts má whitelist).
    //    Ostatné cez ScrapingBee s JS renderingom.
    const portalResults = await Promise.all(
      portalsToScrape.map(async (portalName) => {
        const parser = PORTALS[portalName];
        if (!parser) return { portalName, listings: [] as ScrapedInzerat[] };
        const needsJs = !PORTALS_NO_SCRAPINGBEE.includes(portalName);
        try {
          const { html } = await fetchPage({
            url: parser.buildSearchUrl(filter),
            renderJs: needsJs,
            waitMs: needsJs ? 2000 : 0,
          });
          return { portalName, listings: parser.parseListings(html) };
        } catch (e) {
          console.warn(`[scrape] ${portalName} fetch failed:`, e);
          return { portalName, listings: [] as ScrapedInzerat[] };
        }
      })
    );

    // 2. Zlúč listings z všetkých portálov.
    //    Do DB upsertneme VŠETKO (aby mali staré rows správny predajca_typ).
    //    Filter len_sukromni sa aplikuje až pri tvorbe newItems pre notifikácie.
    const allListings: ScrapedInzerat[] = [];
    for (const { listings } of portalResults) {
      allListings.push(...listings);
    }

    // 2-ponuka. Otaguj ponuka_typ (predaj/prenájom). Segment scrapovania je
    // filter.ponuka_typ (rozriešené orchestrátorom na konkrétnu hodnotu). Parser
    // mohol nastaviť presnejšie (bazos zo slugu) — to rešpektujeme. Navyše opravíme
    // zjavné „leaky" (prenájom v predaj-liste) podľa textu.
    const segment: "predaj" | "prenajom" = filter.ponuka_typ === "prenajom" ? "prenajom" : "predaj";
    for (const l of allListings) {
      if (!l.ponuka_typ) l.ponuka_typ = segment;
      const t = ((l.nazov || "") + " " + (l.popis || "") + " " + (l.url || ""))
        .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (/\bprenajom\b|\bpodnajom\b|na prenajom|k prenajmu|mesacne|\/mes\b|eur\/mes/.test(t)) {
        l.ponuka_typ = "prenajom";
      }
    }

    // 2a. Lokalita injection: portály ktoré URL-filtrujú lokalitou (bazos cez
    //     ?hlokalita=, byty.sk cez URL slug) garantujú že všetky výsledky sú
    //     v danej lokalite. Parser ich lokalitu však extrahuje nespoľahlivo
    //     (bazos napr. vráti literál "Lokalita" ako hodnotu headingu).
    //     Ak filter má lokalitu, pre tieto portály ju override-ujeme vždy.
    const URL_FILTERED_LOCATION = new Set(["bazos.sk", "byty.sk"]);
    if (filter.lokalita) {
      for (const l of allListings) {
        if (URL_FILTERED_LOCATION.has(l.portal)) {
          l.lokalita = filter.lokalita;
        } else if (!l.lokalita) {
          l.lokalita = filter.lokalita;
        }
      }
    }

    // 2b. Enrichment: pre nehnutelnosti.sk listings stiahni detail stránku
    //     a z JSONu v HTML extrahuj skutočného predajcu (advertiser.name +
    //     agencyName). Aplikuje sa len na listingy ktoré ešte NIE SÚ v DB,
    //     aby sme šetrili čas (existujúce už majú zapísaný predajca_typ).
    const nehnListings = allListings.filter((l) => l.portal === "nehnutelnosti.sk");
    if (nehnListings.length > 0) {
      const externalIds = nehnListings.map((l) => l.external_id);
      const { data: existing } = await sb
        .from("monitor_inzeraty")
        .select("external_id, predajca_typ")
        .eq("portal", "nehnutelnosti.sk")
        .in("external_id", externalIds);

      const existingMap = new Map(
        (existing || []).map((r) => [r.external_id as string, r])
      );

      // Enrich listingy kde:
      // 1. NIE SÚ v DB (nové), ALEBO
      // 2. V DB majú predajca_typ = NULL (staré rows pred enrichmentom)
      // Fetch-es bežia paralelne cez Promise.all — direct HTTP do nehnutelnosti.sk
      // (~1-2s per page). 30 listings × paralelne ~2-3s. Pod 30s Vercel limit.
      const needsEnrich = nehnListings.filter((l) => {
        const e = existingMap.get(l.external_id);
        return !e || !e.predajca_typ;
      });

      await Promise.all(
        needsEnrich.map(async (listing) => {
          try {
            const info = await fetchNehnDetailInfo(listing.url);
            listing.predajca_typ = info.predajca_typ;
            if (info.predajca_meno) listing.predajca_meno = info.predajca_meno;
          } catch {
            // fallback na default "firma" nastavený v parseri
          }
        })
      );

      // Pre ostatné existujúce: použijeme uložený predajca_typ.
      for (const listing of nehnListings) {
        if (needsEnrich.includes(listing)) continue;
        const e = existingMap.get(listing.external_id);
        if (e && e.predajca_typ) {
          listing.predajca_typ = e.predajca_typ as typeof listing.predajca_typ;
        }
      }
    }

    // 2c. Bazos enrichment — pre listingy klasifikované ako "sukromny" (podľa
    //     mena predajcu) skontrolujeme detail stránku. Makléri často používajú
    //     osobné meno, ale v popise majú "+ provízia RK". List page popis býva
    //     orezaný, detail page ma plný text.
    //     STROP: detail fetch je drahý (1 HTTP/inzerát). Max 36 kandidátov,
    //     po 12 súbežne, aby sme dobehli v 30s limite (predtým 70 paralelne → timeout).
    const bazosCandidates = allListings
      .filter((l) => l.portal === "bazos.sk" && l.predajca_typ === "sukromny")
      .slice(0, 36);
    if (bazosCandidates.length > 0) {
      await mapCapped(bazosCandidates, 12, async (listing) => {
        try {
          const isFirma = await isBazosListingFirma(listing.url);
          if (isFirma) listing.predajca_typ = "firma";
        } catch { /* fail-safe: keep sukromny */ }
      });
    }

    // 2d. Reality.sk enrichment — AUTORITATÍVNE na VŠETKÝCH reality listingoch.
    //     Detail stránka má štruktúrny štítok: link /realitna-kancelaria/ ⇒ firma,
    //     inak ⇒ sukromny. Toto je ground-truth pre reality.sk, preto ho púšťame
    //     na každý inzerát (nie len nové) a prepisuje parser/klasifikátor.
    //     STROP: max 40, po 10 súbežne (30s rozpočet). Zlyhanie → ponecháme stav.
    const realityListings = allListings.filter((l) => l.portal === "reality.sk").slice(0, 40);
    if (realityListings.length > 0) {
      await mapCapped(realityListings, 10, async (listing) => {
        try {
          const isAgency = await fetchRealitySkIsAgency(listing.url);
          listing.predajca_typ = isAgency ? "firma" : "sukromny";
        } catch { /* fail-safe: ponechaj existujúci predajca_typ */ }
      });
    }

    // 2e. CLASSIFIER v2 — multi-signal scoring (sukromny/rk/unknown + confidence + signals[]).
    //     Ide cez ClassifierDbContext: phone/name counts za 30 dní + listed_on_n_portals
    //     + in_rk_directory (manuálny override z minulosti). Klasifikácia rešpektuje
    //     existujúci predajca_typ_override — ten má prednosť pred algoritmom.
    const classifierResults = new Map<string, ClassifierResult>();
    if (allListings.length > 0) {
      // Phone/name counts — GDPR data-min: telefón/meno sa už NEUKLADAJÚ do DB,
      // takže historický 30-dňový count nie je možný. Počítame výskyt LEN v rámci
      // aktuálneho behu (transientne, z pamäte). Zachytí makléra, ktorý v jednom
      // scrape behu inzeruje viacero nehnuteľností s rovnakým kontaktom.
      const phoneCountMap = new Map<string, number>();
      const nameCountMap = new Map<string, number>();
      const inzerentBatchMap = new Map<string, number>();
      const overrideByExternalId = new Map<string, string>();
      for (const l of allListings) {
        if (l.predajca_telefon) phoneCountMap.set(l.predajca_telefon, (phoneCountMap.get(l.predajca_telefon) || 0) + 1);
        if (l.predajca_meno) nameCountMap.set(l.predajca_meno, (nameCountMap.get(l.predajca_meno) || 0) + 1);
        if (l.inzerent_id) inzerentBatchMap.set(l.inzerent_id, (inzerentBatchMap.get(l.inzerent_id) || 0) + 1);
      }

      // Inzerent (účet) — 30-dňový počet uložených inzerátov za daný účet (RK signál).
      // inzerent_id NIE je kontakt/meno (len anonymné ID účtu). Výsledný signál =
      // max(uložený 30d počet, počet v aktuálnom behu) — zachytí aj nový RK účet,
      // ktorý sa prvýkrát objaví naraz s mnohými inzerátmi.
      const ago30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const inzerentDbMap = new Map<string, number>();
      const inzerentIds = Array.from(inzerentBatchMap.keys());
      if (inzerentIds.length > 0) {
        const { data: inzRows } = await sb
          .from("monitor_inzeraty")
          .select("inzerent_id")
          .in("inzerent_id", inzerentIds)
          .gte("last_seen_at", ago30)
          .eq("is_active", true);
        (inzRows || []).forEach((r: { inzerent_id: string | null }) => {
          if (r.inzerent_id) inzerentDbMap.set(r.inzerent_id, (inzerentDbMap.get(r.inzerent_id) || 0) + 1);
        });
      }
      const inzerentCount = (id?: string): number => {
        if (!id) return 0;
        return Math.max(inzerentDbMap.get(id) || 0, inzerentBatchMap.get(id) || 0);
      };

      // Načítaj override-y a klasifikácie z minulosti (per portal+external_id)
      // Defensive: ak migrácia 041 ešte nebola spustená, predajca_typ_override stĺpec
      // ani rk_directory tabuľka nemusia existovať — všetky chyby ignorujeme.
      const externalIds = allListings.map(l => l.external_id);
      if (externalIds.length > 0) {
        try {
          const { data: existingClass, error } = await sb
            .from("monitor_inzeraty")
            .select("portal, external_id, predajca_typ_override, listed_on_n_portals")
            .in("external_id", externalIds);
          if (!error) {
            (existingClass || []).forEach((r: { portal: string; external_id: string; predajca_typ_override: string | null; listed_on_n_portals: number | null }) => {
              const key = `${r.portal}:${r.external_id}`;
              if (r.predajca_typ_override) overrideByExternalId.set(key, r.predajca_typ_override);
            });
          }
        } catch { /* migrácia 041 nie je aplikovaná — preskočíme override */ }
      }

      // RK directory — telefóny/mená/domény ktoré už sú potvrdené ako RK
      let rkPhones = new Set<string>();
      let rkNames = new Set<string>();
      let rkDomains = new Set<string>();
      try {
        const { data: rkDir, error } = await sb
          .from("rk_directory")
          .select("telefon, email_domain, meno")
          .eq("typ", "rk");
        if (!error && rkDir) {
          rkPhones = new Set(rkDir.map((r: { telefon: string | null }) => r.telefon).filter(Boolean) as string[]);
          rkNames = new Set(rkDir.map((r: { meno: string | null }) => r.meno).filter(Boolean) as string[]);
          rkDomains = new Set(rkDir.map((r: { email_domain: string | null }) => r.email_domain).filter(Boolean) as string[]);
        }
      } catch { /* tabuľka rk_directory nie je vytvorená — bez problému */ }

      // Klasifikuj každý listing
      for (const listing of allListings) {
        const key = `${listing.portal}:${listing.external_id}`;
        const override = overrideByExternalId.get(key);

        // Ak existuje manuálny override, použijeme ho s plnou confidence — bez ďalšieho výpočtu
        if (override === "rk" || override === "sukromny") {
          classifierResults.set(key, {
            predajca_typ: override as "rk" | "sukromny",
            confidence: 1.0,
            raw_score: 99,
            signals: [{ id: "manual_override", side: override === "rk" ? "rk" : "sukromny", weight: 99, reason: "Manuálny override maklérom" }],
            method: "v2",
          });
          listing.predajca_typ = toLegacyDbEnum(override as "rk" | "sukromny") as typeof listing.predajca_typ;
          continue;
        }

        // Inak — spočítaj signály
        const inDirectory =
          (listing.predajca_telefon ? rkPhones.has(listing.predajca_telefon) : false) ||
          (listing.predajca_meno ? rkNames.has(listing.predajca_meno) : false) ||
          [...rkDomains].some(d => (listing.popis || "").toLowerCase().includes(d));

        const ctx: ClassifierDbContext = {
          phone_count_30d: listing.predajca_telefon ? phoneCountMap.get(listing.predajca_telefon) || 0 : 0,
          name_count_30d: listing.predajca_meno ? nameCountMap.get(listing.predajca_meno) || 0 : 0,
          inzerent_count_30d: inzerentCount(listing.inzerent_id),
          listed_on_n_portals: 1, // TODO: prepojiť po canonical_id dedup (Etapa F)
          in_rk_directory: inDirectory,
        };

        const result = classify({
          portal: listing.portal,
          nazov: listing.nazov,
          popis: listing.popis,
          predajca_meno: listing.predajca_meno,
          predajca_telefon: listing.predajca_telefon,
          lokalita: listing.lokalita,
          raw_data: listing.raw_data,
          db: ctx,
        });
        classifierResults.set(key, result);

        // Ak classifier dal vysoké confidence "rk" alebo "sukromny" → prepíš parser-default.
        // "unknown" → ponecháme parser-default (môže byť presnejší pri špecifických portáloch).
        if (result.predajca_typ === "rk") {
          listing.predajca_typ = "firma";
        } else if (result.predajca_typ === "sukromny") {
          listing.predajca_typ = "sukromny";
        }
      }
    }

    // Post-parse filter — portály v search URL čiastočne rešpektujú kritériá
    // (cena/lokalita/typ), nie však spoľahlivo. Aplikujeme post-filter lokality,
    // typu, ceny, plochy, izieb.
    // UKLADÁME VŠETKO (súkromník aj RK, predaj aj prenájom) — pre kompletnú trhovú
    // analýzu. `len_sukromni` NEZAHADZUJE — ovplyvňuje len notifikácie (nižšie).
    const filteredListings = allListings
      .filter((l) => matchesFilter(l, filter));
    totalFound = filteredListings.length;

    // 3. Upsert do DB — PARALELNE (chunky po 20 aby sme neukatiovali Supabase).
    //    Defensive: stĺpce predajca_typ_signals (mig 041) môžu chýbať. Ak prvý
    //    upsert zlyhá s chybou na chýbajúci stĺpec, zopakujeme ho bez nich.
    const buildUpsertRow = (listing: typeof filteredListings[number], includeV2: boolean) => {
      const cKey = `${listing.portal}:${listing.external_id}`;
      const cls = classifierResults.get(cKey);
      const base = {
        portal: listing.portal,
        external_id: listing.external_id,
        url: listing.url,
        // GDPR data-min: nadpis z faktov o objekte, NIE z pôvodného titulku
        // portálu (môže obsahovať meno/kontakt predajcu). PII polia (meno,
        // telefón, popis, raw_data) sa zámerne neukladajú.
        nazov: buildNazovZFaktov(listing),
        typ: listing.typ,
        lokalita: listing.lokalita,
        cena: listing.cena,
        mena: listing.mena || "EUR",
        plocha: listing.plocha,
        izby: listing.izby,
        foto_url: listing.foto_url,
        predajca_typ: listing.predajca_typ,
        ponuka_typ: listing.ponuka_typ || "predaj",
        inzerent_id: listing.inzerent_id ?? null,
        predajca_typ_confidence: cls?.confidence ?? null,
        predajca_typ_method: cls?.method === "v2" ? (cls.signals.length > 0 ? "rule_v2" : null) : null,
        poschodie: listing.poschodie ?? null,
        stav: listing.stav ?? null,
        last_seen_at: new Date().toISOString(),
        is_active: true,
      };
      if (includeV2 && cls) {
        return {
          ...base,
          predajca_typ_signals: { signals: cls.signals, raw_score: cls.raw_score, predajca_typ: cls.predajca_typ },
        };
      }
      return base;
    };
    const upsertRows = filteredListings.map((l) => buildUpsertRow(l, true));

    if (upsertRows.length > 0) {
      let { data, error } = await sb
        .from("monitor_inzeraty")
        .upsert(upsertRows, {
          onConflict: "portal,external_id",
          ignoreDuplicates: false,
        })
        .select("id, portal, external_id, first_seen_at, last_seen_at");

      // Fallback: ak migrácia 041 ešte nie je aplikovaná → retry bez v2 stĺpcov
      if (error && /predajca_typ_signals/i.test(error.message)) {
        console.warn("[scrape] mig 041 not applied — retrying upsert without predajca_typ_signals");
        const fallbackRows = filteredListings.map((l) => buildUpsertRow(l, false));
        const retry = await sb
          .from("monitor_inzeraty")
          .upsert(fallbackRows, { onConflict: "portal,external_id", ignoreDuplicates: false })
          .select("id, portal, external_id, first_seen_at, last_seen_at");
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error("[scrape] batch upsert error:", error);
      } else if (data) {
        const byKey = new Map(data.map((r) => [`${r.portal}:${r.external_id}`, r]));
        for (const listing of filteredListings) {
          const row = byKey.get(`${listing.portal}:${listing.external_id}`);
          if (!row) continue;
          const isNew =
            row.first_seen_at === row.last_seen_at ||
            new Date(row.first_seen_at).getTime() > Date.now() - 60000;
          if (isNew) {
            newCount++;
            // Notifikácia ide len o leady: PREDAJ + súkromník (nie RK, nie prenájom).
            // RK aj prenájmy sa ukladajú pre analýzu, ale nespamujú notifikácie.
            // `len_sukromni=false` filter (čisto analytický) notifikácie nevydáva.
            if (
              filter.len_sukromni !== false &&
              listing.predajca_typ !== "firma" &&
              listing.ponuka_typ !== "prenajom"
            ) {
              newItems.push({ ...listing, db_id: row.id });
            }
          } else {
            updatedCount++;
          }
        }
      }
    }

    // DEBUG: diagnostic info — ktoré portály koľko parsnuli, koľko prešlo filtrom
    const debugInfo = {
      portals_raw: portalResults.map((p) => ({ p: p.portalName, n: p.listings.length })),
      before_filter: allListings.length,
      after_firma_filter: allListings.filter((l) => l.predajca_typ !== "firma").length,
      after_match_filter: totalFound,
      filter_lokalita: filter.lokalita,
      filter_typ: filter.typ,
      sample_listing: allListings[0] ? {
        portal: allListings[0].portal,
        nazov: allListings[0].nazov?.slice(0, 40),
        lokalita: allListings[0].lokalita,
        typ: allListings[0].typ,
        predajca_typ: allListings[0].predajca_typ,
      } : null,
    };
    return {
      portal: filter.portal,
      status: "success",
      total_found: totalFound,
      new_count: newCount,
      updated_count: updatedCount,
      duration_ms: Date.now() - filterStart,
      newItems,
      debug: debugInfo,
    } as ScrapeResult & { newItems?: ScrapedInzerat[]; debug?: unknown };
  } catch (e) {
    console.error(`[scrape] error for filter ${filter.nazov}:`, e);
    return {
      portal: filter.portal,
      status: "error",
      total_found: totalFound,
      new_count: newCount,
      updated_count: updatedCount,
      duration_ms: Date.now() - filterStart,
      error_msg: String(e),
    };
  }
}
