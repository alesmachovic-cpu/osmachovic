import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { notifyUser, userIdFromMaklerId, brandedEmailHtml } from "@/lib/notify";

export const runtime = "nodejs";

/**
 * GET /api/manazer/sla — zoznam klientov s aktívnym SLA porušením (72h+)
 *   pre manažérsky dashboard.
 *
 * POST /api/manazer/sla — manažérska akcia
 *   { action: "presunut", klient_id, to_makler_id, by_user_id, dovod? }
 *     → presunie klienta na iného makléra, vyčistí SLA flagy, restart status=novy
 *   { action: "napomenut", klient_id, by_user_id, dovod? }
 *     → zvýši napomenutia_count, log do history, push notifikácia maklerovi
 *   { action: "ponechat", klient_id, by_user_id }
 *     → manažér iba potvrdí (zruší critical flag, klient zostáva u makléra
 *       bez napomenutia, počítadlo ostáva)
 */
export async function GET() {
  try {
    const sb = getSupabaseAdmin();

    // Klienti s critical SLA (72h+) ktorí ešte nie sú vyriešení manažérom
    const { data: critical } = await sb
      .from("klienti")
      .select(`
        id, meno, telefon, status, datum_naberu, makler_id,
        sla_warning_at, sla_critical_at, manager_action_type, manager_action_at,
        napomenutia_count, posledne_napomenutie_at, posledne_napomenutie_dovod
      `)
      .not("sla_critical_at", "is", null)
      .is("manager_action_at", null)         // ešte nezasiahol manažér
      .eq("je_volny", false)
      .order("sla_critical_at", { ascending: false });

    // Štatistika napomenutí per maklér
    const { data: napomenutiaStats } = await sb
      .from("klienti_history")
      .select("from_makler_id, action, created_at")
      .in("action", ["napomenuty", "sla_critical"])
      .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    return NextResponse.json({
      critical: critical || [],
      stats: napomenutiaStats || [],
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sb = getSupabaseAdmin();
    const body = await request.json();
    const { action, klient_id, by_user_id, dovod } = body;
    if (!action || !klient_id) return NextResponse.json({ error: "Missing action/klient_id" }, { status: 400 });

    const { data: klient } = await sb.from("klienti").select("makler_id, meno, napomenutia_count").eq("id", klient_id).single();
    if (!klient) return NextResponse.json({ error: "Klient not found" }, { status: 404 });

    if (action === "presunut") {
      const toMaklerId = body.to_makler_id as string | null;
      if (!toMaklerId) return NextResponse.json({ error: "Missing to_makler_id" }, { status: 400 });
      const { error } = await sb
        .from("klienti")
        .update({
          makler_id: toMaklerId,
          status: "novy",
          sla_warning_at: null,
          sla_critical_at: null,
          sla_last_chance_at: null,
          manager_action_at: new Date().toISOString(),
          manager_action_type: "presunutie",
          updated_at: new Date().toISOString(),
        })
        .eq("id", klient_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await sb.from("klienti_history").insert({
        klient_id,
        action: "manager_presun",
        from_makler_id: klient.makler_id || null,
        to_makler_id: toMaklerId,
        by_user_id,
        dovod: dovod || "Manažér presunul klienta na iného makléra po 72h SLA",
      });
      return NextResponse.json({ success: true });
    }

    if (action === "napomenut") {
      const newCount = (klient.napomenutia_count || 0) + 1;
      const { error } = await sb
        .from("klienti")
        .update({
          napomenutia_count: newCount,
          posledne_napomenutie_at: new Date().toISOString(),
          posledne_napomenutie_dovod: dovod || null,
          manager_action_at: new Date().toISOString(),
          manager_action_type: "napomenutie",
        })
        .eq("id", klient_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await sb.from("klienti_history").insert({
        klient_id,
        action: "napomenuty",
        from_makler_id: klient.makler_id || null,
        by_user_id,
        dovod: dovod || `Napomenutý za nedodržanie SLA u klienta ${klient.meno}`,
        meta: { napomenutia_total: newCount },
      });
      // Per-maklér push + email (cieliene iba na napomenutého)
      const maklerUserId = await userIdFromMaklerId(klient.makler_id || null);
      if (maklerUserId) {
        await notifyUser(maklerUserId, {
          type: "odklik",
          title: "Manažér ťa napomenul",
          body: `Klient ${klient.meno} — ${dovod || "Nedodržanie SLA"}`,
          url: `/klienti/${klient_id}`,
          emailSubject: `Vianema CRM — napomenutie (klient ${klient.meno})`,
          emailHtml: brandedEmailHtml({
            title: "Manažér ti udelil napomenutie",
            body: `<p>Manažér ťa napomenul za nedodržanie SLA u klienta <strong>${klient.meno}</strong>.</p><p style="margin-top:12px;"><strong>Dôvod:</strong> ${dovod || "Nedodržanie SLA"}</p><p style="margin-top:12px;">Toto je <strong>${newCount}.</strong> napomenutie za posledných 90 dní.</p>`,
            ctaUrl: `/klienti/${klient_id}`,
            ctaLabel: "Otvoriť kartu klienta",
          }),
        });
      }
      return NextResponse.json({ success: true, napomenutia_count: newCount });
    }

    if (action === "ponechat") {
      const { error } = await sb
        .from("klienti")
        .update({
          sla_critical_at: null,        // manažér rozhodol — critical sa ruší
          manager_action_at: new Date().toISOString(),
          manager_action_type: "ponechanie",
        })
        .eq("id", klient_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
