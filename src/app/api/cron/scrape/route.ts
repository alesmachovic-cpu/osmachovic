import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  PORTALS,
  ALL_PORTALS,
  PORTALS_NO_SCRAPINGBEE,
  fetchPage,
  fetchNehnDetailInfo,
  isBazosListingFirma,
  sendPushForNewListings,
} from "@/lib/monitor";
import type { ScrapedInzerat, MonitorFilter, ScrapeResult } from "@/lib/monitor";

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

  // Predaj vs prenájom — bazos.sk niekedy prepúšťa prenájmy do /predaj/ listu.
  // Ak URL alebo názov obsahuje "prenajom"/"prenájom"/"podnajom" → vyradíme.
  const textLow = ((listing.url || "") + " " + (listing.nazov || "")).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\bprena?jom|podna?jom|na\s+prenaj/i.test(textLow)) return false;

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

      const result = await processFilter(sb, filter);
      results.push(result);

      // Aktualizuj updated_at filtra (aby sa rotovali)
      await sb
        .from("monitor_filtre")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", filter.id);

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
        }
      }
    }

    const totalNew = results.reduce((s, r) => s + r.new_count, 0);
    const totalFound = results.reduce((s, r) => s + r.total_found, 0);

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

    // 2b. Enrichment: pre nehnutelnosti.sk listings stiahni detail stránku
    //     a z JSONu v HTML extrahuj skutočného predajcu (advertiser.name +
    //     agencyName). Aplikuje sa len na listingy ktoré ešte NIE SÚ v DB,
    //     aby sme šetrili čas (existujúce už majú zapísaný predajca_typ).
    const nehnListings = allListings.filter((l) => l.portal === "nehnutelnosti.sk");
    if (nehnListings.length > 0) {
      const externalIds = nehnListings.map((l) => l.external_id);
      const { data: existing } = await sb
        .from("monitor_inzeraty")
        .select("external_id, predajca_typ, predajca_meno")
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
          if (e.predajca_meno) listing.predajca_meno = e.predajca_meno as string;
        }
      }
    }

    // 2c. Bazos enrichment — pre listingy klasifikované ako "sukromny" (podľa
    //     mena predajcu) skontrolujeme detail stránku. Makléri často používajú
    //     osobné meno, ale v popise majú "+ provízia RK". List page popis býva
    //     orezaný, detail page ma plný text.
    const bazosCandidates = allListings.filter(
      (l) => l.portal === "bazos.sk" && l.predajca_typ === "sukromny"
    );
    if (bazosCandidates.length > 0) {
      await Promise.all(
        bazosCandidates.map(async (listing) => {
          try {
            const isFirma = await isBazosListingFirma(listing.url);
            if (isFirma) listing.predajca_typ = "firma";
          } catch { /* fail-safe: keep sukromny */ }
        })
      );
    }

    // Post-parse filter — portály v search URL čiastočne rešpektujú filter kritéria
    // (cena/lokalita/typ), ale nie všetky a nie spoľahlivo. Aplikujeme striktný
    // post-filter lokality, typu, ceny, plochy, izieb + vyradíme prenájmy.
    // DODATOČNE: Monitor slúži VÝLUČNE na súkromnú inzerciu. Firma listings
    // sa vôbec neukladajú (RK analýza je samostatná feature).
    const filteredListings = allListings
      .filter((l) => l.predajca_typ !== "firma")
      .filter((l) => matchesFilter(l, filter));
    totalFound = filteredListings.length;

    // 3. Upsert do DB — PARALELNE (chunky po 20 aby sme neukatiovali Supabase)
    const upsertRows = filteredListings.map((listing) => ({
      portal: listing.portal,
      external_id: listing.external_id,
      url: listing.url,
      nazov: listing.nazov,
      typ: listing.typ,
      lokalita: listing.lokalita,
      cena: listing.cena,
      mena: listing.mena || "EUR",
      plocha: listing.plocha,
      izby: listing.izby,
      popis: listing.popis,
      foto_url: listing.foto_url,
      predajca_meno: listing.predajca_meno,
      predajca_telefon: listing.predajca_telefon,
      predajca_typ: listing.predajca_typ,
      raw_data: listing.raw_data || {},
      last_seen_at: new Date().toISOString(),
      is_active: true,
    }));

    if (upsertRows.length > 0) {
      const { data, error } = await sb
        .from("monitor_inzeraty")
        .upsert(upsertRows, {
          onConflict: "portal,external_id",
          ignoreDuplicates: false,
        })
        .select("id, portal, external_id, first_seen_at, last_seen_at");

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
            // Monitor ukladá len súkromné, takže všetky newItems idú do push.
            newItems.push({ ...listing, db_id: row.id });
          } else {
            updatedCount++;
          }
        }
      }
    }

    return {
      portal: filter.portal,
      status: "success",
      total_found: totalFound,
      new_count: newCount,
      updated_count: updatedCount,
      duration_ms: Date.now() - filterStart,
      newItems,
    };
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
