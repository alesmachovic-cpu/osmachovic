import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { isManager } from "@/lib/web/access";

export const runtime = "nodejs";

/** GET /api/web/dopyty — dopyty z webov (maklér vidí len dopyty zo svojich webov). */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const sb = getSupabaseAdmin();
  let q = sb.from("web_dopyty").select("*").order("created_at", { ascending: false }).limit(300);
  if (!isManager(auth.user.role)) {
    const { data: mine } = await sb.from("web_sites").select("id").eq("user_id", auth.user.id);
    const ids = (mine ?? []).map(r => r.id as string);
    if (!ids.length) return NextResponse.json({ dopyty: [] });
    q = q.in("site_id", ids);
  }
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ dopyty: data ?? [] });
}

/** PATCH /api/web/dopyty — { id, vybavene } */
export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  let body: { id?: string; vybavene?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: "Chýba id" }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("web_dopyty").update({ vybavene: !!body.vybavene }).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
