import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

const VALID_PORTALS = new Set(["nehnutelnosti.sk", "reality.sk", "bazos.sk", "byty.sk", "topreality.sk", "vsetky"]);
const VALID_TYP = new Set(["byt", "dom", "rodinny_dom", "pozemok", "chata", "komercna", "garaz", "vsetky", null, ""]);

interface FilterPayload {
  nazov?: string;
  portal?: string;
  typ?: string | null;
  lokalita?: string | null;
  cena_od?: number | null;
  cena_do?: number | null;
  plocha_od?: number | null;
  plocha_do?: number | null;
  izby_od?: number | null;
  izby_do?: number | null;
  klucove_slova?: string | null;
  search_url?: string | null;
  notify_email?: boolean;
  notify_telegram?: boolean;
  len_sukromni?: boolean;
  is_active?: boolean;
  makler_id?: string | null;
  id?: string;
}

/** Whitelist validation pre filter payload — zabraňuje injection do enum colu. */
function validateFilterPayload(body: FilterPayload): string | null {
  if (body.nazov !== undefined && (typeof body.nazov !== "string" || body.nazov.length > 200)) {
    return "Neplatný 'nazov' (max 200 znakov)";
  }
  if (body.portal !== undefined && !VALID_PORTALS.has(body.portal)) {
    return `Neplatný 'portal' — akceptujem: ${[...VALID_PORTALS].join(", ")}`;
  }
  if (body.typ !== undefined && body.typ !== null && !VALID_TYP.has(body.typ)) {
    return `Neplatný 'typ' — akceptujem: byt, dom, pozemok, ...`;
  }
  for (const numField of ["cena_od", "cena_do", "plocha_od", "plocha_do", "izby_od", "izby_do"] as const) {
    const v = body[numField];
    if (v !== undefined && v !== null && (typeof v !== "number" || v < 0 || v > 1_000_000_000)) {
      return `Neplatná hodnota '${numField}'`;
    }
  }
  return null;
}

/** GET /api/monitor/filtre — zoznam filtrov (vyžaduje session). */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const sb = getSupabaseAdmin();

  const { data, error } = await sb
    .from("monitor_filtre")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ filtre: data || [] });
}

/** POST /api/monitor/filtre — vytvor nový filter (vyžaduje session). */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  let body: FilterPayload;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  const validationError = validateFilterPayload(body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const sb = getSupabaseAdmin();
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
      // makler_id berie zo session, nie z body (zabráni cudzí maklér priradiť svoj filter inému)
      makler_id: auth.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ filter: data });
}

/** PUT /api/monitor/filtre — aktualizuj filter (len vlastný, super_admin smie všetko). */
export async function PUT(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  let body: FilterPayload;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  if (!body.id) return NextResponse.json({ error: "Missing filter id" }, { status: 400 });

  const validationError = validateFilterPayload(body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const sb = getSupabaseAdmin();
  // Ownership check pre nepriviligovaných userov
  if (auth.user.role !== "super_admin" && auth.user.role !== "majitel") {
    const { data: existing } = await sb.from("monitor_filtre").select("makler_id").eq("id", body.id).maybeSingle();
    if (existing && existing.makler_id && existing.makler_id !== auth.user.id) {
      return NextResponse.json({ error: "Filter patrí inému maklérovi" }, { status: 403 });
    }
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ filter: data });
}

/** DELETE /api/monitor/filtre — vymaž filter (len vlastný, super_admin smie všetko). */
export async function DELETE(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing filter id" }, { status: 400 });

  const sb = getSupabaseAdmin();
  // Ownership check
  if (auth.user.role !== "super_admin" && auth.user.role !== "majitel") {
    const { data: existing } = await sb.from("monitor_filtre").select("makler_id").eq("id", id).maybeSingle();
    if (existing && existing.makler_id && existing.makler_id !== auth.user.id) {
      return NextResponse.json({ error: "Filter patrí inému maklérovi" }, { status: 403 });
    }
  }

  const { error } = await sb.from("monitor_filtre").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
