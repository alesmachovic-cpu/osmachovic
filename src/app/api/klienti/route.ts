import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getUserScope, canEditRecord } from "@/lib/scope";
import { logAudit } from "@/lib/audit";
import { requireUser, readSessionUserId } from "@/lib/auth/requireUser";
import { VIANEMA_COMPANY_ID } from "@/lib/auth/companyScope";
import { sanitizeFields, SANITIZE_FIELDS } from "@/lib/sanitize";
import { requireReAuth } from "@/lib/auth/reAuth";

export const runtime = "nodejs";

// GET /api/klienti
//   ?id=X       → single klient by UUID
//   ?telefon=X  → search by phone (ilike, limit 1)
//   ?q=X        → search by meno (ilike, limit 8)
//   (nič)       → všetci
export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const params = new URL(req.url).searchParams;
  const id = params.get("id");
  const telefon = params.get("telefon");
  const q = params.get("q");

  // Zisti company_id zo session (fallback = Vianema pre backward compat)
  const sessionUserId = readSessionUserId(req);
  let companyId = VIANEMA_COMPANY_ID;
  if (sessionUserId) {
    const scope = await getUserScope(sessionUserId);
    if (scope) companyId = scope.company_id;
  }

  if (id) {
    const { data, error } = await sb.from("klienti").select("*").eq("id", id).eq("company_id", companyId).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Dopytaj meno makléra ktorý klienta založil (pre UI "Založil: X")
    if (data && data.created_by_makler_id) {
      const { data: m } = await sb.from("makleri").select("meno").eq("id", data.created_by_makler_id).maybeSingle();
      (data as Record<string, unknown>).created_by_makler_meno = m?.meno ?? null;
    }
    return NextResponse.json({ klient: data });
  }
  if (telefon) {
    const last9 = telefon.replace(/\D/g, "").slice(-9);
    const { data, error } = await sb.from("klienti").select("*").ilike("telefon", `%${last9}%`).eq("company_id", companyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Spätná kompatibilita: `klient` = prvý match (single), `klienti` = celé pole.
    return NextResponse.json({ klient: data?.[0] ?? null, klienti: data ?? [] });
  }
  if (q) {
    const { data, error } = await sb.from("klienti").select("id, meno, telefon, email").ilike("meno", `%${q}%`).eq("company_id", companyId).limit(8);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }
  const { data, error } = await sb.from("klienti").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/**
 * POST /api/klienti
 * Body: { user_id, ...klient_fields }
 *
 * makler_id sa NIKDY nečíta z body pre bežného maklera — vždy sa vyplní zo
 * scope (user.makler_id). Pre admin/majiteľa môže body explicitne určiť
 * iného vlastníka (delegate).
 */
export async function POST(req: NextRequest) {
  const sb = getSupabaseAdmin();
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  const userId = String(body.user_id || "");
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const scope = await getUserScope(userId);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });

  const { user_id: _u, makler_id: bodyMakler, ...rest } = body;
  const makler_id = scope.isAdmin && bodyMakler ? String(bodyMakler) : scope.makler_id;
  if (!makler_id) {
    return NextResponse.json({ error: "Užívateľ nemá priradeného makléra" }, { status: 400 });
  }

  // C4: XSS sanitize free-form text fields (poznamka, meno, lokalita, ...)
  const cleanRest = sanitizeFields(rest as Record<string, unknown>, [...SANITIZE_FIELDS]);
  // created_by_makler_id = pôvodný autor klienta (immutable). Pre kupujúcich
  // slúži ako "tento klient je môj kontakt" indikátor aj keď ho môže editovať
  // hocikto. Pre predávajúcich je to dodatočný signál koho oslobiť.
  const payload = {
    ...cleanRest,
    makler_id,
    created_by_makler_id: makler_id,
    company_id: scope.company_id,
  };
  const { data, error } = await sb.from("klienti").insert(payload).select().single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Klient s týmto telefónom už existuje", code: "DUPLICATE_PHONE" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }
  await logAudit({
    action: "klient.create",
    actor_id: userId,
    target_id: data.id,
    target_type: "klient",
    target_name: typeof data.meno === "string" ? data.meno : undefined,
    detail: { makler_id, company_id: scope.company_id },
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });
  return NextResponse.json({ klient: data });
}

/**
 * PATCH /api/klienti
 * Body: { user_id, id, ...fields }
 *
 * Overuje vlastníctvo cez canEditRecord. Bežný makler môže updatovať len
 * svojich klientov; admin/majiteľ všetkých; manažér tých z jeho pobočky.
 *
 * makler_id v body je ignorované pokiaľ caller nie je admin (zabráni tichej
 * impersonácii — predtým ktokoľvek mohol cez direct supabase prepísať
 * makler_id na cudzieho).
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req, { strict: true });
  if (auth.error) return auth.error;

  const sb = getSupabaseAdmin();
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  const userId = auth.user.id;
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const scope = await getUserScope(userId);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });

  const { data: existing } = await sb
    .from("klienti")
    .select("id, makler_id, anonymized_at")
    .eq("id", id)
    .single();
  if (!existing) return NextResponse.json({ error: "Klient nenájdený" }, { status: 404 });
  if (existing.anonymized_at) {
    return NextResponse.json({ error: "Klient je anonymizovaný (GDPR)" }, { status: 410 });
  }

  const allowed = await canEditRecord(scope, existing.makler_id);
  if (!allowed) return NextResponse.json({ error: "Nemáš oprávnenie editovať tohto klienta" }, { status: 403 });

  const { user_id: _u, id: _id, makler_id: bodyMakler, ...rest } = body;
  // C4: XSS sanitize free-form text fields
  const cleanRest = sanitizeFields(rest as Record<string, unknown>, [...SANITIZE_FIELDS]);
  const patch: Record<string, unknown> = { ...cleanRest };
  if (scope.isAdmin && bodyMakler) patch.makler_id = bodyMakler; // delegate

  const { data, error } = await sb.from("klienti").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    action: "klient.update",
    actor_id: userId,
    target_id: id,
    target_type: "klient",
    target_name: typeof data.meno === "string" ? data.meno : undefined,
    detail: { fields_changed: Object.keys(patch) },
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });
  return NextResponse.json({ klient: data });
}

/**
 * DELETE /api/klienti?id=X&user_id=Y
 *
 * Reálne mazanie len pre admin/majiteľa. Bežný makler dostane 403 — má
 * použiť anonymize/uvoľniť (existing /api/klienti/anonymize).
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req, { strict: true });
  if (auth.error) return auth.error;

  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const userId = auth.user.id;

  const scope = await getUserScope(userId);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });
  if (!scope.isAdmin) {
    return NextResponse.json({ error: "Reálne mazanie len pre admin/majiteľa. Použi anonymize." }, { status: 403 });
  }

  // 🔒 M1 force re-auth — klient.delete je irreverzibilné.
  // confirm_password / confirm_code v query string (lebo DELETE nemá body convention).
  const reAuth = await requireReAuth({
    userId,
    password: searchParams.get("confirm_password") || undefined,
    code: searchParams.get("confirm_code") || undefined,
  });
  if (!reAuth.ok) {
    return NextResponse.json({
      error: reAuth.error,
      code: "RE_AUTH_REQUIRED",
    }, { status: reAuth.status });
  }

  const { error } = await sb.from("klienti").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ action: "klient.delete", actor_id: userId, target_id: id, target_type: "klient", ip_address: req.headers.get("x-forwarded-for") || undefined });
  return NextResponse.json({ ok: true });
}
