import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { searchParams } = req.nextUrl;
  const id = searchParams.get("id");
  const klientId = searchParams.get("klient_id");
  const naberId = searchParams.get("naber_id");

  const sb = getSupabaseAdmin();
  if (id) {
    const { data, error } = await sb.from("vyhradne_zmluvy").select("*").eq("id", id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Nenájdená" }, { status: 404 });
    return NextResponse.json(data);
  }
  if (klientId) {
    const { data, error } = await sb.from("vyhradne_zmluvy").select("*").eq("klient_id", klientId).order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }
  if (naberId) {
    const { data, error } = await sb.from("vyhradne_zmluvy").select("*").eq("naber_id", naberId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? null);
  }
  return NextResponse.json({ error: "Chýba id, klient_id alebo naber_id" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const { data, error } = await getSupabaseAdmin()
    .from("vyhradne_zmluvy")
    .insert({ ...body, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    action: "vyhradna_zmluva.create",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_id: data.id,
    target_type: "vyhradna_zmluva",
    detail: { klient_id: body.klient_id ?? null, naber_id: body.naber_id ?? null },
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { data, error } = await getSupabaseAdmin()
    .from("vyhradne_zmluvy")
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    action: "vyhradna_zmluva.update",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_id: id,
    target_type: "vyhradna_zmluva",
    detail: { fields_changed: Object.keys(rest) },
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });
  return NextResponse.json(data);
}
