import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildSessionCookieValue, buildBillingCookieValue } from "@/lib/auth/session";

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
  const SELECT = "id, name, initials, role, company_id";

  // Skús najprv login_email; ak nič, fallback na email. (`.or()` filter má problém
  // s bodkami a @ v hodnote — parsuje ich ako oddeľovače cesty, preto chained query.)
  let users: { id: string; name: string; initials: string | null; role: string | null; company_id: string | null } | null = null;
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

  // Billing status pre crm_billing cookie
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
