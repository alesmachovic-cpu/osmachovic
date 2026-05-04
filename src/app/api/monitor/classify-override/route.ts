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

  // 1) Načítaj aktuálny inzerát
  const { data: row, error: fetchErr } = await sb
    .from("monitor_inzeraty")
    .select("id, portal, external_id, predajca_meno, predajca_telefon, popis")
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

  // 3) Pridaj do rk_directory pre training (silentne ignoruj duplikáty cez UNIQUE constraint)
  const dirRows: Array<Record<string, unknown>> = [];
  if (row.predajca_telefon) {
    dirRows.push({
      telefon: row.predajca_telefon, typ, pridal_user_id: auth.user.id, poznamka: body.poznamka || null,
    });
  }
  if (row.predajca_meno) {
    dirRows.push({
      meno: row.predajca_meno, typ, pridal_user_id: auth.user.id, poznamka: body.poznamka || null,
    });
  }
  // Extract domain from popis
  const domainMatch = (row.popis || "").match(/[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/i);
  if (domainMatch) {
    dirRows.push({
      email_domain: domainMatch[1].toLowerCase(), typ, pridal_user_id: auth.user.id, poznamka: body.poznamka || null,
    });
  }
  let dirAdded = 0;
  let dirTableMissing = false;
  if (dirRows.length > 0) {
    // Insertujeme po jednom — UNIQUE constraints na (telefon,typ) a (email_domain,typ)
    // môžu duplikovať, ignorujeme chyby per-row.
    for (const r of dirRows) {
      const { error } = await sb.from("rk_directory").insert(r);
      if (!error) {
        dirAdded++;
      } else if (/relation "rk_directory" does not exist|Could not find the table/i.test(error.message)) {
        dirTableMissing = true;
        break; // tabuľka neexistuje (mig 041 nie je aplikovaná)
      }
      // 23505 = unique violation, ignorujeme — chytí sa per-row
    }
  }

  // 4) Spočítaj koľko ďalších inzerátov by sa mohlo preklasifikovať vďaka
  //    novému rk_directory záznamu (informačný count pre UI).
  let cascadeCount = 0;
  if (row.predajca_telefon) {
    const { count } = await sb
      .from("monitor_inzeraty")
      .select("id", { count: "exact", head: true })
      .eq("predajca_telefon", row.predajca_telefon)
      .neq("id", inzeratId);
    cascadeCount = count || 0;
  }

  return NextResponse.json({
    ok: true,
    inzerat_id: inzeratId,
    new_typ: typ,
    rk_directory_added: dirAdded,
    rk_directory_missing: dirTableMissing,
    cascade_count: cascadeCount,
    message: dirTableMissing
      ? "Override zaznamenaný (rk_directory tabuľka ešte nie je vytvorená — spusť migráciu 041)."
      : cascadeCount > 0
      ? `Override zaznamenaný. ${cascadeCount} ďalších inzerátov sa pri ďalšom scrape preklasifikuje.`
      : "Override zaznamenaný.",
  });
}
