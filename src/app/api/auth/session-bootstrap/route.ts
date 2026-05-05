import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildSessionCookieValue } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * POST /api/auth/session-bootstrap  Body: { user_id: string }
 *
 * LEGACY KOMPATIBILITA: AuthProvider stale uklada user.id do localStorage["crm_user"]
 * a obnovuje session zo localStorage pri reload. Toto NEPREJDE cez /api/auth/login,
 * teda nevystavi sa crm_session cookie. Bez cookie nove guard endpointy (notifications,
 * google/status, monitor/filtre) vracaju 401.
 *
 * Tento endpoint:
 *   1. Prijme user_id z body (klient ho posiela z localStorage)
 *   2. Overi ze user existuje v users tabulke (niktore podvrhnutia neoveruje, ten pad
 *      sa riesi az v plnej Supabase Auth migracii — out of scope P0)
 *   3. Vystavi crm_session HMAC cookie
 *
 * Bezpecnostny dopad: zachovava status quo (klient si stale moze podvrhnut user_id),
 * ale aspon novy guard endpoints sa zachovaju ako pred security/p0 deploy. Po
 * migrácii na Supabase Auth bude tento endpoint odstránený.
 */
export async function POST(req: NextRequest) {
  let body: { user_id?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  const userId = String(body.user_id || "").trim();
  if (!userId || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
    return NextResponse.json({ error: "Neplatné user_id" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data: user } = await sb
    .from("users")
    .select("id, name, role")
    .eq("id", userId)
    .maybeSingle();
  if (!user) {
    return NextResponse.json({ error: "Užívateľ neexistuje" }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true, user });
  res.headers.set("Set-Cookie", buildSessionCookieValue(String(user.id)));
  return res;
}
