import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const klientId = req.nextUrl.searchParams.get("klient_id");
  if (!klientId) return NextResponse.json({ error: "klient_id required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("klient_udalosti")
    .select("*")
    .eq("klient_id", klientId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const { klient_id, typ, popis, autor } = body;

  if (!klient_id) return NextResponse.json({ error: "klient_id required" }, { status: 400 });
  if (!typ) return NextResponse.json({ error: "typ required" }, { status: 400 });
  if (!popis?.trim()) return NextResponse.json({ error: "popis required" }, { status: 400 });

  const TYPY = ["hovor", "poznamka", "stretnutie", "email", "status_zmena", "ine"];
  if (!TYPY.includes(typ)) return NextResponse.json({ error: "neplatný typ" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("klient_udalosti")
    .insert({ klient_id, typ, popis: popis.trim(), autor: autor || null, company_id: auth.user.company_id })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    action: "klient_udalost.create",
    actor_id: auth.user.id, actor_name: auth.user.name,
    target_id: data.id, target_type: "klient_udalost",
    detail: { klient_id, typ },
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("klient_udalosti").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    action: "klient_udalost.delete",
    actor_id: auth.user.id, actor_name: auth.user.name,
    target_id: id, target_type: "klient_udalost",
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });
  return NextResponse.json({ ok: true });
}
