import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildSessionCookieValue, buildBillingCookieValue } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * POST /api/auth/google/match
 * Body: { email: string }
 *
 * Nájde CRM usera podľa Google emailu (login_email alebo email).
 * Volané z /auth/callback po Google OAuth — pred tým ako existuje session cookie.
 *
 * 🔒 2FA gate (FIX 2026-05-20):
 *   Pôvodne tento endpoint po Google OAuth rovno vystavil session cookie
 *   BEZ kontroly 2FA. Útočník čo dostane prístup ku Google účtu obetiu obišiel
 *   2FA úplne. Teraz: ak user má totp_enabled_at, vrátime requires_2fa+challenge
 *   namiesto session cookie (rovnaký pattern ako /api/auth/login).
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
  const SELECT = "id, name, initials, role, company_id, totp_enabled_at";

  // Skús najprv login_email; ak nič, fallback na email. (`.or()` filter má problém
  // s bodkami a @ v hodnote — parsuje ich ako oddeľovače cesty, preto chained query.)
  type MatchedUser = { id: string; name: string; initials: string | null; role: string | null; company_id: string | null; totp_enabled_at: string | null };
  let users: MatchedUser | null = null;
  {
    const { data, error } = await sb
      .from("users")
      .select(SELECT)
      .ilike("login_email", email)
      .limit(1)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    users = data as typeof users;
  }
  if (!users) {
    const { data, error } = await sb
      .from("users")
      .select(SELECT)
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    users = data as typeof users;
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
