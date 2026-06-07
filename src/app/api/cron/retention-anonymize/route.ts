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

  // Kandidáti: bez živého vzťahu (last_engagement_at < cutoff), nie anonymizovaní.
  // last_engagement_at sa resetuje len pri REÁLNEJ interakcii klienta (kontakt,
  // súhlas, obhliadka) — viď src/lib/engagement.ts + retention-policy.md.
  const { data: candidates, error } = await sb
    .from("klienti")
    .select("id, meno, typ, status, last_engagement_at")
    .is("anonymized_at", null)
    .lt("last_engagement_at", cutoff);
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

  // Obhliadky staršie ako RETENTION_YEARS s free-text PII kupujúceho →
  // anonymizovať (vynulovať meno/telefón/email/podpis). Záznam (dátum,
  // nehnuteľnosť) ostáva. FK na klientov rieši anonymizácia klienta vyššie.
  const { data: oldObhliadky } = await sb
    .from("obhliadky")
    .select("id, kupujuci_meno, kupujuci_telefon, kupujuci_email, email_sent_to, podpis_data")
    .lt("created_at", cutoff);
  const obhToAnon = (oldObhliadky ?? []).filter(o =>
    o.kupujuci_meno || o.kupujuci_telefon || o.kupujuci_email || o.email_sent_to || o.podpis_data);

  // F11 (Pravo RoPA 2026-06-07): produkcia_objednavky drží snapshot PII klienta
  // (meno/telefón/lokalita v čase objednávky) → anonymizuj staršie ako retention.
  const { data: oldProdukcia } = await sb
    .from("produkcia_objednavky")
    .select("id, snapshot_meno, snapshot_telefon, snapshot_lokalita")
    .lt("created_at", cutoff);
  const prodToAnon = (oldProdukcia ?? []).filter(p => p.snapshot_meno || p.snapshot_telefon || p.snapshot_lokalita);

  // kolizny_log.poznamka je free-text (môže obsahovať meno/kontakt) → anonymizuj staré.
  const { data: oldKolizie } = await sb
    .from("kolizny_log")
    .select("id, poznamka")
    .lt("created_at", cutoff);
  const kolToAnon = (oldKolizie ?? []).filter(k => k.poznamka);

  if (!enabled) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      retention_years: years,
      candidates_count: toAnon.length,
      aml_docs_expired_count: expiredAmlIds.length,
      obhliadky_anonymize_count: obhToAnon.length,
      produkcia_anonymize_count: prodToAnon.length,
      kolizny_log_anonymize_count: kolToAnon.length,
      candidates: toAnon.map(k => ({ id: k.id, typ: k.typ, status: k.status, last_engagement_at: k.last_engagement_at })),
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
      detail: { retention_years: years, typ: k.typ, last_activity: k.last_engagement_at },
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

  // Anonymizuj staré obhliadky (vynuluj free-text PII kupujúceho).
  let obhAnonymized = 0;
  if (obhToAnon.length) {
    const obhIds = obhToAnon.map(o => o.id);
    const dObh = await sb.from("obhliadky").update({
      kupujuci_meno: null,
      kupujuci_telefon: null,
      kupujuci_email: null,
      email_sent_to: null,
      podpis_data: null,
    }).in("id", obhIds);
    if (dObh.error) errors.push(`obhliadky: ${dObh.error.message}`);
    else {
      obhAnonymized = obhIds.length;
      await logAudit({
        action: "obhliadka.retention_anonymized",
        actor_id: null,
        actor_name: "cron/retention",
        target_id: null,
        target_type: "obhliadka",
        detail: { count: obhAnonymized, retention_years: years },
        ip_address: undefined,
      });
    }
  }

  // Anonymizuj snapshot PII v starých produkcia_objednavky (F11).
  let prodAnonymized = 0;
  if (prodToAnon.length) {
    const prodIds = prodToAnon.map(p => p.id);
    const dProd = await sb.from("produkcia_objednavky").update({
      snapshot_meno: null, snapshot_telefon: null, snapshot_lokalita: null,
    }).in("id", prodIds);
    if (dProd.error) errors.push(`produkcia: ${dProd.error.message}`);
    else {
      prodAnonymized = prodIds.length;
      await logAudit({ action: "produkcia_objednavka.retention_anonymized", actor_id: null, actor_name: "cron/retention", target_id: null, target_type: "produkcia_objednavka", detail: { count: prodAnonymized, retention_years: years }, ip_address: undefined });
    }
  }

  // Anonymizuj free-text poznámku v starých kolizny_log (F11).
  let kolAnonymized = 0;
  if (kolToAnon.length) {
    const kolIds = kolToAnon.map(k => k.id);
    const dKol = await sb.from("kolizny_log").update({ poznamka: null }).in("id", kolIds);
    if (dKol.error) errors.push(`kolizny_log: ${dKol.error.message}`);
    else {
      kolAnonymized = kolIds.length;
      await logAudit({ action: "kolizny_log.retention_anonymized", actor_id: null, actor_name: "cron/retention", target_id: null, target_type: "kolizny_log", detail: { count: kolAnonymized, retention_years: years }, ip_address: undefined });
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    dry_run: false,
    obhliadky_anonymized: obhAnonymized,
    produkcia_anonymized: prodAnonymized,
    kolizny_log_anonymized: kolAnonymized,
    retention_years: years,
    anonymized,
    aml_docs_deleted: amlDeleted,
    errors: errors.length ? errors : undefined,
    ran_at: new Date().toISOString(),
  });
}
