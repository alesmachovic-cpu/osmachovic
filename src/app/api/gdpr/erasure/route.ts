import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, isSuperAdmin } from "@/lib/auth/requireUser";
import { getUserScope } from "@/lib/scope";
import { logAudit } from "@/lib/audit";
import { requireReAuth } from "@/lib/auth/reAuth";

export const runtime = "nodejs";

/**
 * POST /api/gdpr/erasure
 * Body: { klient_id: string, reason?: string }
 *
 * 🚨 FIX 2026-05-20 (Compliance Officer + Security Auditor P0):
 * Pôvodne endpoint LEN uložil žiadosť do gdpr_requests so statusom "pending",
 * NIKDY nezavolal cascade delete. 30-dňová zákonná lehota plynie pri každej žiadosti
 * → garantované porušenie GDPR čl. 17 + zák. 18/2018 § 23.
 *
 * Teraz: ADMIN ONLY (irreverzibilná operácia). Vykonáva kompletný cascade delete +
 * anonymizáciu. Faktúry ostávajú (10-r retention podľa DPH § 76 + ZoÚ § 35).
 *
 * Cascade DELETE:
 *   - klient_dokumenty (OP scan, podpisy)
 *   - signature_otps
 *   - obhliadky (kde klient bol predávajúci alebo kupujúci)
 *   - naberove_listy
 *   - klient_udalosti (komunikačná história)
 *   - klient row ANONYMIZÁCIA (meno → "[anonymized]", PII fields → NULL)
 *
 * Audit log entry je MANDATORY (forenzný dôkaz).
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req, { strict: true });
  if (auth.error) return auth.error;
  if (!isSuperAdmin(auth.user.role)) {
    return NextResponse.json({ error: "GDPR erasure môže spustiť len admin/majiteľ" }, { status: 403 });
  }

  let body: { klient_id?: string; reason?: string; confirm_password?: string; confirm_code?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  const klientId = body.klient_id;
  if (!klientId) return NextResponse.json({ error: "klient_id required" }, { status: 400 });

  // 🔒 M1 force re-auth — GDPR erasure je irreverzibilná operácia.
  // Vyžadujeme heslo ALEBO 6-cifrový kód aby sa zabránilo nechtenému kliku
  // alebo stolen-session zneužitiu.
  const reAuth = await requireReAuth({
    userId: auth.user.id,
    password: body.confirm_password,
    code: body.confirm_code,
  });
  if (!reAuth.ok) {
    return NextResponse.json({
      error: reAuth.error,
      code: "RE_AUTH_REQUIRED",
      reason: reAuth.reason,
    }, { status: reAuth.status });
  }

  const sb = getSupabaseAdmin();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  // 1) Over že klient existuje + získaj snapshot pre audit
  const { data: klient, error: getErr } = await sb
    .from("klienti")
    .select("id, meno, company_id, makler_id, anonymized_at")
    .eq("id", klientId)
    .maybeSingle();
  if (getErr) return NextResponse.json({ error: getErr.message }, { status: 500 });
  if (!klient) return NextResponse.json({ error: "Klient nenájdený" }, { status: 404 });

  // 🔒 F1 (2026-06-03): super_admin je company-level — nesmie nezvratne vymazať
  // klienta inej firmy. Platform_admin (cross-company) je výnimka. Cross-company
  // → 404 (nepriznať existenciu).
  if (auth.user.role !== "platform_admin") {
    const scope = await getUserScope(auth.user.id);
    if (!scope || klient.company_id !== scope.company_id) {
      return NextResponse.json({ error: "Klient nenájdený" }, { status: 404 });
    }
  }

  if (klient.anonymized_at) {
    return NextResponse.json({ error: "Klient už bol anonymizovaný", anonymized_at: klient.anonymized_at }, { status: 409 });
  }

  // 2) Vlož GDPR request záznam ("in_progress") — POVINNÁ evidencia žiadosti
  //    (GDPR čl. 5 ods. 2 accountability, čl. 30 RoPA, čl. 12 ods. 3 lehota).
  //    🔒 FAIL-CLOSED (G33-b): ak sa evidencia nepodarí uložiť, výmaz sa NEVYKONÁ —
  //    žiadne dáta klienta sa nedotknú, kým nemáme zaevidovanú žiadosť.
  const { data: gdprReq, error: gdprErr } = await sb.from("gdpr_requests").insert({
    user_id: auth.user.id,
    klient_id: klientId,
    type: "erasure",
    status: "in_progress",
    details: {
      klient_id: klientId,
      klient_meno: klient.meno,
      reason: body.reason || null,
      requested_by_ip: ip,
      actor_id: auth.user.id,
    },
  }).select().single();
  if (gdprErr || !gdprReq) {
    console.error("[gdpr.erasure] evidencia žiadosti zlyhala:", gdprErr?.message);
    return NextResponse.json({
      error: "GDPR výmaz NEBOL vykonaný — evidenciu žiadosti sa nepodarilo uložiť (accountability, GDPR čl. 5 ods. 2). Žiadne dáta klienta neboli zmenené. Skús znova alebo kontaktuj administrátora.",
      code: "EVIDENCE_FAILED",
    }, { status: 500 });
  }

  // 3) MANDATORY forenzný audit PRED výmazom (čl. 5 ods. 2 dôkaz).
  //    🔒 FAIL-CLOSED (G33-b/c): ak sa audit nezapíše, výmaz sa NEVYKONÁ — nesmieme
  //    meniť dáta bez forenzného trailu. Evidenciu označíme "rejected" a skončíme.
  const startedAudited = await logAudit({
    action: "gdpr.erasure.started",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_id: klientId,
    target_type: "klient",
    detail: { klient_meno: klient.meno, gdpr_request_id: gdprReq.id },
    ip_address: ip || undefined,
  });
  if (!startedAudited) {
    await sb.from("gdpr_requests").update({
      status: "rejected",
      completed_at: new Date().toISOString(),
      details: { ...(gdprReq.details as Record<string, unknown>), abort_reason: "audit_log zápis zlyhal — fail-closed pred výmazom" },
    }).eq("id", gdprReq.id);
    return NextResponse.json({
      error: "GDPR výmaz NEBOL vykonaný — forenzný audit zápis zlyhal (povinný pred výmazom). Žiadne dáta klienta neboli zmenené.",
      code: "AUDIT_FAILED",
    }, { status: 500 });
  }

  // 4) Cascade DELETE
  const errors: string[] = [];
  const counts: Record<string, number> = {};

  // 🔒 AML retention: doklady s aml_retention=true (kópia OP, identifikácia,
  // overovacia dokumentácia) sa NEMAŽÚ — § 20 zák. 297/2008 prikazuje uchovať
  // ich 5 r. po skončení vzťahu (právny základ čl. 6 ods.1 c GDPR, výnimka z
  // práva na výmaz čl. 17 ods.3 b). Ostatné doklady (foto, LV, nábery) sa mažú.
  const AML_RETENTION_TYPES = ["Identifikácia", "OP", "Občiansky preukaz", "AML", "KYC"];
  const { data: docs } = await sb
    .from("klient_dokumenty")
    .select("id, type, aml_retention")
    .eq("klient_id", klientId);
  const isAmlRetained = (d: { type?: string | null; aml_retention?: boolean | null }) =>
    d.aml_retention === true || (d.type != null && AML_RETENTION_TYPES.includes(d.type));
  const toDelete = (docs ?? []).filter(d => !isAmlRetained(d)).map(d => d.id);
  const toKeep = (docs ?? []).filter(isAmlRetained).map(d => d.id);

  if (toDelete.length) {
    const dDel = await sb.from("klient_dokumenty").delete().in("id", toDelete);
    if (dDel.error) errors.push(`dokumenty: ${dDel.error.message}`);
  }
  counts.dokumenty_zmazane = toDelete.length;

  // AML doklady ponechané — nastav retention_do = dnes + 5 rokov (koniec vzťahu).
  if (toKeep.length) {
    const retentionDo = new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const dKeep = await sb
      .from("klient_dokumenty")
      .update({ retention_do: retentionDo })
      .in("id", toKeep)
      .is("retention_do", null);
    if (dKeep.error) errors.push(`aml retention set: ${dKeep.error.message}`);
  }
  counts.dokumenty_aml_ponechane = toKeep.length;

  // G33-f: signature_otps (migr. 040) — predtým kód mazal z neexistujúcej `podpis_otps`
  // FILTROM `klient_id` → "1 chyba". signature_otps je POLYMORFNÉ (entity_type/entity_id =
  // naber/vyhradna_zmluva/objednavka), NEMÁ klient_id. OTP obsahujú telefon = PII klienta.
  // Správne: pozbieraj ID podpisovateľných entít klienta a zmaž OTP podľa entity_id
  // (entity_id je UUID, globálne unikátny → filter na entity_id stačí, bez entity_type).
  // Zbierame PRED zmazaním náberov/zmlúv nižšie.
  const sigEntityIds: string[] = [];
  const { data: _nbIds } = await sb.from("naberove_listy").select("id").eq("klient_id", klientId);
  sigEntityIds.push(...(_nbIds ?? []).map(r => r.id));
  const { data: _objIds } = await sb.from("objednavky").select("id").eq("klient_id", klientId);
  sigEntityIds.push(...(_objIds ?? []).map(r => r.id));
  const { data: _vzIds } = await sb.from("vyhradne_zmluvy").select("id").eq("klient_id", klientId);
  sigEntityIds.push(...(_vzIds ?? []).map(r => r.id));
  if (sigEntityIds.length) {
    const d2 = await sb.from("signature_otps").delete().in("entity_id", sigEntityIds);
    if (d2.error) errors.push(`signature_otps: ${d2.error.message}`); else counts.signature_otps = d2.count ?? 0;
  } else {
    counts.signature_otps = 0;
  }

  const d3 = await sb.from("obhliadky").delete()
    .or(`predavajuci_klient_id.eq.${klientId},kupujuci_klient_id.eq.${klientId}`);
  if (d3.error) errors.push(`obhliadky: ${d3.error.message}`); else counts.obhliadky = d3.count ?? 0;

  const d4 = await sb.from("naberove_listy").delete().eq("klient_id", klientId);
  if (d4.error) errors.push(`nabery: ${d4.error.message}`); else counts.nabery = d4.count ?? 0;

  const d5 = await sb.from("klient_udalosti").delete().eq("klient_id", klientId);
  if (d5.error) errors.push(`udalosti: ${d5.error.message}`); else counts.udalosti = d5.count ?? 0;

  // 🔒 G1: vyhradne_zmluvy.majitelia obsahuje rodné číslo + PII vlastníkov.
  // Zmluvu NEmažeme (môže mať retenciu pre právne nároky), ale anonymizujeme
  // PII v majitelia (zmaže rodné číslo, meno, bydlisko, kontakt) — GDPR čl. 17
  // + § 78 zák. 18/2018 (rodné číslo). Údaje o nehnuteľnosti + zmluva ostávajú.
  const { data: zmluvy } = await sb.from("vyhradne_zmluvy").select("id, majitelia").eq("klient_id", klientId);
  for (const z of zmluvy ?? []) {
    const pocet = Array.isArray(z.majitelia) ? z.majitelia.length : 0;
    const anon = Array.from({ length: pocet || 1 }, () => ({ anonymized: true, anonymized_at: new Date().toISOString() }));
    const { error: vzErr } = await sb.from("vyhradne_zmluvy").update({ majitelia: anon }).eq("id", z.id);
    if (vzErr) errors.push(`vyhradne_zmluvy ${z.id}: ${vzErr.message}`);
  }
  counts.vyhradne_zmluvy_anonymizovane = (zmluvy ?? []).length;

  // 5) Anonymizuj klient row (nemazať — môže byť referenced v faktúrach pre 10y retention)
  const { error: anonErr } = await sb.from("klienti").update({
    meno: "[anonymized — GDPR erasure]",
    telefon: null,
    email: null,
    lokalita: null,
    poznamka: null,
    lv_data: null,
    anonymized_at: new Date().toISOString(),
  }).eq("id", klientId);
  if (anonErr) errors.push(`klient anonymize: ${anonErr.message}`);

  // 🔒 F5: Google Drive sa NEzmaže programaticky — OAuth scope je drive.readonly
  // (CRM nemá oprávnenie mazať Drive súbory). Klientske dokumenty (OP, LV scany)
  // v Drive ostávajú → výmaz by bol neúplný (GDPR čl. 17). Preto generujeme
  // explicitnú úlohu + audit záznam, aby admin Drive priečinok klienta zmazal ručne.
  // POZN (G33-d): Drive-manual je OČAKÁVANÝ stav, NIE chyba erasure — preto NEpridáva
  // do errors[], len samostatný audit + flag v odpovedi.
  const driveAudited = await logAudit({
    action: "gdpr.erasure.drive_manual_required",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_id: klientId,
    target_type: "klient",
    detail: { klient_meno_pred: klient.meno, gdpr_request_id: gdprReq.id,
      poznamka: "Zmaž ručne Drive priečinok klienta (OP/LV scany) — scope drive.readonly neumožňuje programatické mazanie." },
    ip_address: ip || undefined,
  });
  if (!driveAudited) errors.push("audit drive_manual_required: zápis zlyhal");

  // 6) Záverečný forenzný audit (best-effort — dáta sú už zmenené, fail-closed sa
  //    už nedá; ak zlyhá, zaznamenáme do errors aby to nebolo tiché — G33-d).
  const finalAudited = await logAudit({
    action: errors.length === 0 ? "gdpr.erasure.completed" : "gdpr.erasure.partial",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_id: klientId,
    target_type: "klient",
    detail: { errors, deleted_counts: counts, gdpr_request_id: gdprReq.id },
    ip_address: ip || undefined,
  });
  if (!finalAudited) errors.push("záverečný audit: zápis zlyhal");

  // 7) Aktualizuj evidenciu žiadosti — POSLEDNÉ, aby zachytila VŠETKY chyby (vrátane
  //    auditových). Status v rámci CHECK constraintu (completed); partial=true keď boli
  //    chyby sub-záznamov. completed_at = preukázateľnosť 30-dňovej lehoty (G33-e).
  const { error: updErr } = await sb.from("gdpr_requests").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    details: { ...(gdprReq.details as Record<string, unknown>), errors, deleted_counts: counts, partial: errors.length > 0 },
  }).eq("id", gdprReq.id);
  if (updErr) console.error("[gdpr.erasure] completion evidencia update zlyhal:", updErr.message);

  return NextResponse.json({
    ok: errors.length === 0,
    klient_id: klientId,
    gdpr_request_id: gdprReq?.id,
    deleted: counts,
    errors: errors.length > 0 ? errors : undefined,
    drive_manual_delete_required: true,
    message: (errors.length === 0
      ? "GDPR erasure dokončená. Faktúry ostávajú anonymizované (10y retention podľa DPH zákona § 76)."
      : `GDPR erasure čiastočne dokončená. ${errors.length} chýb. Manuálna kontrola.`)
      + " ⚠️ DÔLEŽITÉ: Zmaž ručne aj priečinok klienta v Google Drive (OP/LV scany) — systém ho nevie zmazať automaticky.",
  });
}
