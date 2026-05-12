import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildSessionCookieValue } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * POST /api/auth/google/match
 * Body: { email: string }
 *
 * Nájde CRM usera podľa Google emailu (login_email alebo email).
 * Volané z /auth/callback po Google OAuth — pred tým ako existuje session cookie.
 * Vracia len minimálne dáta + nastaví session cookie.
 */
export async function POST(req: NextRequest) {
  let email: string;
  try {
    const body = await req.json();
    email = String(body.email || "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: users, error } = await sb
    .from("users")
    .select("id, name, initials, role")
    .or(`login_email.ilike.${email},email.ilike.${email}`)
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!users) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const res = NextResponse.json({ user: users });
  res.headers.set("Set-Cookie", buildSessionCookieValue(String(users.id)));
  return res;
}
