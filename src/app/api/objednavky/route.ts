import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const klientId = searchParams.get("klient_id");
  const sb = getSupabaseAdmin();
  let q = sb.from("objednavky").select("*").order("created_at", { ascending: false });
  if (klientId) q = q.eq("klient_id", klientId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  if (!body.klient_id) return NextResponse.json({ error: "klient_id required" }, { status: 400 });
  if (!body.druh) return NextResponse.json({ error: "druh required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("objednavky").insert(body).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("objednavky").update(rest).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("objednavky").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
