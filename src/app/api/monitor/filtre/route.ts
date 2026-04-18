import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/** GET /api/monitor/filtre — zoznam filtrov */
export async function GET() {
  const sb = getSupabaseAdmin();

  const { data, error } = await sb
    .from("monitor_filtre")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ filtre: data || [] });
}

/** POST /api/monitor/filtre — vytvor nový filter */
export async function POST(request: Request) {
  const sb = getSupabaseAdmin();
  const body = await request.json();

  const { data, error } = await sb
    .from("monitor_filtre")
    .insert({
      nazov: body.nazov,
      portal: body.portal || "nehnutelnosti.sk",
      typ: body.typ || null,
      lokalita: body.lokalita || null,
      cena_od: body.cena_od || null,
      cena_do: body.cena_do || null,
      plocha_od: body.plocha_od || null,
      plocha_do: body.plocha_do || null,
      izby_od: body.izby_od || null,
      izby_do: body.izby_do || null,
      klucove_slova: body.klucove_slova || null,
      search_url: body.search_url || null,
      notify_email: body.notify_email ?? true,
      notify_telegram: body.notify_telegram ?? false,
      len_sukromni: body.len_sukromni ?? true,
      is_active: true,
      makler_id: body.makler_id || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ filter: data });
}

/** PUT /api/monitor/filtre — aktualizuj filter */
export async function PUT(request: Request) {
  const sb = getSupabaseAdmin();
  const body = await request.json();

  if (!body.id) {
    return NextResponse.json({ error: "Missing filter id" }, { status: 400 });
  }

  const { data, error } = await sb
    .from("monitor_filtre")
    .update({
      nazov: body.nazov,
      portal: body.portal,
      typ: body.typ,
      lokalita: body.lokalita,
      cena_od: body.cena_od,
      cena_do: body.cena_do,
      plocha_od: body.plocha_od,
      plocha_do: body.plocha_do,
      izby_od: body.izby_od,
      izby_do: body.izby_do,
      klucove_slova: body.klucove_slova,
      search_url: body.search_url,
      notify_email: body.notify_email,
      notify_telegram: body.notify_telegram,
      len_sukromni: body.len_sukromni,
      is_active: body.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ filter: data });
}

/** DELETE /api/monitor/filtre — vymaž filter */
export async function DELETE(request: Request) {
  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing filter id" }, { status: 400 });
  }

  const { error } = await sb.from("monitor_filtre").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
