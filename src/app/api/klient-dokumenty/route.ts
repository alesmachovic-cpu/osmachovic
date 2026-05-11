import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { encryptDocString, decryptDocString, isEncrypted } from "@/lib/cryptoDocs";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

/**
 * GET /api/klient-dokumenty?klientId=X
 * Vráti všetky dokumenty klienta, text_content a data_base64 odšifrované.
 */
export async function GET(req: NextRequest) {
  const klientId = req.nextUrl.searchParams.get("klientId");
  if (!klientId) return NextResponse.json({ error: "klientId required" }, { status: 400 });

  const sb = getSupabaseAdmin();
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
    size: body.size,
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
  const { error } = await sb.from("klient_dokumenty").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
