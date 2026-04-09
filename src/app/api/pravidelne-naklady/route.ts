import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("pravidelne_naklady")
    .select("*")
    .order("den_splatnosti", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.nazov) return NextResponse.json({ error: "nazov required" }, { status: 400 });
  const { data, error } = await supabase.from("pravidelne_naklady").insert({
    nazov: body.nazov,
    suma: Number(body.suma) || 0,
    den_splatnosti: Number(body.den_splatnosti) || 1,
    kategoria: body.kategoria ?? null,
    aktivny: body.aktivny ?? true,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (rest.suma !== undefined) rest.suma = Number(rest.suma);
  if (rest.den_splatnosti !== undefined) rest.den_splatnosti = Number(rest.den_splatnosti);
  const { data, error } = await supabase.from("pravidelne_naklady").update(rest).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabase.from("pravidelne_naklady").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
