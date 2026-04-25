import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * GET /api/obhliadky
 *   ?klient_id=X    → obhliadky kde X je predávajúci ALEBO kupujúci
 *   ?nehnutelnost_id=X → obhliadky pre konkrétny inzerát
 *   bez parametrov → všetky obhliadky (admin)
 */
export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const klientId = req.nextUrl.searchParams.get("klient_id");
  const nehnId = req.nextUrl.searchParams.get("nehnutelnost_id");

  let q = sb.from("obhliadky").select("*").order("datum", { ascending: false });
  if (klientId) {
    q = q.or(`predavajuci_klient_id.eq.${klientId},kupujuci_klient_id.eq.${klientId}`);
  }
  if (nehnId) q = q.eq("nehnutelnost_id", nehnId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ obhliadky: data || [] });
}

/**
 * POST /api/obhliadky
 * Body:
 *  {
 *    predavajuci_klient_id, nehnutelnost_id,
 *    kupujuci_klient_id?, kupujuci_meno?, kupujuci_telefon?, kupujuci_email?,
 *    makler_id?, datum, miesto?, poznamka?, calendar_event_id?
 *  }
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  if (!body.datum) return NextResponse.json({ error: "datum required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const payload: Record<string, unknown> = {
    predavajuci_klient_id: body.predavajuci_klient_id || null,
    nehnutelnost_id: body.nehnutelnost_id || null,
    kupujuci_klient_id: body.kupujuci_klient_id || null,
    kupujuci_meno: body.kupujuci_meno || null,
    kupujuci_telefon: body.kupujuci_telefon || null,
    kupujuci_email: body.kupujuci_email || null,
    makler_id: body.makler_id || null,
    datum: body.datum,
    miesto: body.miesto || null,
    poznamka: body.poznamka || null,
    status: body.status || "planovana",
    calendar_event_id: body.calendar_event_id || null,
  };
  const { data, error } = await sb.from("obhliadky").insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ obhliadka: data });
}

/**
 * PATCH /api/obhliadky
 * Body: { id, ...fields }
 *   – update pre status, podpis, email, poznámka
 */
export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  const id = body.id as string;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const allowed = [
    "status","miesto","poznamka","datum",
    "kupujuci_klient_id","kupujuci_meno","kupujuci_telefon","kupujuci_email",
    "podpis_data","podpis_datum",
    "list_pdf_base64","email_sent_at","email_sent_to",
    "calendar_event_id","makler_id","nehnutelnost_id",
  ];
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) if (k in body) patch[k] = body[k];

  const { data, error } = await sb.from("obhliadky").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ obhliadka: data });
}

/**
 * DELETE /api/obhliadky?id=X
 */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("obhliadky").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
