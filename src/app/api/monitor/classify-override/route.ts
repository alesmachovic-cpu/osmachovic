import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";

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
    .select("id, portal, external_id")
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

  // GDPR data-min: do rk_directory už NEUKLADÁME meno/telefón scrapnutých osôb.
  // Override sa aplikuje len na tento konkrétny inzerát (predajca_typ_override),
  // ktorý má pri ďalšom scrape behu prednosť pred algoritmom.
  return NextResponse.json({
    ok: true,
    inzerat_id: inzeratId,
    new_typ: typ,
    message: "Override zaznamenaný pre tento inzerát.",
  });
}
