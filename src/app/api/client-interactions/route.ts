import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const klientId = req.nextUrl.searchParams.get("klient_id");
  if (!klientId) return NextResponse.json({ error: "Chýba klient_id" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("client_interactions")
    .select("*")
    .eq("klient_id", klientId)
    .order("occurred_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ interactions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body: { klient_id: string; typ: string; subject?: string; body?: string; occurred_at?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  if (!body.klient_id || !body.typ) {
    return NextResponse.json({ error: "Chýba klient_id alebo typ" }, { status: 400 });
  }

  const VALID_TYPY = ["call", "email", "meeting", "note", "whatsapp", "other"];
  if (!VALID_TYPY.includes(body.typ)) {
    return NextResponse.json({ error: "Neplatný typ" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("client_interactions").insert({
    klient_id: body.klient_id,
    typ: body.typ,
    subject: body.subject ?? null,
    body: body.body ?? null,
    occurred_at: body.occurred_at ?? new Date().toISOString(),
    created_by: auth.user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit log (fire and forget — neblokujeme response)
  void sb.from("audit_log").insert({
    user_id: auth.user.id,
    action: "client_interaction_create",
    entity_type: "klient",
    entity_id: body.klient_id,
    detail: { typ: body.typ, subject: body.subject },
    ip: req.headers.get("x-forwarded-for") ?? "unknown",
    user_agent: req.headers.get("user-agent") ?? "unknown",
  });

  return NextResponse.json({ interaction: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Chýba id" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("client_interactions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
