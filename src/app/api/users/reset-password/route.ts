import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

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
    const body = await request.json();
    const userId = body.user_id;
    if (!userId) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

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

    // Audit log
    await sb.from("audit_log").insert({
      user_id: "ales", // admin action (ideálne z session, zatial hardcoded)
      action: "admin_reset_password",
      entity_type: "user",
      entity_id: userId,
      detail: { target_name: user.name },
    });

    return NextResponse.json({
      success: true,
      temp_password: tempPassword,
      message: `Heslo pre ${user.name} bolo resetované. Pošli dočasné heslo maklerovi (bezpečným kanálom).`,
    });
  } catch (e) {
    console.error("[reset-password] error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
