import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST /api/monitor/classify-override
 * Body: { inzerat_id: uuid, typ: 'rk' | 'sukromny', poznamka?: string }
 *
 * Vyžaduje session (P0 hardening). user_id sa berie zo session.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body: { inzerat_id?: string; typ?: string; poznamka?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  const inzeratId = String(body.inzerat_id || "").trim();
  const typ = body.typ;
  if (!inzeratId) return NextResponse.json({ error: "inzerat_id je povinné" }, { status: 400 });
  if (typ !== "rk" && typ !== "sukromny") {
    return NextResponse.json({ error: "typ musí byť 'rk' alebo 'sukromny'" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // 1) Načítaj aktuálny inzerát (bez PII — GDPR data-min: meno/telefón/popis
  //    sa už neukladajú, takže nie sú k dispozícii ani pre override).
  const { data: row, error: fetchErr } = await sb
    .from("monitor_inzeraty")
    .select("id, portal, external_id, inzerent_id")
    .eq("id", inzeratId)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Inzerát neexistuje" }, { status: 404 });

  // 2) Update predajca_typ + override
  const dbEnum = typ === "rk" ? "firma" : "sukromny"; // legacy DB enum
  let updRes = await sb
    .from("monitor_inzeraty")
    .update({
      predajca_typ: dbEnum,
      predajca_typ_override: typ,
      predajca_typ_method: "manual",
      predajca_typ_confidence: 1.0,
    })
    .eq("id", inzeratId);
  // Defensive: ak migrácia 041 nie je aplikovaná, skús bez predajca_typ_override
  if (updRes.error && /predajca_typ_override/i.test(updRes.error.message)) {
    updRes = await sb
      .from("monitor_inzeraty")
      .update({ predajca_typ: dbEnum, predajca_typ_method: "manual", predajca_typ_confidence: 1.0 })
      .eq("id", inzeratId);
  }
  if (updRes.error) return NextResponse.json({ error: updRes.error.message }, { status: 500 });

  // 3) UČENIE — zapamätaj klasifikáciu pre celý účet predajcu (inzerent_id) a
  //    kaskádovo preklasifikuj všetky jeho inzeráty. inzerent_id je anonymné ID
  //    účtu (NIE kontakt/meno) → GDPR-bezpečné. Scraper to potom rešpektuje
  //    pre budúce inzeráty toho účtu. Plne vratné (opačný override prepíše).
  let cascadeCount = 0;
  let learned = false;
  if (row.inzerent_id) {
    const { error: upErr } = await sb
      .from("inzerent_klasifikacia")
      .upsert(
        { inzerent_id: row.inzerent_id, typ, pridal_user_id: auth.user.id, poznamka: body.poznamka || null, updated_at: new Date().toISOString() },
        { onConflict: "inzerent_id" }
      );
    // Ak tabuľka ešte neexistuje (migr. 111 neaplikovaná) → ticho preskoč učenie.
    if (!upErr || !/inzerent_klasifikacia|does not exist|Could not find/i.test(upErr.message)) {
      if (!upErr) {
        learned = true;
        // Kaskáda: preklasifikuj všetky inzeráty toho istého účtu okrem aktuálneho.
        const { data: cascaded } = await sb
          .from("monitor_inzeraty")
          .update({ predajca_typ: dbEnum, predajca_typ_override: typ, predajca_typ_method: "manual", predajca_typ_confidence: 1.0 })
          .eq("inzerent_id", row.inzerent_id)
          .neq("id", inzeratId)
          .select("id");
        cascadeCount = cascaded?.length || 0;
      }
    }
  }

  // Forenzný trail — manuálna klasifikácia je privilegovaná akcia (učenie + kaskáda).
  await logAudit({
    action: "monitor.classify_override",
    actor_id: auth.user.id,
    target_type: "monitor_inzeraty",
    target_id: inzeratId,
    detail: { new_typ: typ, learned, cascade_count: cascadeCount, inzerent_id: row.inzerent_id ?? null },
  });

  return NextResponse.json({
    ok: true,
    inzerat_id: inzeratId,
    new_typ: typ,
    learned,
    cascade_count: cascadeCount,
    message: learned
      ? (cascadeCount > 0
          ? `Zapamätané pre celý účet — ${cascadeCount} ďalších inzerátov preklasifikovaných.`
          : "Zapamätané pre celý účet predajcu.")
      : "Override zaznamenaný pre tento inzerát.",
  });
}
