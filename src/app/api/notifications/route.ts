import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, isSuperAdmin } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

/**
 * GET /api/notifications
 * Vráti notifikácie pre aktuálneho usera (zo session). NEAKCEPTUJE ?user_id=
 * od bežného usera (IDOR fix). Super_admin môže pozerať iného cez ?user_id=.
 *
 * POST /api/notifications  Body: { mark_read: id|"all" }
 * Označí pre aktuálneho usera (zo session).
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  // ?user_id= je OK len pre super_admina (admin pohľad)
  const queryUserId = req.nextUrl.searchParams.get("user_id");
  let targetUserId = auth.user.id;
  if (queryUserId && queryUserId !== auth.user.id) {
    if (!isSuperAdmin(auth.user.role)) {
      return NextResponse.json({ error: "Nemáš oprávnenie pozerať notifikácie iného užívateľa" }, { status: 403 });
    }
    targetUserId = queryUserId;
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("in_app_notifications")
    .select("id, typ, titulok, sprava, data, precitane, created_at")
    .eq("user_id", targetUserId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const unread = (data || []).filter(n => !n.precitane).length;
  return NextResponse.json({ notifications: data || [], unread });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body: { mark_read?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  const target = body.mark_read;
  if (!target) return NextResponse.json({ error: "mark_read required" }, { status: 400 });

  // Vždy pre prihláseného usera (žiadny ?user_id= z body — IDOR fix)
  const sb = getSupabaseAdmin();
  let q = sb.from("in_app_notifications").update({ precitane: true }).eq("user_id", auth.user.id);
  if (target !== "all") q = q.eq("id", target);
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
