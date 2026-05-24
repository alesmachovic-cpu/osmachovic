import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, isSuperAdmin } from "@/lib/auth/requireUser";
import { logAudit } from "@/lib/audit";
import { requireReAuth } from "@/lib/auth/reAuth";

export const runtime = "nodejs";

/**
 * POST /api/users/reset-password
 * Body: { user_id }
 *
 * Admin workaround keď email (Resend) nefunguje:
 * - Vygeneruje dočasné 12-znakové heslo
 * - Bcrypt-hashne a uloží do users tabuľky
 * - Vráti plain text heslo adminovi aby ho mohol poslať maklerovi (SMS/Slack/telefón)
 *
 * Toto endpoint volá IBA admin UI v Nastaveniach. Frontend by mal overovať
 * že volajúci je admin. (V plnom zabezpečení by tu bola Supabase Auth kontrola,
 * ale zatiaľ je to na úrovni UI.)
 */

function generateReadablePassword(length = 12): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bez podobných znakov
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

export async function POST(request: Request) {
  try {
    // 🚨 FIX 2026-05-20 (Security Auditor P0):
    // Bez auth check tento endpoint resetol heslo akéhokoľvek usera (vrátane admina).
    // Teraz: VYŽADUJE platnú admin session.
    const auth = await requireUser(request as NextRequest, { strict: true });
    if (auth.error) return auth.error;
    if (!isSuperAdmin(auth.user.role)) {
      return NextResponse.json({ error: "Len admin/majiteľ môže resetovať heslo" }, { status: 403 });
    }

    const body = await request.json();
    const userId = body.user_id;
    if (!userId) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

    // 🔒 M1 force re-auth — admin password reset cudzieho účtu je vysoko sensitive.
    const reAuth = await requireReAuth({
      userId: auth.user.id,
      password: body.confirm_password,
      code: body.confirm_code,
    });
    if (!reAuth.ok) {
      return NextResponse.json({
        error: reAuth.error,
        code: "RE_AUTH_REQUIRED",
      }, { status: reAuth.status });
    }

    const sb = getSupabaseAdmin();

    // Over že user existuje
    const { data: user } = await sb.from("users").select("id, name").eq("id", userId).maybeSingle();
    if (!user) return NextResponse.json({ error: "Používateľ neexistuje" }, { status: 404 });

    // Vygeneruj dočasné heslo + hashni
    const tempPassword = generateReadablePassword(12);
    const hashed = await bcrypt.hash(tempPassword, 10);

    const { error } = await sb.from("users")
      .update({ password: hashed })
      .eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Audit log cez logAudit helper (zachovať konzistenciu).
    await logAudit({
      action: "user.admin_reset_password",
      actor_id: auth.user.id,
      actor_name: auth.user.name,
      target_id: userId,
      target_type: "user",
      target_name: String(user.name),
    });

    return NextResponse.json({
      success: true,
      temp_password: tempPassword,
      message: `Heslo pre ${user.name} bolo resetované. Pošli dočasné heslo maklerovi (bezpečným kanálom).`,
    });
  } catch (e) {
    console.error("[reset-password] error:", e); // safe-log
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
