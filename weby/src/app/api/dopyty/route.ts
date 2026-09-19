import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sb } from "@/lib/db";

export const runtime = "nodejs";

/** GET /api/dopyty — správca všetko, maklér len dopyty zo svojich webov. */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  let q = sb().from("weby_leads").select("*").order("created_at", { ascending: false }).limit(300);
  if (auth.user.role !== "admin") {
    const { data: mine } = await sb().from("weby_sites").select("id").eq("user_id", auth.user.id);
    const ids = (mine ?? []).map(r => r.id as string);
    if (!ids.length) return NextResponse.json({ dopyty: [] });
    q = q.in("site_id", ids);
  }
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ dopyty: data ?? [] });
}

/** PATCH /api/dopyty { id, vybavene } */
export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  let body: { id?: string; vybavene?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: "Chýba id" }, { status: 400 });
  if (auth.user.role !== "admin") {
    const { data: lead } = await sb().from("weby_leads").select("site_id").eq("id", body.id).maybeSingle();
    const { data: site } = lead?.site_id ? await sb().from("weby_sites").select("user_id").eq("id", lead.site_id).maybeSingle() : { data: null };
    if (!site || site.user_id !== auth.user.id) return NextResponse.json({ error: "Nemáš oprávnenie" }, { status: 403 });
  }
  const { error } = await sb().from("weby_leads").update({ vybavene: !!body.vybavene }).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
