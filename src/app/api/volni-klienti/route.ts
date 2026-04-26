import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * GET /api/volni-klienti — zoznam voľných klientov + SLA stavy
 *   ?filter=all | predal | rk | sla_warning | sla_critical
 *
 * Vracia okrem klientov aj `sla_warnings` a `sla_critical` zoznamy
 * pre SLA-poruseni (klienti čo nie sú voľní ale už majú warning/critical).
 */
export async function GET(request: Request) {
  try {
    const sb = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all";

    // 1) Voľní klienti
    let query = sb
      .from("klienti")
      .select("id, meno, telefon, email, lokalita, typ, status, volny_dovod, volny_at, datum_naberu, makler_id, poznamka", { count: "exact" })
      .eq("je_volny", true)
      .order("volny_at", { ascending: false });

    if (filter === "predal") {
      query = query.eq("volny_dovod", "uz_predal");
    } else if (filter === "rk") {
      query = query.or("status.eq.realitna_kancelaria,volny_dovod.eq.realitna_kancelaria,status.eq.nechce_rk,volny_dovod.eq.nechce_rk");
    }

    const { data: voľní, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 2) SLA warnings a critical (klienti NIE sú vo voľnom poole, ale majú flag)
    const [{ data: slaWarnings }, { data: slaCritical }] = await Promise.all([
      sb.from("klienti")
        .select("id, meno, telefon, status, datum_naberu, makler_id, sla_warning_at, sla_critical_at")
        .not("sla_warning_at", "is", null)
        .is("sla_critical_at", null)
        .eq("je_volny", false)
        .order("sla_warning_at", { ascending: false }),
      sb.from("klienti")
        .select("id, meno, telefon, status, datum_naberu, makler_id, sla_critical_at, napomenutia_count, manager_action_type, manager_action_at")
        .not("sla_critical_at", "is", null)
        .eq("je_volny", false)
        .order("sla_critical_at", { ascending: false }),
    ]);

    return NextResponse.json({
      klienti: voľní || [],
      total: count || 0,
      sla_warnings: slaWarnings || [],
      sla_critical: slaCritical || [],
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * POST /api/volni-klienti — akcie
 *   { action: "vratit", klient_id }                  — vráti späť ako "novy" pôvodnému makléron
 *   { action: "prebrat", klient_id, makler_id, by_user_id } — iný maklér si klienta prevezme
 */
export async function POST(request: Request) {
  try {
    const sb = getSupabaseAdmin();
    const body = await request.json();
    const { action, klient_id } = body;
    if (!klient_id) return NextResponse.json({ error: "Missing klient_id" }, { status: 400 });

    if (action === "vratit") {
      // Pôvodný stav: zruš voľný flag, nastav status novy, makler_id ostáva
      const { data: prevKlient } = await sb.from("klienti").select("makler_id").eq("id", klient_id).single();
      const { error } = await sb
        .from("klienti")
        .update({
          je_volny: false,
          status: "novy",
          volny_dovod: null,
          volny_at: null,
          sla_warning_at: null,
          sla_critical_at: null,
          sla_last_chance_at: null,
        })
        .eq("id", klient_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await sb.from("klienti_history").insert({
        klient_id,
        action: "vrateny_novy",
        from_makler_id: prevKlient?.makler_id || null,
        to_makler_id: prevKlient?.makler_id || null,
        by_user_id: body.by_user_id || null,
        dovod: "Manuálne vrátený späť ako Nový",
      });
      return NextResponse.json({ success: true, message: "Klient vrátený ako Nový" });
    }

    if (action === "prebrat") {
      const newMaklerId = body.makler_id as string | null;
      if (!newMaklerId) return NextResponse.json({ error: "Missing makler_id" }, { status: 400 });
      const { data: prevKlient } = await sb.from("klienti").select("makler_id").eq("id", klient_id).single();
      const { error } = await sb
        .from("klienti")
        .update({
          makler_id: newMaklerId,
          je_volny: false,
          status: "novy",       // re-štart 24h SLA pre nového makléra
          volny_dovod: null,
          volny_at: null,
          sla_warning_at: null,
          sla_critical_at: null,
          sla_last_chance_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", klient_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await sb.from("klienti_history").insert({
        klient_id,
        action: "prebraty",
        from_makler_id: prevKlient?.makler_id || null,
        to_makler_id: newMaklerId,
        by_user_id: body.by_user_id || null,
        dovod: "Maklér prebral voľného klienta",
      });
      return NextResponse.json({ success: true, message: "Klient prebraný" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
