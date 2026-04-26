import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * GET /api/odklik — zoznam klientov v Odkliku
 *   ?filter=all | predal | rk
 */
export async function GET(request: Request) {
  try {
    const sb = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all";

    let query = sb
      .from("klienti")
      .select("id, meno, telefon, email, lokalita, typ, status, odklik_from_status, odklik_at, datum_naberu, makler_id, poznamka", { count: "exact" })
      .eq("je_v_odkliku", true)
      .order("odklik_at", { ascending: false });

    if (filter === "predal") {
      query = query.eq("odklik_from_status", "uz_predal");
    } else if (filter === "rk") {
      query = query.or("status.eq.realitna_kancelaria,odklik_from_status.eq.realitna_kancelaria,status.eq.nechce_rk,odklik_from_status.eq.nechce_rk");
    }

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ klienti: data || [], total: count || 0 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * POST /api/odklik — akcie na klientovi
 *   { action: "vratit", klient_id: "..." }       → vráti klienta späť ako "novy"
 *   { action: "odstranit_odklik", klient_id: "..." } → trvalo zavrieť (soft)
 */
export async function POST(request: Request) {
  try {
    const sb = getSupabaseAdmin();
    const body = await request.json();
    const { action, klient_id } = body;

    if (!klient_id) {
      return NextResponse.json({ error: "Missing klient_id" }, { status: 400 });
    }

    if (action === "vratit") {
      // Vráť klienta späť ako "novy" a zruš odklik
      const { error } = await sb
        .from("klienti")
        .update({
          je_v_odkliku: false,
          status: "novy",
          odklik_from_status: null,
          odklik_at: null,
        })
        .eq("id", klient_id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, message: "Klient vrátený ako Nový" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
