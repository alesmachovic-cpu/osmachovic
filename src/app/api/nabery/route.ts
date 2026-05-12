import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getUserScope, canEditRecord, canEditNaber } from "@/lib/scope";
import { requireUser, readSessionUserId } from "@/lib/auth/requireUser";
import { VIANEMA_COMPANY_ID } from "@/lib/auth/companyScope";

export const runtime = "nodejs";

/**
 * GET /api/nabery — list naberove_listy
 */
export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const klientId = req.nextUrl.searchParams.get("klient_id");
  const mine = req.nextUrl.searchParams.get("mine") === "1";
  const dnes = req.nextUrl.searchParams.get("dnes") === "1";

  const sessionUserId = readSessionUserId(req);
  let companyId = VIANEMA_COMPANY_ID;
  let maklerUuid: string | null = null;
  if (sessionUserId) {
    const scope = await getUserScope(sessionUserId);
    if (scope) {
      companyId = scope.company_id;
      if (mine) maklerUuid = scope.makler_id ?? null;
    }
  }

  let query = sb.from("naberove_listy").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  if (klientId) query = query.eq("klient_id", klientId);
  if (maklerUuid) query = query.eq("makler_id", maklerUuid);
  if (dnes) {
    const today = new Date().toISOString().slice(0, 10);
    query = query.gte("created_at", today + "T00:00:00").lte("created_at", today + "T23:59:59");
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/**
 * POST /api/nabery
 * Body: { user_id, klient_id, ...naber_fields }
 *
 * Náberový list môže vytvoriť len maklér ktorý vlastní klienta. Manažér z
 * pobočky vlastníka a admin/majiteľ môžu tiež. makler v zázname sa odvodí
 * automaticky z klienta (= vlastník klienta), nie z volajúceho.
 */
export async function POST(req: NextRequest) {
  const sb = getSupabaseAdmin();
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  const userId = String(body.user_id || "");
  const klientId = body.klient_id ? String(body.klient_id) : null;
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const scope = await getUserScope(userId);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });

  // Vlastník klienta určuje kto je vlastníkom náberu
  let ownerMakler: string | null = scope.makler_id;
  if (klientId) {
    const { data: k } = await sb.from("klienti").select("makler_id, meno").eq("id", klientId).single();
    if (!k) return NextResponse.json({ error: "Klient nenájdený" }, { status: 404 });
    const allowed = await canEditRecord(scope, k.makler_id);
    if (!allowed) return NextResponse.json({ error: "Tento klient ti nepatrí — nemôžeš mu spraviť náberový list" }, { status: 403 });
    ownerMakler = (k.makler_id as string | null) ?? scope.makler_id;
  }

  const { user_id: _u, ...rest } = body;
  const payload: Record<string, unknown> = {
    ...rest,
    klient_id: klientId,
    company_id: scope.company_id,
    makler: rest.makler ?? null,
  };
  // makler text stĺpec (legacy) — vyplň ak chýba
  if (!payload.makler) {
    const { data: u } = await sb.from("users").select("name").eq("id", userId).single();
    if (u?.name) payload.makler = String(u.name);
  }

  const { data, error } = await sb.from("naberove_listy").insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ naber: data, owner_makler_id: ownerMakler });
}

/**
 * PATCH /api/nabery
 * Body: { user_id, id, ...fields }
 *
 * Po podpise (podpis_data je vyplnené) je náber uzamknutý — nedá sa editovať
 * ani vlastníkom, ani adminom (zachováva integritu podpísaného dokumentu).
 * Výnimka: ak body explicitne posiela podpis_data (akcia "podpísať"), nezáleží
 * na tom čo bolo predtým — povolí.
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
    .from("naberove_listy")
    .select("id, klient_id, podpis_data")
    .eq("id", id)
    .single();
  if (!existing) return NextResponse.json({ error: "Náber nenájdený" }, { status: 404 });

  // Vlastníctvo cez klienta
  let ownerMakler: string | null = null;
  if (existing.klient_id) {
    const { data: k } = await sb.from("klienti").select("makler_id").eq("id", existing.klient_id).single();
    ownerMakler = (k?.makler_id as string | null) ?? null;
  }

  const isSigning = !!body.podpis_data && !existing.podpis_data;
  if (!isSigning) {
    const check = await canEditNaber(scope, { makler_id: ownerMakler, podpis_data: existing.podpis_data as string | null });
    if (!check.allowed) return NextResponse.json({ error: check.reason }, { status: 403 });
  } else {
    // Podpisovať môže len ten kto má normálne edit rights
    const allowed = await canEditRecord(scope, ownerMakler);
    if (!allowed) return NextResponse.json({ error: "Nemáš oprávnenie podpísať tento náber" }, { status: 403 });
  }

  const { user_id: _u, id: _id, ...rest } = body;
  const { data, error } = await sb.from("naberove_listy").update(rest).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ naber: data });
}

/**
 * DELETE /api/nabery?id=X&user_id=Y
 *
 * Vlastník môže zmazať len NEPODPÍSANÝ náber. Podpísané môže zmazať len
 * admin/majiteľ (a aj to len v krajnom prípade — audit_log).
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

  const { data: existing } = await sb
    .from("naberove_listy")
    .select("id, klient_id, podpis_data")
    .eq("id", id)
    .single();
  if (!existing) return NextResponse.json({ error: "Náber nenájdený" }, { status: 404 });

  let ownerMakler: string | null = null;
  if (existing.klient_id) {
    const { data: k } = await sb.from("klienti").select("makler_id").eq("id", existing.klient_id).single();
    ownerMakler = (k?.makler_id as string | null) ?? null;
  }

  if (existing.podpis_data) {
    if (!scope.isAdmin) return NextResponse.json({ error: "Podpísaný náber môže zmazať len admin/majiteľ" }, { status: 403 });
  } else {
    const allowed = await canEditRecord(scope, ownerMakler);
    if (!allowed) return NextResponse.json({ error: "Nemáš oprávnenie zmazať tento náber" }, { status: 403 });
  }

  const { error } = await sb.from("naberove_listy").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
