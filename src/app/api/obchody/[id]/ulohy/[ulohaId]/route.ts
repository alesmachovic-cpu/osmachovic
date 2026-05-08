import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { computeObchodStatus } from "@/lib/obchodStatus";

export const runtime = "nodejs";

/** PATCH /api/obchody/[id]/ulohy/[ulohaId] — toggle done, edit polia, nastav drive_link */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ulohaId: string }> },
) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { id: obchodId, ulohaId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  const ALLOWED = ["done", "nazov", "popis", "priorita", "deadline", "drive_link", "calendar_event_id"];
  const patch: Record<string, unknown> = {};
  for (const k of ALLOWED) {
    if (k in body) patch[k] = body[k];
  }

  if ("done" in patch) {
    patch.done_at = patch.done ? new Date().toISOString() : null;
  }

  const sb = getSupabaseAdmin();
  const { data: uloha, error: ulohaErr } = await sb
    .from("obchod_ulohy")
    .update(patch)
    .eq("id", ulohaId)
    .eq("obchod_id", obchodId)
    .select()
    .single();

  if (ulohaErr) return NextResponse.json({ error: ulohaErr.message }, { status: 500 });

  // Auto-prepočet statusu obchodu
  if ("done" in patch) {
    const { data: allUlohy } = await sb
      .from("obchod_ulohy")
      .select("kategoria, nazov, done")
      .eq("obchod_id", obchodId);

    if (allUlohy) {
      const newStatus = computeObchodStatus(allUlohy);
      await sb
        .from("obchody")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", obchodId);
    }
  }

  return NextResponse.json({ uloha });
}

/** DELETE /api/obchody/[id]/ulohy/[ulohaId] — zmazanie úlohy */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ulohaId: string }> },
) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { id: obchodId, ulohaId } = await params;

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("obchod_ulohy")
    .delete()
    .eq("id", ulohaId)
    .eq("obchod_id", obchodId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
