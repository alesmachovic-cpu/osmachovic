import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("prehlad_zaznamy")
    .select("*")
    .order("datum", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const payload = {
    typ: body.typ,
    datum: body.datum || new Date().toISOString().slice(0, 10),
    popis: body.popis ?? null,
    suma: Number(body.suma) || 0,
    zaplatene: !!body.zaplatene,
    kategoria: body.kategoria ?? null,
  };
  if (!payload.typ) return NextResponse.json({ error: "typ required" }, { status: 400 });
  const { data, error } = await getSupabaseAdmin().from("prehlad_zaznamy").insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { data, error } = await getSupabaseAdmin().from("prehlad_zaznamy").update(rest).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // sync s faktúrou
  if (rest.zaplatene !== undefined && data?.faktura_id) {
    await getSupabaseAdmin().from("faktury").update({
      zaplatene: rest.zaplatene,
      datum_uhrady: rest.zaplatene ? new Date().toISOString().slice(0, 10) : null,
    }).eq("id", data.faktura_id);
  }
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await getSupabaseAdmin().from("prehlad_zaznamy").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
