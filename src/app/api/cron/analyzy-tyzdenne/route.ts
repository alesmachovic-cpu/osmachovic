import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — môže byť veľa nehnuteľností

/**
 * /api/cron/analyzy-tyzdenne
 *
 * Raz za týždeň (v pondelok ráno) spusti rýchlu analýzu všetkých aktívnych
 * nehnuteľností v portfóliu. Pre každú zavolá interný /api/analyzy s mode='quick'
 * a uloží odhadovanú cenu + odporučený čas topovania do tabuľky.
 *
 * Auth: rovnako ako iné cron jobs (Bearer CRON_SECRET alebo ?key=__internal__).
 */
export async function GET(request: Request) {
  const startTime = Date.now();

  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const queryKey = searchParams.get("key");
  const cronSecret = process.env.CRON_SECRET;
  const isInternal = queryKey === "__internal__";
  if (cronSecret && !isInternal && authHeader !== `Bearer ${cronSecret}` && queryKey !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sb = getSupabaseAdmin();
    // Aktívne nehnuteľnosti — tie ktoré sú v predaji
    const { data: nehn } = await sb
      .from("nehnutelnosti")
      .select("id, nazov, typ, lokalita, cena, plocha, izby, stav, popis")
      .neq("stav", "predane")
      .neq("stav", "archivovane");

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://crmvianema.vercel.app";
    let processed = 0, failed = 0;
    const results: Record<string, unknown>[] = [];

    for (const n of nehn || []) {
      try {
        const r = await fetch(`${baseUrl}/api/analyzy`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: cronSecret ? `Bearer ${cronSecret}` : "",
          },
          body: JSON.stringify({ mode: "quick", nehnutelnost_id: n.id }),
        });
        if (r.ok) {
          processed++;
          const d = await r.json();
          results.push({ id: n.id, nazov: n.nazov, ...d.result });
        } else {
          failed++;
          console.warn("[analyzy-tyzdenne] failed for", n.id);
        }
      } catch (e) {
        failed++;
        console.warn("[analyzy-tyzdenne] error for", n.id, e);
      }
    }

    return NextResponse.json({
      message: `${processed} analyzed, ${failed} failed`,
      processed_count: processed,
      failed_count: failed,
      results,
      duration_ms: Date.now() - startTime,
    });
  } catch (e) {
    console.error("[analyzy-tyzdenne] error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
