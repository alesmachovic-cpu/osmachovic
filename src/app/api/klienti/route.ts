import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getUserScope, canEditRecord } from "@/lib/scope";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/requireUser";
import { sanitizeFields, SANITIZE_FIELDS } from "@/lib/sanitize";
import { requireReAuth } from "@/lib/auth/reAuth";
import { touchEngagement } from "@/lib/engagement";

export const runtime = "nodejs";

// GET /api/klienti
//   ?id=X       → single klient by UUID
//   ?telefon=X  → search by phone (ilike, limit 1)
//   ?q=X        → search by meno (ilike, limit 8)
//   (nič)       → všetci
export async function GET(req: NextRequest) {
  // P0 fix 2026-05-24: strict auth — pred fixom VIANEMA fallback servíroval
  // všetkých 60+ klientov (PII, GDPR) komukoľvek bez session.
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const sb = getSupabaseAdmin();
  const params = new URL(req.url).searchParams;
  const id = params.get("id");
  const telefon = params.get("telefon");
  const q = params.get("q");

  const scope = await getUserScope(auth.user.id);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });
  const companyId = scope.company_id;

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
  // P0 fix 2026-06-02: strict auth — predtým endpoint trustol body.user_id,
  // ktorý umožňoval IDOR (útočník mohol vydávať sa za iného usera).
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const sb = getSupabaseAdmin();
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  // user_id z body musí matchovať session (alebo caller je admin pre delegate)
  const bodyUserId = String(body.user_id || "");
  const userId = bodyUserId || auth.user.id;
  if (bodyUserId && bodyUserId !== auth.user.id && auth.user.role !== "platform_admin" && auth.user.role !== "super_admin") {
    return NextResponse.json({ error: "Nemôžeš vytvoriť klienta v mene iného usera" }, { status: 403 });
  }

  const scope = await getUserScope(userId);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });

  const { user_id: _u, makler_id: bodyMakler, odporucil_klient_id: bodyOdporucil, ...rest } = body;
  const makler_id = scope.isAdmin && bodyMakler ? String(bodyMakler) : scope.makler_id;
  if (!makler_id) {
    return NextResponse.json({ error: "Užívateľ nemá priradeného makléra" }, { status: 400 });
  }

  // Odporúčanie: nový klient naviazaný na existujúceho, ktorý ho odporučil.
  // Over že odporúčajúci patrí do tej istej firmy (žiadne cross-tenant prepojenie).
  let validReferrer: string | null = null;
  if (bodyOdporucil) {
    const { data: ref } = await sb.from("klienti").select("id, company_id").eq("id", String(bodyOdporucil)).maybeSingle();
    if (ref && ref.company_id === scope.company_id) validReferrer = ref.id;
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
    odporucil_klient_id: validReferrer,
  };
  const { data, error } = await sb.from("klienti").insert(payload).select().single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Klient s týmto telefónom už existuje", code: "DUPLICATE_PHONE" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }

  // Odporúčajúci klient = aktívny živý vzťah → reset retention lehoty (F11)
  // + záznam do jeho histórie.
  if (validReferrer) {
    await touchEngagement(validReferrer);
    await sb.from("klient_udalosti").insert({
      klient_id: validReferrer,
      typ: "ine",
      popis: `Dal odporúčanie — nový klient: ${typeof data.meno === "string" ? data.meno : data.id}`,
      autor: auth.user.name || null,
      company_id: scope.company_id,
    });
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
  // P0 fix 2026-05-24: niektoré UI flow posielajú id v query stringu (?id=...),
  // nie v body. Accept oboje aby sa nedalo zlyhať na "id required" 400.
  const idFromQuery = new URL(req.url).searchParams.get("id");
  const id = String(body.id || idFromQuery || "");
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
  if (error) {
    // P0 fix 2026-05-24a: schema cache miss → 400 namiesto 500.
    if (error.code === "PGRST204" || /column|schema cache/i.test(error.message)) {
      console.warn("[/api/klienti PATCH] schema mismatch:", {
        attempted_fields: Object.keys(patch),
        supabase_error: error.message,
      });
      return NextResponse.json({
        error: `Niektoré polia neexistujú v klienti schéme (${error.message}). UI bug — refresh stránku alebo pošli sken Network tabu.`,
        code: "SCHEMA_MISMATCH",
      }, { status: 400 });
    }
    // P0 fix 2026-05-24b: DB check constraint violation (napr. invalid status) → 400.
    if (error.code === "23514") {
      console.warn("[/api/klienti PATCH] constraint violation:", {
        attempted_fields: Object.keys(patch),
        supabase_error: error.message,
      });
      return NextResponse.json({
        error: `Neplatná hodnota poľa (${error.message})`,
        code: "INVALID_VALUE",
      }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
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
