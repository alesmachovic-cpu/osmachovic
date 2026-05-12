import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const klientId = searchParams.get("klient_id");

  const sb = getSupabaseAdmin();
  let q = sb
    .from("produkcia_objednavky")
    .select("*")
    .order("created_at", { ascending: false });
  if (klientId) q = q.eq("klient_id", klientId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const { klient_id, details, typ = "foto_video" } = body;

  if (!klient_id) return NextResponse.json({ error: "klient_id required" }, { status: 400 });
  if (!details) return NextResponse.json({ error: "details required" }, { status: 400 });

  const sb = getSupabaseAdmin();

  const { data: klient } = await sb
    .from("klienti")
    .select("meno, telefon, lokalita")
    .eq("id", klient_id)
    .maybeSingle();

  const { data, error } = await sb
    .from("produkcia_objednavky")
    .insert({
      klient_id,
      makler_id: auth.user.id,
      typ,
      details,
      snapshot_meno: klient?.meno ?? null,
      snapshot_telefon: klient?.telefon ?? null,
      snapshot_lokalita: klient?.lokalita ?? null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
