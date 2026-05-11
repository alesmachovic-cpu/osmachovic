import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const FIELDS = [
  "nazov", "adresa", "ico", "dic", "ic_dph",
  "iban", "banka", "swift", "obch_register", "konst_symbol",
  "email", "telefon", "splatnost_dni", "uvodny_text", "poznamka_default", "vystavil",
] as const;

function pickFields(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of FIELDS) {
    if (k in input) out[k] = input[k];
  }
  return out;
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("makler_dodavatel")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || null);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const userId = body?.user_id;
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const payload = { user_id: userId, ...pickFields(body) };
  const { data, error } = await sb
    .from("makler_dodavatel")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
