import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getUserScope, canEditRecord } from "@/lib/scope";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/requireUser";

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
  if (id) {
    const { data, error } = await sb.from("klienti").select("*").eq("id", id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ klient: data });
  }
  if (telefon) {
    const last9 = telefon.replace(/\D/g, "").slice(-9);
    const { data, error } = await sb.from("klienti").select("*").ilike("telefon", `%${last9}%`).limit(1).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ klient: data });
  }
  if (q) {
    const { data, error } = await sb.from("klienti").select("id, meno, telefon, email").ilike("meno", `%${q}%`).limit(8);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }
  const { data, error } = await sb.from("klienti").select("*").order("created_at", { ascending: false });
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

  const payload = { ...rest, makler_id };
  const { data, error } = await sb.from("klienti").insert(payload).select().single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Klient s týmto telefónom už existuje", code: "DUPLICATE_PHONE" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }
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
  const patch: Record<string, unknown> = { ...rest };
  if (scope.isAdmin && bodyMakler) patch.makler_id = bodyMakler; // delegate

  const { data, error } = await sb.from("klienti").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

  const { error } = await sb.from("klienti").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ action: "klient.delete", actor_id: userId, target_id: id, target_type: "klient", ip_address: req.headers.get("x-forwarded-for") || undefined });
  return NextResponse.json({ ok: true });
}
