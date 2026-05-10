import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { classify, toLegacyDbEnum } from "@/lib/monitor/classifier";
import type { ClassifierInput } from "@/lib/monitor/classifier";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/monitor/reclassify-all
 *
 * Prejde všetky aktívne inzeráty a re-klasifikuje ich cez classifier v2.
 * Rešpektuje predajca_typ_override — manuálne override-y preskočí.
 *
 * Len pre admin / super_admin. Timeout 5 minút (maxDuration=300).
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  if (auth.user.role !== "super_admin" && auth.user.role !== "admin") {
    return NextResponse.json({ error: "Nedostatočné oprávnenia" }, { status: 403 });
  }

  const sb = getSupabaseAdmin();

  // 1. Načítaj rk_directory — telefóny a mená klasifikované ako 'rk'
  const rkPhones = new Set<string>();
  const rkNames = new Set<string>();
  try {
    const { data: rkDir } = await sb
      .from("rk_directory")
      .select("telefon, meno")
      .eq("typ", "rk");
    for (const r of rkDir || []) {
      if (r.telefon) rkPhones.add(r.telefon);
      if (r.meno) rkNames.add(r.meno.toLowerCase());
    }
  } catch { /* ignoruj ak tabuľka neexistuje */ }

  // 2. Načítaj všetky aktívne inzeráty
  const { data: inzeraty, error: fetchErr } = await sb
    .from("monitor_inzeraty")
    .select("id, portal, nazov, popis, predajca_meno, predajca_telefon, lokalita, raw_data, canonical_id, predajca_typ_override")
    .eq("is_active", true);

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!inzeraty || inzeraty.length === 0) {
    return NextResponse.json({ ok: true, total: 0, updated: 0, skipped: 0 });
  }

  // 3. Predpočítaj frekvencie telefónov, mien a canonical_id z aktívnych inzerátov
  const phoneCount = new Map<string, number>();
  const nameCount = new Map<string, number>();
  const canonicalCount = new Map<string, number>();

  for (const r of inzeraty) {
    if (r.predajca_telefon) phoneCount.set(r.predajca_telefon, (phoneCount.get(r.predajca_telefon) || 0) + 1);
    if (r.predajca_meno)   nameCount.set(r.predajca_meno,   (nameCount.get(r.predajca_meno)   || 0) + 1);
    if (r.canonical_id)    canonicalCount.set(r.canonical_id, (canonicalCount.get(r.canonical_id) || 0) + 1);
  }

  // 4. Klasifikuj a updatuj po batchoch 50
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const BATCH = 50;

  for (let i = 0; i < inzeraty.length; i += BATCH) {
    const batch = inzeraty.slice(i, i + BATCH);
    const updates: Array<{
      id: string;
      predajca_typ: string | null;
      predajca_typ_confidence: number;
      predajca_typ_method: string | null;
      predajca_typ_signals: unknown;
    }> = [];

    for (const row of batch) {
      // Preskočí manuálne override-y
      if (row.predajca_typ_override) { skipped++; continue; }

      const in_rk_directory =
        (row.predajca_telefon ? rkPhones.has(row.predajca_telefon) : false) ||
        (row.predajca_meno    ? rkNames.has(row.predajca_meno.toLowerCase()) : false);

      const input: ClassifierInput = {
        portal: row.portal,
        nazov: row.nazov,
        popis: row.popis,
        predajca_meno: row.predajca_meno,
        predajca_telefon: row.predajca_telefon,
        lokalita: row.lokalita,
        raw_data: row.raw_data,
        db: {
          phone_count_30d: row.predajca_telefon ? (phoneCount.get(row.predajca_telefon) ?? 0) : undefined,
          name_count_30d:  row.predajca_meno    ? (nameCount.get(row.predajca_meno) ?? 0)     : undefined,
          listed_on_n_portals: row.canonical_id ? (canonicalCount.get(row.canonical_id) ?? 1)  : 1,
          in_rk_directory,
        },
      };

      const result = classify(input);

      updates.push({
        id: row.id,
        predajca_typ: toLegacyDbEnum(result.predajca_typ),
        predajca_typ_confidence: result.confidence,
        predajca_typ_method: result.signals.length > 0 ? "rule_v2" : null,
        predajca_typ_signals: { signals: result.signals, raw_score: result.raw_score, predajca_typ: result.predajca_typ },
      });
    }

    if (updates.length === 0) continue;

    // Skús upsert s predajca_typ_signals
    let { error } = await sb
      .from("monitor_inzeraty")
      .upsert(updates, { onConflict: "id" });

    // Defensive: ak migrácia 041 nie je aplikovaná, skús bez predajca_typ_signals
    if (error && /predajca_typ_signals/i.test(error.message)) {
      const updatesWithout = updates.map(({ predajca_typ_signals: _s, ...rest }) => rest);
      const retry = await sb.from("monitor_inzeraty").upsert(updatesWithout, { onConflict: "id" });
      error = retry.error;
    }

    if (error) {
      errors += updates.length;
    } else {
      updated += updates.length;
    }
  }

  return NextResponse.json({
    ok: true,
    total: inzeraty.length,
    updated,
    skipped,
    errors,
  });
}
