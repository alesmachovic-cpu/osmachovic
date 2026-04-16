import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * /api/cron/odklik
 *
 * Automaticky presúva klientov do Odkliku po 24h bez akcie:
 *
 *   - status "novy" / "novy_kontakt"  → 24h od updated_at
 *   - status "volat_neskor"           → 24h od datum_naberu
 *   - status "dohodnuty_naber"        → 24h od datum_naberu A bez vyplneneho naberaka
 *   - status "nechce_rk"              → okamžite
 *
 * Spustenie:
 *   - Vercel cron (daily)
 *   - Manuálne z UI: GET /api/cron/odklik?key=__internal__
 *   - Externý cron: Bearer CRON_SECRET
 */
export async function GET(request: Request) {
  const startTime = Date.now();

  // Auth
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
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const movedIds: string[] = [];
    const reasons: Record<string, string> = {};

    // 1) "nechce_rk" → presun okamžite (bez ohľadu na čas)
    const { data: nechceRk } = await sb
      .from("klienti")
      .select("id, status")
      .eq("status", "nechce_rk")
      .eq("je_v_odkliku", false);

    for (const k of nechceRk || []) {
      movedIds.push(k.id);
      reasons[k.id] = "nechce_rk";
    }

    // 2) "novy" / "novy_kontakt" → 24h od updated_at
    const { data: novi } = await sb
      .from("klienti")
      .select("id, status, updated_at")
      .in("status", ["novy", "novy_kontakt"])
      .eq("je_v_odkliku", false)
      .lt("updated_at", dayAgo);

    for (const k of novi || []) {
      movedIds.push(k.id);
      reasons[k.id] = `${k.status} (24h bez zmeny)`;
    }

    // 3) "volat_neskor" → 24h od datum_naberu
    const { data: volat } = await sb
      .from("klienti")
      .select("id, status, datum_naberu")
      .eq("status", "volat_neskor")
      .eq("je_v_odkliku", false)
      .not("datum_naberu", "is", null)
      .lt("datum_naberu", dayAgo);

    for (const k of volat || []) {
      movedIds.push(k.id);
      reasons[k.id] = "volat_neskor (24h po termíne)";
    }

    // 4) "dohodnuty_naber" → 24h od datum_naberu A bez vyplneneho naberaka
    const { data: naber } = await sb
      .from("klienti")
      .select("id, status, datum_naberu")
      .eq("status", "dohodnuty_naber")
      .eq("je_v_odkliku", false)
      .not("datum_naberu", "is", null)
      .lt("datum_naberu", dayAgo);

    if (naber?.length) {
      // Zisti ktorí z nich NEMAJÚ náberový list
      const klientIds = naber.map((k) => k.id);
      const { data: nabery } = await sb
        .from("naberove_listy")
        .select("klient_id")
        .in("klient_id", klientIds);

      const sNaberakom = new Set((nabery || []).map((n) => n.klient_id));
      for (const k of naber) {
        if (!sNaberakom.has(k.id)) {
          movedIds.push(k.id);
          reasons[k.id] = "dohodnuty_naber (24h po termíne, bez náberáka)";
        }
      }
    }

    // Vykonaj presun
    let movedCount = 0;
    if (movedIds.length > 0) {
      // Najprv načítaj pôvodný status (na uloženie do odklik_from_status)
      const { data: toMove } = await sb
        .from("klienti")
        .select("id, status")
        .in("id", movedIds);

      for (const k of toMove || []) {
        const { error } = await sb
          .from("klienti")
          .update({
            je_v_odkliku: true,
            odklik_from_status: k.status,
            odklik_at: now.toISOString(),
          })
          .eq("id", k.id);

        if (!error) movedCount++;
      }
    }

    return NextResponse.json({
      message: `Presunutých ${movedCount} klientov do Odkliku`,
      moved_count: movedCount,
      reasons,
      duration_ms: Date.now() - startTime,
    });
  } catch (e) {
    console.error("[odklik] error:", e);
    return NextResponse.json(
      { error: String(e), duration_ms: Date.now() - startTime },
      { status: 500 }
    );
  }
}
