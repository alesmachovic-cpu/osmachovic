import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptDocString, decryptDocString, isEncrypted } from "@/lib/cryptoDocs";
import { requireUser } from "@/lib/auth/requireUser";
import { getUserScope, canEditRecord, type UserScope } from "@/lib/scope";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Vlastník dokumentu = klient. Dokument zdieľa company_id/makler_id svojho
 * klienta. Tento helper načíta scope klienta pre autorizáciu.
 *
 * P0 fix 2026-06-03 (F1): pred fixom endpoint nekontroloval company_id ani
 * vlastníka — ktokoľvek prihlásený zavolal ?klientId=<cudzie> a dostal
 * odšifrované OP/LV/AML scany cudzieho klienta (aj inej firmy). Cross-tenant
 * IDOR na najcitlivejšej tabuľke. GDPR čl. 32(1)(b).
 */
async function klientScopeById(
  sb: SupabaseClient,
  klientId: string | null | undefined,
): Promise<{ company_id: string | null; makler_id: string | null } | null> {
  if (!klientId) return null;
  const { data } = await sb
    .from("klienti")
    .select("company_id, makler_id")
    .eq("id", klientId)
    .maybeSingle();
  return (data as { company_id: string | null; makler_id: string | null } | null) ?? null;
}

/** Načíta scope klienta cez dokument (PATCH/DELETE referencujú dokument id). */
async function klientScopeByDoc(
  sb: SupabaseClient,
  docId: string,
): Promise<{ company_id: string | null; makler_id: string | null } | null> {
  const { data: doc } = await sb
    .from("klient_dokumenty")
    .select("klient_id")
    .eq("id", docId)
    .maybeSingle();
  return klientScopeById(sb, (doc as { klient_id?: string } | null)?.klient_id);
}

/** True keď klient patrí do firmy volajúceho (cross-company = false). */
function sameCompany(
  scope: UserScope,
  klient: { company_id: string | null } | null,
): boolean {
  return !!klient && klient.company_id === scope.company_id;
}

/**
 * GET /api/klient-dokumenty?klientId=X
 * Vráti všetky dokumenty klienta, text_content a data_base64 odšifrované.
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const klientId = req.nextUrl.searchParams.get("klientId");
  if (!klientId) return NextResponse.json({ error: "klientId required" }, { status: 400 });

  const sb = getSupabaseAdmin();

  // 🔒 F1: scope — klient musí patriť do firmy volajúceho. Cross-company → 404
  // (nepriznať že záznam existuje v inej firme).
  const scope = await getUserScope(auth.user.id);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });
  const klient = await klientScopeById(sb, klientId);
  if (!sameCompany(scope, klient)) {
    return NextResponse.json({ error: "Klient nenájdený" }, { status: 404 });
  }

  const { data, error } = await sb
    .from("klient_dokumenty")
    .select("*")
    .eq("klient_id", klientId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const decrypted = (data || []).map((d: Record<string, unknown>) => {
    const out: Record<string, unknown> = { ...d };
    try {
      if (isEncrypted(d.data_base64 as string)) {
        out.data_base64 = decryptDocString(d.data_base64 as string);
      }
      if (isEncrypted(d.text_content as string)) {
        out.text_content = decryptDocString(d.text_content as string);
      }
    } catch (e) {
      out._decrypt_error = String(e).slice(0, 200);
    }
    return out;
  });

  // 🔒 F8: forenzný trail prístupu k citlivým PII (dešifrované OP/LV/AML scany).
  // GDPR čl. 5(2) accountability + rozsah pri ohlasovaní porušenia (čl. 33/34).
  // Logujeme len reálny prístup k dokumentom (nie prázdne priečinky).
  if (decrypted.length > 0) {
    await logAudit({
      action: "klient_dokumenty.read",
      actor_id: auth.user.id,
      actor_name: auth.user.name,
      target_id: klientId,
      target_type: "klient",
      detail: { count: decrypted.length },
      ip_address: req.headers.get("x-forwarded-for") || undefined,
    });
  }

  return NextResponse.json({ dokumenty: decrypted });
}

/**
 * POST /api/klient-dokumenty
 * Body: { klient_id, name, type?, size?, source?, mime?, text_content?, data_base64? }
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  const klient_id = body.klient_id as string;
  if (!klient_id) return NextResponse.json({ error: "klient_id required" }, { status: 400 });

  const sb = getSupabaseAdmin();

  // 🔒 F1: dokument sa dá pridať len ku klientovi z vlastnej firmy.
  const scope = await getUserScope(auth.user.id);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });
  const klientOwner = await klientScopeById(sb, klient_id);
  if (!sameCompany(scope, klientOwner)) {
    return NextResponse.json({ error: "Klient nenájdený" }, { status: 404 });
  }

  try {
    const { data: existing } = await sb
      .from("klient_dokumenty")
      .select("id")
      .eq("klient_id", klient_id)
      .eq("name", body.name)
      .eq("size", body.size ?? 0)
      .maybeSingle();
    if (existing?.id) return NextResponse.json({ id: existing.id });
  } catch { /* ignore */ }

  const payload: Record<string, unknown> = {
    klient_id,
    nehnutelnost_id: body.nehnutelnost_id || null,
    name: body.name,
    type: body.type,
    size: body.size ?? 0,
    source: body.source,
    mime: body.mime,
  };

  const MAX_BASE64_BYTES = 5 * 1024 * 1024;
  if (body.data_base64) {
    const b64 = body.data_base64 as string;
    if (b64.length <= MAX_BASE64_BYTES) {
      try {
        payload.data_base64 = encryptDocString(b64);
      } catch (e) {
        return NextResponse.json({ error: `Encryption failed: ${String(e).slice(0, 200)}` }, { status: 500 });
      }
    }
  }
  if (body.text_content) {
    try {
      payload.text_content = encryptDocString(body.text_content as string);
    } catch (e) {
      return NextResponse.json({ error: `Encryption failed: ${String(e).slice(0, 200)}` }, { status: 500 });
    }
  }

  const { data, error } = await sb
    .from("klient_dokumenty")
    .insert(payload)
    .select("id")
    .single();
  if (error) {
    // 🔒 #6 race: unique index (migr. 101) zachytil súbežný duplikát —
    // vráť existujúci záznam namiesto 500, aby paralelný upload nepadol.
    if (error.code === "23505") {
      const { data: dup } = await sb
        .from("klient_dokumenty")
        .select("id")
        .eq("klient_id", klient_id)
        .eq("name", body.name)
        .eq("size", body.size ?? 0)
        .maybeSingle();
      if (dup?.id) return NextResponse.json({ id: dup.id });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await logAudit({
    action: "klient_dokumenty.create",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_id: data?.id,
    target_type: "klient_dokument",
    detail: { klient_id, typ: (payload as { typ?: string }).typ ?? null },
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });
  return NextResponse.json({ id: data?.id });
}

/**
 * PATCH /api/klient-dokumenty
 * Body: { id, nehnutelnost_id? }
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  const id = body.id as string;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const sb = getSupabaseAdmin();

  // 🔒 F1: dokument musí patriť klientovi z vlastnej firmy.
  const scope = await getUserScope(auth.user.id);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });
  const klient = await klientScopeByDoc(sb, id);
  if (!sameCompany(scope, klient)) {
    return NextResponse.json({ error: "Dokument nenájdený" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if ("nehnutelnost_id" in body) patch.nehnutelnost_id = body.nehnutelnost_id || null;
  const { error } = await sb.from("klient_dokumenty").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/klient-dokumenty?id=X
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const sb = getSupabaseAdmin();

  // 🔒 F1: dokument musí patriť klientovi z vlastnej firmy + mazať môže len
  // vlastník/admin/manažér pobočky (mazanie je deštruktívne).
  const scope = await getUserScope(auth.user.id);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });
  const klient = await klientScopeByDoc(sb, id);
  if (!sameCompany(scope, klient)) {
    return NextResponse.json({ error: "Dokument nenájdený" }, { status: 404 });
  }
  if (!(await canEditRecord(scope, klient!.makler_id))) {
    return NextResponse.json({ error: "Nemáš oprávnenie zmazať tento dokument" }, { status: 403 });
  }

  const { error } = await sb.from("klient_dokumenty").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    action: "klient_dokumenty.delete",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_id: id,
    target_type: "klient_dokument",
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });
  return NextResponse.json({ ok: true });
}
