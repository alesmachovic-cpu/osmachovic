import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Retention auto-anonymizácia neaktívnych klientov (F11, GDPR čl. 5 ods.1 e —
 * obmedzenie uchovávania). Anonymizuje PII klientov-leadov, ktorí sa NIKDY
 * nestali obchodom a sú dlhšie ako RETENTION_YEARS neaktívni.
 *
 * 🔒 BEZPEČNOSŤ:
 * - DEFAULT = DRY-RUN. Reálne anonymizuje LEN keď `RETENTION_ANONYMIZE_ENABLED=true`.
 *   Inak vráti len zoznam kandidátov na review (žiadna zmena dát).
 * - Vylučuje klientov v akomkoľvek obchode (tí majú zákonnú retenciu — AML 5r,
 *   zmluvy, faktúry 10r). Anonymizujú sa len leady ktoré sa nikdy nerealizovali.
 * - Vylučuje už anonymizovaných.
 *
 * RETENTION_YEARS default 5 (konzervatívne) — uprav env podľa retention politiky.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const queryKey = request.nextUrl.searchParams.get("key");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && queryKey !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Default 7 rokov nečinnosti (odôvodnené dlhým realitným cyklom — predávajúci
  // dnes býva kupujúci o roky neskôr). Prepíše env RETENTION_YEARS.
  const years = Number(process.env.RETENTION_YEARS || "7");
  const enabled = process.env.RETENTION_ANONYMIZE_ENABLED === "true";
  const cutoff = new Date(Date.now() - years * 365 * 24 * 60 * 60 * 1000).toISOString();

  const sb = getSupabaseAdmin();

  // Kandidáti: neaktívni (updated_at < cutoff), nie anonymizovaní.
  const { data: candidates, error } = await sb
    .from("klienti")
    .select("id, meno, typ, status, updated_at")
    .is("anonymized_at", null)
    .lt("updated_at", cutoff);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Vylúč klientov, ktorí sú v akomkoľvek obchode (zákonná retencia).
  const { data: obchodKlienti } = await sb.from("obchody").select("klient_id");
  const inDeal = new Set((obchodKlienti ?? []).map((o: { klient_id: string | null }) => o.klient_id).filter(Boolean));
  const toAnon = (candidates ?? []).filter(k => !inDeal.has(k.id));

  // AML doklady, ktorým uplynula 5-ročná retencia (§ 20) → musia sa zmazať
  // (GDPR minimalizácia po splnení zákonnej povinnosti).
  const today = new Date().toISOString().slice(0, 10);
  const { data: expiredAml } = await sb
    .from("klient_dokumenty")
    .select("id")
    .not("retention_do", "is", null)
    .lt("retention_do", today);
  const expiredAmlIds = (expiredAml ?? []).map((d: { id: string }) => d.id);

  if (!enabled) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      retention_years: years,
      candidates_count: toAnon.length,
      aml_docs_expired_count: expiredAmlIds.length,
      candidates: toAnon.map(k => ({ id: k.id, typ: k.typ, status: k.status, updated_at: k.updated_at })),
      note: "DRY-RUN — žiadne dáta sa nezmenili. Pre reálnu anonymizáciu nastav RETENTION_ANONYMIZE_ENABLED=true.",
      ran_at: new Date().toISOString(),
    });
  }

  let anonymized = 0;
  const errors: string[] = [];
  for (const k of toAnon) {
    const { error: anonErr } = await sb.from("klienti").update({
      meno: "[anonymized — retention]",
      telefon: null,
      email: null,
      lokalita: null,
      poznamka: null,
      lv_data: null,
      anonymized_at: new Date().toISOString(),
    }).eq("id", k.id);
    if (anonErr) { errors.push(`${k.id}: ${anonErr.message}`); continue; }
    anonymized++;
    await logAudit({
      action: "klient.retention_anonymized",
      actor_id: null,
      actor_name: "cron/retention",
      target_id: k.id,
      target_type: "klient",
      detail: { retention_years: years, typ: k.typ, last_activity: k.updated_at },
      ip_address: undefined,
    });
  }

  // Zmaž AML doklady po uplynutí retencie (§ 20 lehota vypršala).
  let amlDeleted = 0;
  if (expiredAmlIds.length) {
    const dAml = await sb.from("klient_dokumenty").delete().in("id", expiredAmlIds);
    if (dAml.error) errors.push(`aml_docs: ${dAml.error.message}`);
    else {
      amlDeleted = expiredAmlIds.length;
      await logAudit({
        action: "klient_dokumenty.aml_retention_expired",
        actor_id: null,
        actor_name: "cron/retention",
        target_id: null,
        target_type: "klient_dokument",
        detail: { count: amlDeleted },
        ip_address: undefined,
      });
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    dry_run: false,
    retention_years: years,
    anonymized,
    aml_docs_deleted: amlDeleted,
    errors: errors.length ? errors : undefined,
    ran_at: new Date().toISOString(),
  });
}
