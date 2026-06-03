import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildSessionCookieValue, buildBillingCookieValue } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * POST /api/auth/google/match
 * Body: { supabase_jwt: string }
 *
 * Volané z /auth/callback po Google OAuth.
 * Overí Supabase JWT (podpísaný Supabase Auth, nepodvrhuteľný), extrahuje
 * verifikovaný email a nájde CRM usera (login_email alebo email).
 *
 * 🔒 JWT verification (FIX 2026-05-24):
 *   Pôvodne body.email bol trusted — útočník mohol POST {email:"victim@x.com"}
 *   a získať session pre toho usera. Teraz sa email berie z verifikovaného JWT.
 *
 * 🔒 2FA gate (FIX 2026-05-20):
 *   Pôvodne tento endpoint po Google OAuth rovno vystavil session cookie
 *   BEZ kontroly 2FA. Útočník čo dostane prístup ku Google účtu obetiu obišiel
 *   2FA úplne. Teraz: ak user má totp_enabled_at, vrátime requires_2fa+challenge
 *   namiesto session cookie (rovnaký pattern ako /api/auth/login).
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
  // s overeným emailom z Google OAuth flow. Neplatný/expired JWT → 401.
  const { data: supabaseUser, error: jwtErr } = await sb.auth.getUser(supabaseJwt);
  if (jwtErr || !supabaseUser?.user?.email) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  const email = supabaseUser.user.email.toLowerCase();

  // 2026-06-03: tolerant SELECT — prod DB (hokymscytscsewrpwdjf) zatiaľ nemá
  // totp_* stĺpce (2FA migrácia ešte nebehala). Skús full SELECT; ak schema
  // mismatch, fallback bez totp. Po DB migrácii (sql/migrations/2026-06-03-add-totp-columns.sql)
  // ostane funkčný full path.
  const SELECT_FULL = "id, name, initials, role, company_id, totp_enabled_at";
  const SELECT_LEGACY = "id, name, initials, role, company_id";
  type MatchedUser = { id: string; name: string; initials: string | null; role: string | null; company_id: string | null; totp_enabled_at?: string | null };

  async function lookup(byCol: "login_email" | "email"): Promise<MatchedUser | null> {
    const { data, error } = await sb.from("users").select(SELECT_FULL).ilike(byCol, email).limit(1).maybeSingle();
    if (!error) return data as MatchedUser | null;
    if (error.code === "PGRST204" || /column .* does not exist|schema cache/i.test(error.message)) {
      const r2 = await sb.from("users").select(SELECT_LEGACY).ilike(byCol, email).limit(1).maybeSingle();
      if (r2.error) throw new Error(r2.error.message);
      return r2.data as MatchedUser | null;
    }
    throw new Error(error.message);
  }

  let users: MatchedUser | null = null;
  try {
    users = await lookup("login_email");
    if (!users) users = await lookup("email");
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "lookup_failed" }, { status: 500 });
  }
  if (!users) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // 🔒 2FA gate — ak má user aktivované 2FA, NEVYSTAVUJ session cookie.
  // Frontend (auth/callback page) musí volať /api/auth/2fa/verify so 6-digit kódom.
  if (users.totp_enabled_at) {
    const challenge = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = (req.headers.get("user-agent") || "").slice(0, 500);
    await sb.from("auth_2fa_challenges").insert({
      user_id: users.id,
      challenge,
      ip,
      user_agent: userAgent,
      expires_at: expiresAt,
    });
    return NextResponse.json({
      requires_2fa: true,
      challenge,
      message: "Zadaj 6-cifrový kód z autentifikátora alebo backup kód.",
    });
  }

  // Billing status pre crm_billing cookie
  let companyActive = true;
  const companyId = users.company_id;
  if (companyId) {
    const { data: co } = await sb.from("companies").select("is_active").eq("id", companyId).single();
    companyActive = co?.is_active !== false;
  }

  // Bez session response NEVYTVÁRAME — totp_enabled_at vraciame tu, ale frontend
  // ho už nevidí (vyradíme z payloadu pre čistotu).
  const { totp_enabled_at: _, ...safeUser } = users;
  const res = NextResponse.json({ user: safeUser });
  res.headers.append("Set-Cookie", buildSessionCookieValue(String(users.id)));
  res.headers.append("Set-Cookie", buildBillingCookieValue(companyActive));
  return res;
}
