import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildSessionCookieValue, buildBillingCookieValue } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * POST /api/auth/google/match
 * Body: { supabase_jwt: string }
 *
 * Volané z /auth/callback po Google OAuth.
 * Overí Supabase JWT (podpísaný Supabase Auth, nepodvrhuteľný),
 * extrahuje verifikovaný email a nájde CRM usera (login_email alebo email).
 * Nastaví crm_session cookie.
 *
 * BEZPEČNOSŤ: Predtým endpoint dôveroval body.email — útočník mohol POST
 * {email: "victim@x.com"} a dostať platnú session. Teraz JWT verifikácia
 * zaručuje že email naozaj pochádza z Google OAuth flow.
 */
export async function POST(req: NextRequest) {
  let supabaseJwt: string;
  try {
    const body = await req.json();
    supabaseJwt = String(body.supabase_jwt || "");
  } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  if (!supabaseJwt) {
    return NextResponse.json({ error: "supabase_jwt required" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // Verifikácia JWT proti Supabase Auth — ak je platný, vráti usera
  // s overeným emailom z Google OAuth. Neplatný JWT → 401.
  const { data: supabaseUser, error: jwtErr } = await sb.auth.getUser(supabaseJwt);
  if (jwtErr || !supabaseUser?.user?.email) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  const email = supabaseUser.user.email.toLowerCase();

  const { data: users, error } = await sb
    .from("users")
    .select("id, name, initials, role, company_id")
    .or(`login_email.ilike.${email},email.ilike.${email}`)
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!users) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let companyActive = true;
  const companyId = (users as Record<string, unknown>).company_id as string | null;
  if (companyId) {
    const { data: co } = await sb.from("companies").select("is_active").eq("id", companyId).single();
    companyActive = co?.is_active !== false;
  }

  const res = NextResponse.json({ user: users });
  res.headers.append("Set-Cookie", buildSessionCookieValue(String(users.id)));
  res.headers.append("Set-Cookie", buildBillingCookieValue(companyActive));
  return res;
}
