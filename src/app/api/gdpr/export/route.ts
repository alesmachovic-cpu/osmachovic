import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { getUserScope } from "@/lib/scope";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req, { strict: true });
  if (auth.error) return auth.error;

  // ── F4: Export osobných údajov KLIENTA-SUBJEKTU (GDPR čl. 15 právo na
  // prístup + čl. 20 prenositeľnosť). Keď klient požiada o svoje údaje,
  // exportujeme všetko čo o ňom evidujeme. (Pôvodný export nižšie je export
  // dát makléra — jeho účtu, nie subjektu.)
  const klientId = req.nextUrl.searchParams.get("klient_id");
  if (klientId) {
    const sb = getSupabaseAdmin();
    const scope = await getUserScope(auth.user.id);
    if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });
    const { data: klient } = await sb
      .from("klienti")
      .select("*")
      .eq("id", klientId)
      .eq("company_id", scope.company_id)
      .maybeSingle();
    if (!klient) return NextResponse.json({ error: "Klient nenájdený" }, { status: 404 });

    const [nabery, obhliadky, dokumenty, udalosti, zmluvy, suhlasy] = await Promise.all([
      sb.from("naberove_listy").select("*").eq("klient_id", klientId),
      sb.from("obhliadky").select("*").or(`predavajuci_klient_id.eq.${klientId},kupujuci_klient_id.eq.${klientId}`),
      // dokumenty: len metadata — NIE šifrované bloby (OP/LV scany) v JSON exporte
      sb.from("klient_dokumenty").select("id, name, type, mime, size, created_at").eq("klient_id", klientId),
      sb.from("klient_udalosti").select("*").eq("klient_id", klientId),
      // G1: vyhradne_zmluvy obsahujú rodné číslo + PII vlastníkov — patria do exportu.
      sb.from("vyhradne_zmluvy").select("*").eq("klient_id", klientId),
      sb.from("consents").select("id, purpose, granted, granted_at, withdrawn_at, source, created_at").eq("klient_id", klientId),
    ]);

    await sb.from("audit_log").insert({
      user_id: auth.user.id,
      action: "gdpr_export_subject",
      entity_type: "klient",
      entity_id: klientId,
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      user_agent: req.headers.get("user-agent"),
    }).then(() => null, () => null);

    return NextResponse.json({
      exported_at: new Date().toISOString(),
      subjekt: "klient",
      klient,
      naberove_listy: nabery.data ?? [],
      obhliadky: obhliadky.data ?? [],
      dokumenty: dokumenty.data ?? [],
      udalosti: udalosti.data ?? [],
      vyhradne_zmluvy: zmluvy.data ?? [],
      suhlasy: suhlasy.data ?? [],
      note: "Export osobných údajov dotknutej osoby podľa čl. 15 a 20 GDPR. Skenované dokumenty (OP, LV) sú uvedené len ako zoznam — kópie poskytneme na vyžiadanie.",
    });
  }

  const userId = req.nextUrl.searchParams.get("user_id") || auth.user?.id;
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  // 🚨 Cross-tenant guard: user smie exportovať len SVOJE dáta, prípadne admin
  // smie exportovať dáta usera vo svojej firme.
  if (userId !== auth.user.id) {
    const sbCheck = getSupabaseAdmin();
    const { data: targetUser } = await sbCheck.from("users").select("company_id").eq("id", userId).maybeSingle();
    if (!targetUser) return NextResponse.json({ error: "Užívateľ nenájdený" }, { status: 404 });
    if (targetUser.company_id !== auth.user.company_id && auth.user.role !== "platform_admin") {
      return NextResponse.json({ error: "Užívateľ patrí do inej firmy" }, { status: 403 });
    }
    // Even within company — len admin/manazer môže exportovať CUDZIE dáta.
    if (auth.user.role !== "super_admin" && auth.user.role !== "majitel" && auth.user.role !== "platform_admin") {
      return NextResponse.json({ error: "Cudzí export len admin/majiteľ" }, { status: 403 });
    }
  }

  const sb = getSupabaseAdmin();
  const companyId = auth.user.company_id;

  const [userRes, klientiRes, obhliadkyRes, faktury] = await Promise.all([
    sb.from("users").select("id, name, email, role, created_at").eq("id", userId).eq("company_id", companyId).maybeSingle(),
    sb.from("klienti").select("id, meno, email, telefon, typ, status, created_at").eq("makler_id", userId).eq("company_id", companyId),
    sb.from("obhliadky").select("id, datum, kupujuci_meno, nehnutelnost_id, created_at").eq("makler_id", userId).eq("company_id", companyId),
    sb.from("faktury").select("id, cislo_faktury, suma_celkom, datum_vystavenia, zaplatene").eq("user_id", userId).eq("company_id", companyId),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    user: userRes.data,
    klienti: klientiRes.data ?? [],
    obhliadky: obhliadkyRes.data ?? [],
    faktury: faktury.data ?? [],
    note: "Export podľa čl. 20 GDPR — právo na prenositeľnosť. Niektoré dáta sú vynechané z dôvodu ochrany tretích strán.",
  };

  // Audit log
  await sb.from("audit_log").insert({
    user_id: auth.user?.id,
    action: "gdpr_export",
    entity_type: "user",
    entity_id: userId,
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    user_agent: req.headers.get("user-agent"),
  }).then(() => null, () => null);

  return NextResponse.json(payload);
}
