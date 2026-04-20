import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * /api/cron/foto-rotation
 *
 * Každý deň prehodí prvú fotku aktívnych inzerátov na koniec zoznamu,
 * ak od poslednej rotácie prešlo aspoň 9 dní. Mení poradie vo `fotky_urls`
 * aj `fotky_thumbs`. Portály po re-scrape zaregistrujú "novú" titulnú
 * fotku → inzerát sa oživí vo výpisoch (SEO/UX trick).
 *
 * Rotuje iba inzeráty:
 *   - status = "aktivny"
 *   - fotky_urls.length >= 2
 *   - last_foto_rotation_at IS NULL OR < (now - 9 days)
 *
 * Auth:
 *   - Vercel cron (daily) — schedule v vercel.json
 *   - Manuálne: GET /api/cron/foto-rotation?key=__internal__
 *   - Externé: Bearer CRON_SECRET
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
    const cutoff = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString();

    const { data: candidates, error: selErr } = await sb
      .from("nehnutelnosti")
      .select("id, fotky_urls, fotky_thumbs, last_foto_rotation_at")
      .eq("status", "aktivny")
      .or(`last_foto_rotation_at.is.null,last_foto_rotation_at.lt.${cutoff}`);

    if (selErr) {
      return NextResponse.json({ error: selErr.message }, { status: 500 });
    }

    const toRotate = (candidates || []).filter(c => Array.isArray(c.fotky_urls) && c.fotky_urls.length >= 2);

    const rotated: string[] = [];
    const skipped: string[] = [];
    for (const row of toRotate) {
      const urls = [...(row.fotky_urls as string[])];
      const thumbs = [...((row.fotky_thumbs as string[]) || [])];
      const firstUrl = urls.shift();
      if (firstUrl !== undefined) urls.push(firstUrl);
      const firstThumb = thumbs.shift();
      if (firstThumb !== undefined) thumbs.push(firstThumb);

      const { error: upErr } = await sb
        .from("nehnutelnosti")
        .update({
          fotky_urls: urls,
          fotky_thumbs: thumbs,
          last_foto_rotation_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (upErr) skipped.push(`${row.id}: ${upErr.message}`);
      else rotated.push(row.id as string);
    }

    return NextResponse.json({
      ok: true,
      checked: candidates?.length || 0,
      rotated: rotated.length,
      rotatedIds: rotated,
      skipped,
      durationMs: Date.now() - startTime,
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
}
