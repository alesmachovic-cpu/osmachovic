import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { validatePasswordStrength } from "@/lib/auth/password";
import { buildSessionCookieValue } from "@/lib/auth/session";

export const runtime = "nodejs";

/** GET — overí platnosť tokenu (bez auth, pre stránku) */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ valid: false });

  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("user_invites")
    .select("user_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (!data) return NextResponse.json({ valid: false });
  if (data.used_at) return NextResponse.json({ valid: false, reason: "used" });
  if (new Date(data.expires_at) < new Date()) return NextResponse.json({ valid: false, reason: "expired" });

  const { data: u } = await sb.from("users").select("name").eq("id", data.user_id).maybeSingle();
  const userName = (u?.name as string | null) ?? "";
  return NextResponse.json({ valid: true, userName });
}

/** POST — uloží heslo, označí invite ako použitý, nastaví session */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = String(body.token || "").trim();
    const password = String(body.password || "");

    if (!token) return NextResponse.json({ error: "Chýba token" }, { status: 400 });

    const pwCheck = validatePasswordStrength(password);
    if (!pwCheck.valid) return NextResponse.json({ error: pwCheck.message }, { status: 400 });

    const sb = getSupabaseAdmin();
    const { data: invite } = await sb
      .from("user_invites")
      .select("id, user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (!invite) return NextResponse.json({ error: "Neplatný odkaz" }, { status: 400 });
    if (invite.used_at) return NextResponse.json({ error: "Odkaz bol už použitý" }, { status: 400 });
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "Odkaz expiroval" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 10);

    const { error: pwErr } = await sb
      .from("users")
      .update({ password: hashed })
      .eq("id", invite.user_id);
    if (pwErr) return NextResponse.json({ error: pwErr.message }, { status: 500 });

    await sb
      .from("user_invites")
      .update({ used_at: new Date().toISOString() })
      .eq("id", invite.id);

    const res = NextResponse.json({ success: true });
    res.headers.set("Set-Cookie", buildSessionCookieValue(invite.user_id));
    return res;
  } catch (e) {
    console.error("[invite/accept] error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
