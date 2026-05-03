import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * GET /api/notifications?user_id=X
 * Vráti posledných 30 in-app notifikácií pre tohto usera + count neprečítaných.
 *
 * POST /api/notifications  Body: { user_id, mark_read?: id|"all" }
 * Označí jednu/všetky notifikácie ako prečítané.
 */
export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const userId = req.nextUrl.searchParams.get("user_id");
  if (!userId) return NextResponse.json({ notifications: [], unread: 0 });

  const { data, error } = await sb
    .from("in_app_notifications")
    .select("id, typ, titulok, sprava, data, precitane, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const unread = (data || []).filter(n => !n.precitane).length;
  return NextResponse.json({ notifications: data || [], unread });
}

export async function POST(req: NextRequest) {
  const sb = getSupabaseAdmin();
  let body: { user_id?: string; mark_read?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  const userId = body.user_id;
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const target = body.mark_read;
  if (!target) return NextResponse.json({ error: "mark_read required" }, { status: 400 });

  let q = sb.from("in_app_notifications").update({ precitane: true }).eq("user_id", userId);
  if (target !== "all") q = q.eq("id", target);
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
