import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth/requireUser";
import { getUserScope, type UserScope } from "@/lib/scope";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * GDPR súhlasy (F10). Zapája existujúcu tabuľku `consents` (consent ledger).
 *
 * Účel (purpose): typicky "marketing" — core spracovanie predávajúceho/kupujúceho
 * je na základe zmluvy (GDPR čl. 6 ods.1 b), súhlas netreba. Súhlas je relevantný
 * pre marketing voči záujemcom/kupujúcim (čl. 6 ods.1 a) + jeho odvolanie (čl. 7 ods.3).
 *
 * Scope: `consents` nemá company_id → scopujeme cez klient_id → klienti.company_id
 * (rovnaký vzor ako klient-dokumenty).
 */
async function klientCompany(sb: SupabaseClient, klientId: string | null | undefined): Promise<string | null> {
  if (!klientId) return null;
  const { data } = await sb.from("klienti").select("company_id").eq("id", klientId).maybeSingle();
  return (data as { company_id: string | null } | null)?.company_id ?? null;
}
function sameCompany(scope: UserScope, companyId: string | null): boolean {
  return !!companyId && companyId === scope.company_id;
}

/** GET /api/consents?klient_id=X → zoznam súhlasov klienta. */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const klientId = req.nextUrl.searchParams.get("klient_id");
  if (!klientId) return NextResponse.json({ error: "klient_id required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const scope = await getUserScope(auth.user.id);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });
  if (!sameCompany(scope, await klientCompany(sb, klientId))) {
    return NextResponse.json({ error: "Klient nenájdený" }, { status: 404 });
  }

  const { data, error } = await sb
    .from("consents")
    .select("id, purpose, text_version, granted, granted_at, withdrawn_at, source, created_at")
    .eq("klient_id", klientId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ consents: data ?? [] });
}

/**
 * POST /api/consents — udelenie súhlasu.
 * Body: { klient_id, purpose, text_version? }
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  const klientId = String(body.klient_id || "");
  const purpose = String(body.purpose || "").trim();
  if (!klientId || !purpose) return NextResponse.json({ error: "klient_id a purpose required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const scope = await getUserScope(auth.user.id);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });
  if (!sameCompany(scope, await klientCompany(sb, klientId))) {
    return NextResponse.json({ error: "Klient nenájdený" }, { status: 404 });
  }

  const { data, error } = await sb.from("consents").insert({
    klient_id: klientId,
    purpose,
    text_version: (body.text_version as string) || null,
    granted: true,
    granted_at: new Date().toISOString(),
    proof_ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    proof_user_agent: req.headers.get("user-agent"),
    source: (body.source as string) || "crm",
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    action: "consent.granted",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_id: klientId,
    target_type: "klient",
    detail: { purpose, consent_id: data?.id },
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });
  return NextResponse.json({ id: data?.id });
}

/**
 * PATCH /api/consents — odvolanie súhlasu (GDPR čl. 7 ods.3).
 * Body: { id } (id consentu) alebo { klient_id, purpose } (odvolá najnovší daného účelu)
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  const sb = getSupabaseAdmin();
  const scope = await getUserScope(auth.user.id);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });

  // Nájdi cieľový consent (podľa id alebo klient_id+purpose).
  let q = sb.from("consents").select("id, klient_id, purpose").limit(1);
  if (body.id) q = q.eq("id", String(body.id));
  else if (body.klient_id && body.purpose) q = q.eq("klient_id", String(body.klient_id)).eq("purpose", String(body.purpose)).eq("granted", true).order("created_at", { ascending: false });
  else return NextResponse.json({ error: "id alebo (klient_id + purpose) required" }, { status: 400 });
  const { data: target } = await q.maybeSingle();
  if (!target) return NextResponse.json({ error: "Súhlas nenájdený" }, { status: 404 });

  if (!sameCompany(scope, await klientCompany(sb, target.klient_id))) {
    return NextResponse.json({ error: "Súhlas nenájdený" }, { status: 404 });
  }

  const { error } = await sb.from("consents")
    .update({ granted: false, withdrawn_at: new Date().toISOString() })
    .eq("id", target.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    action: "consent.withdrawn",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_id: target.klient_id,
    target_type: "klient",
    detail: { purpose: target.purpose, consent_id: target.id },
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });
  return NextResponse.json({ ok: true });
}
