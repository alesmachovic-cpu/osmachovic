import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * GET /api/notifikacie?user_id=X[&unread_only=1][&limit=50]
 *   Vráti zoznam notifikácií pre user-a + counts.
 *
 * POST /api/notifikacie  { action, ids?, user_id }
 *   action='mark_read'  — označí konkrétne IDs (alebo všetky pre user-a) ako prečítané
 *   action='delete'     — zmaže konkrétne IDs (cleanup)
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });
  const unreadOnly = req.nextUrl.searchParams.get("unread_only") === "1";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 50), 200);

  const sb = getSupabaseAdmin();
  let q = sb.from("in_app_notifications")
    .select("id, type, title, body, url, meta, read_at, created_at")
    .eq("recipient_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (unreadOnly) q = q.is("read_at", null);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aj počet unread pre Bell badge
  const { count: unreadCount } = await sb
    .from("in_app_notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", userId)
    .is("read_at", null);

  return NextResponse.json({
    notifications: data || [],
    unread_count: unreadCount || 0,
  });
}

export async function POST(req: NextRequest) {
  let body: { action?: string; ids?: string[]; user_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  const { action, ids, user_id } = body;
  if (!action || !user_id) return NextResponse.json({ error: "action + user_id required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  if (action === "mark_read") {
    const now = new Date().toISOString();
    let q = sb.from("in_app_notifications").update({ read_at: now }).eq("recipient_user_id", user_id);
    if (ids && ids.length > 0) q = q.in("id", ids);
    else q = q.is("read_at", null); // mark all unread as read
    const { error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "delete") {
    if (!ids || ids.length === 0) return NextResponse.json({ error: "ids required for delete" }, { status: 400 });
    const { error } = await sb.from("in_app_notifications").delete().in("id", ids).eq("recipient_user_id", user_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
