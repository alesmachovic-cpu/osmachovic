import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { logAudit } from "@/lib/audit";
import { requireReAuth } from "@/lib/auth/reAuth";

export const runtime = "nodejs";

/**
 * Statusy ktoré vyžadujú FORCE RE-AUTH (M1 pen-test fix).
 * Tieto sú finančne / právne kritické — kompromitovaná session nemá vykonávať.
 */
const REAUTH_REQUIRED_STATUSES = new Set(["podpisane", "vklad", "ukoncene"]);

/**
 * Statusy obchodu, ktoré vyžadujú dokončenú AML kontrolu PRED prechodom.
 *
 * Zákon 297/2008 Z.z. o ochrane pred legalizáciou príjmov z trestnej činnosti
 * (AML zákon) — § 10: povinná osoba (realitná kancelária) musí pred uzavretím
 * obchodného vzťahu identifikovať a overiť identitu klienta. KZ = obchodný
 * vzťah → AML musí byť hotové PRED podpisom KZ.
 *
 * Implementácia: úlohy obchodu (`obchod_ulohy.kategoria='aml'`) musia byť
 * všetky `done=true` predtým než status prejde do `pred_podpisom_kz` alebo
 * vyššie. Inak 403 + audit log `kz.aml_blocked`.
 */
const AML_GATED_STATUSES = new Set(["pred_podpisom_kz", "podpisane", "vklad", "ukoncene"]);

/** PATCH /api/obchody/[id] — aktualizácia obchodu (status, fakty, poznámky) */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  const ALLOWED = ["status", "cena", "provizia", "kupujuci_meno", "notar", "banka", "poznamky", "nehnutelnost_id"];
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ALLOWED) {
    if (k in body) patch[k] = body[k];
  }

  const sb = getSupabaseAdmin();

  // 🚨 P1 cross-tenant guard — over že obchod patrí do firmy auth-usera.
  const { data: obchodScope } = await sb.from("obchody").select("company_id").eq("id", id).maybeSingle();
  if (!obchodScope) return NextResponse.json({ error: "Obchod nenájdený" }, { status: 404 });
  if (obchodScope.company_id !== auth.user.company_id && auth.user.role !== "platform_admin") {
    return NextResponse.json({ error: "Obchod patrí do inej firmy" }, { status: 403 });
  }

  // 🔒 AML HARD BLOCKER — zákon 297/2008 § 10.
  const nextStatus = typeof patch.status === "string" ? (patch.status as string) : null;

  // 🔒 M1 force re-auth pre kritické status zmeny (KZ podpis, vklad, ukoncenie)
  // — financial / legal commit, nemôže byť cez stolen session.
  if (nextStatus && REAUTH_REQUIRED_STATUSES.has(nextStatus)) {
    const reAuth = await requireReAuth({
      userId: auth.user.id,
      password: typeof body.confirm_password === "string" ? body.confirm_password : undefined,
      code: typeof body.confirm_code === "string" ? body.confirm_code : undefined,
    });
    if (!reAuth.ok) {
      return NextResponse.json({
        error: reAuth.error,
        code: "RE_AUTH_REQUIRED",
        action: `obchod.status → ${nextStatus}`,
      }, { status: reAuth.status });
    }
  }
  if (nextStatus && AML_GATED_STATUSES.has(nextStatus)) {
    // Načítaj všetky AML úlohy pre tento obchod.
    const { data: amlUlohy, error: amlErr } = await sb
      .from("obchod_ulohy")
      .select("id, nazov, done")
      .eq("obchod_id", id)
      .eq("kategoria", "aml");

    if (amlErr) return NextResponse.json({ error: amlErr.message }, { status: 500 });

    const nesplnene = (amlUlohy ?? []).filter(u => !u.done);
    const ziadneAML = (amlUlohy ?? []).length === 0;

    if (ziadneAML || nesplnene.length > 0) {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
      await logAudit({
        action: "kz.aml_blocked",
        actor_id: auth.user.id,
        actor_name: auth.user.name,
        target_id: id,
        target_type: "obchod",
        detail: {
          requested_status: nextStatus,
          aml_tasks_total: (amlUlohy ?? []).length,
          aml_tasks_pending: nesplnene.map(u => u.nazov),
          reason: ziadneAML ? "no_aml_tasks" : "aml_incomplete",
        },
        ip_address: ip || undefined,
      });

      return NextResponse.json({
        error: ziadneAML
          ? "Nemôžem posunúť obchod — chýbajú AML úlohy. Pridaj AML kontrolu klienta do checklistu (zákon 297/2008 § 10)."
          : `Nemôžem posunúť obchod do "${nextStatus}" — AML kontrola nie je dokončená. Nesplnené: ${nesplnene.map(u => u.nazov).join(", ")}`,
        aml_blocked: true,
        pending_tasks: nesplnene.map(u => ({ id: u.id, nazov: u.nazov })),
      }, { status: 403 });
    }
  }

  const { data, error } = await sb
    .from("obchody")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit: každá zmena statusu obchodu je dôkazne relevantná.
  if (nextStatus) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    await logAudit({
      action: "obchod.update",
      actor_id: auth.user.id,
      actor_name: auth.user.name,
      target_id: id,
      target_type: "obchod",
      detail: { status: nextStatus, fields_changed: Object.keys(patch).filter(k => k !== "updated_at") },
      ip_address: ip || undefined,
    });
  }

  return NextResponse.json({ obchod: data });
}

/** DELETE /api/obchody/[id] — zmazanie obchodu (kaskádovo aj úlohy) */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { id } = await params;

  const sb = getSupabaseAdmin();
  // Snapshot pred deleteom pre audit + cross-tenant guard.
  const { data: snapshot } = await sb
    .from("obchody")
    .select("id, klient_id, status, cena, provizia, company_id")
    .eq("id", id)
    .maybeSingle();

  if (!snapshot) return NextResponse.json({ error: "Obchod nenájdený" }, { status: 404 });
  if (snapshot.company_id !== auth.user.company_id && auth.user.role !== "platform_admin") {
    return NextResponse.json({ error: "Obchod patrí do inej firmy" }, { status: 403 });
  }

  const { error } = await sb.from("obchody").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await logAudit({
    action: "obchod.delete",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_id: id,
    target_type: "obchod",
    detail: { snapshot },
    ip_address: ip || undefined,
  });

  return NextResponse.json({ ok: true });
}
