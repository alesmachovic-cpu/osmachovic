import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("user_id");
  // Bez user_id NIČ nevraciame — odberatelia sú per-makler.
  if (!userId) return NextResponse.json([]);
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("odberatelia")
    .select("*")
    .eq("user_id", userId)
    .order("nazov", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });
  const payload = {
    user_id: body.user_id,
    nazov: body.nazov,
    adresa: body.adresa ?? null,
    ico: body.ico ?? null,
    dic: body.dic ?? null,
    ic_dph: body.ic_dph ?? null,
    email: body.email ?? null,
    telefon: body.telefon ?? null,
  };
  if (!payload.nazov) return NextResponse.json({ error: "nazov required" }, { status: 400 });
  const { data, error } = await getSupabaseAdmin().from("odberatelia").insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { data, error } = await getSupabaseAdmin().from("odberatelia").update(rest).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await getSupabaseAdmin().from("odberatelia").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
