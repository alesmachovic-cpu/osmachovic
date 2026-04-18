import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * POST /api/auth/reset
 * Body: { token, password }
 *
 * Overí token, skontroluje expiráciu, nastaví nové heslo (bcrypt),
 * označí token ako použitý.
 */

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = String(body.token || "").trim();
    const password = String(body.password || "");

    if (!token) return NextResponse.json({ error: "Chýba token" }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Heslo musí mať aspoň 8 znakov" }, { status: 400 });

    const sb = getSupabaseAdmin();
    const tokenHash = hashToken(token);

    // Nájdi token
    const { data: tokenRow } = await sb.from("password_reset_tokens")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!tokenRow) {
      return NextResponse.json({ error: "Neplatný alebo expirovaný odkaz" }, { status: 400 });
    }

    if (tokenRow.used_at) {
      return NextResponse.json({ error: "Tento odkaz bol už použitý" }, { status: 400 });
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ error: "Odkaz expiroval. Požiadaj o nový." }, { status: 400 });
    }

    // Hashni nové heslo
    const hashedPassword = await bcrypt.hash(password, 10);

    // Uprav heslo + označ token ako použitý
    const { error: updErr } = await sb.from("users")
      .update({ password: hashedPassword })
      .eq("id", tokenRow.user_id);
    if (updErr) {
      return NextResponse.json({ error: "Chyba pri ukladaní hesla" }, { status: 500 });
    }

    await sb.from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    // Audit log
    await sb.from("audit_log").insert({
      user_id: tokenRow.user_id,
      action: "password_reset",
      entity_type: "user",
      entity_id: tokenRow.user_id,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[reset] error:", e);
    return NextResponse.json({ error: "Chyba pri obnove hesla" }, { status: 500 });
  }
}
