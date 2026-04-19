import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  PORTALS,
  ALL_PORTALS,
  PORTALS_NO_SCRAPINGBEE,
  fetchPage,
  sendEmailNotification,
  sendTelegramNotification,
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

        // Pošli notifikácie
        if (filter.notify_email && newItems.length > 0) {
          const emailResult = await sendEmailNotification(newItems, filter);
          await sb.from("monitor_notifikacie").insert(
            newItems.slice(0, 5).map((i) => ({
              inzerat_id: (i as ScrapedInzerat & { db_id?: string }).db_id || null,
              filter_id: filter.id,
              typ: "email",
              prijemca: process.env.MANAGER_EMAIL || "",
              status: emailResult.success ? "sent" : "failed",
              error_msg: emailResult.error || null,
            }))
          );
        }

        if (filter.notify_telegram && newItems.length > 0) {
          const tgResult = await sendTelegramNotification(newItems, filter);
          await sb.from("monitor_notifikacie").insert(
            newItems.slice(0, 5).map((i) => ({
              inzerat_id: (i as ScrapedInzerat & { db_id?: string }).db_id || null,
              filter_id: filter.id,
              typ: "telegram",
              prijemca: process.env.TELEGRAM_CHAT_ID || "",
              status: tgResult.success ? "sent" : "failed",
              error_msg: tgResult.error || null,
            }))
          );
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
    totalFound = allListings.length;

    // 3. Upsert do DB — PARALELNE (chunky po 20 aby sme neukatiovali Supabase)
    const upsertRows = allListings.map((listing) => ({
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
        for (const listing of allListings) {
          const row = byKey.get(`${listing.portal}:${listing.external_id}`);
          if (!row) continue;
          const isNew =
            row.first_seen_at === row.last_seen_at ||
            new Date(row.first_seen_at).getTime() > Date.now() - 60000;
          if (isNew) {
            newCount++;
            // Ak filter len_sukromni, zo zoznamu newItems vynechaj firmy —
            // chceme aby email obsahoval len súkromné (ale v DB máme aj firmy
            // s predajca_typ="firma" pre budúcu filtráciu a štatistiky).
            if (!filter.len_sukromni || listing.predajca_typ !== "firma") {
              newItems.push({ ...listing, db_id: row.id });
            }
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
