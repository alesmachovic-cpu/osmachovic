import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

/** PATCH /api/obchody/[id] — aktualizácia obchodu (status, fakty, poznámky) */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  const ALLOWED = ["status", "cena", "provizia", "kupujuci_meno", "notar", "banka", "poznamky", "nehnutelnost_id"];
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ALLOWED) {
    if (k in body) patch[k] = body[k];
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("obchody")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ obchod: data });
}

/** DELETE /api/obchody/[id] — zmazanie obchodu (kaskádovo aj úlohy) */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { id } = await params;

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("obchody").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
