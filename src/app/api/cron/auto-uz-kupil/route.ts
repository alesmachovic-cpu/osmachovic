import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/cron/auto-uz-kupil
 *
 * Per Aleš (2026-05-23): "ak je klient viac ako rok v systeme vyhodnoť ho ako
 * už kúpil automaticky".
 *
 * Logika: kupujúci klient (typ='kupujuci' alebo 'oboje') ktorý je v systéme
 * >365 dní a je stále v aktívnom stave (nie už uz_kupil/uz_predal/realitna_kancelaria/
 * turista/uzavrety) → set status='uz_kupil'.
 *
 * Triggery:
 *   - Vercel cron 1× denne (vercel.json)
 *   - Manuál: GET /api/cron/auto-uz-kupil?key=CRON_SECRET
 *
 * Audit trail: každá zmena sa zapíše do klienti_history.
 */
export async function GET(request: Request) {
  // Auth — Vercel cron Authorization header alebo ?key=CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const queryKey = new URL(request.url).searchParams.get("key");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && queryKey !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  // Aktívne stavy pre kupujúceho — všetko OKREM finálnych. Tieto NEpremenujeme.
  const finalStates = ["uz_kupil", "uz_predal", "realitna_kancelaria", "turista", "uzavrety"];

  const { data: candidates, error: selectErr } = await sb
    .from("klienti")
    .select("id, meno, status, typ, created_at, makler_id, company_id")
    .in("typ", ["kupujuci", "oboje"])
    .not("status", "in", `(${finalStates.map(s => `"${s}"`).join(",")})`)
    .lte("created_at", oneYearAgo);

  if (selectErr) {
    return NextResponse.json({ error: selectErr.message }, { status: 500 });
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ message: "Žiadni kupujúci na auto-vyhodnotenie", updated: 0 });
  }

  const updated: string[] = [];
  for (const k of candidates) {
    const { error: updateErr } = await sb
      .from("klienti")
      .update({ status: "uz_kupil" })
      .eq("id", k.id);
    if (updateErr) {
      console.error(`[auto-uz-kupil] update failed for ${k.id}:`, updateErr.message);
      continue;
    }
    // Audit trail
    await sb.from("klienti_history").insert({
      klient_id: k.id,
      action: "auto_uz_kupil",
      from_makler_id: k.makler_id,
      dovod: `Auto-vyhodnotenie: kupujúci viac ako rok v systéme (created ${k.created_at}, predchádzajúci stav: ${k.status})`,
      company_id: k.company_id,
    });
    updated.push(k.meno || String(k.id));
  }

  return NextResponse.json({
    message: `Auto-vyhodnotené: ${updated.length} kupujúcich → "Už kúpil"`,
    updated_count: updated.length,
    updated_names: updated.slice(0, 20),
  });
}
