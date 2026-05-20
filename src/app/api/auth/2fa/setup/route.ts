import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { generateSecret, buildOtpAuthUri } from "@/lib/totp";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST /api/auth/2fa/setup
 *
 * Vygeneruje nový TOTP secret pre prihláseného užívateľa + uloží do DB
 * (ale ešte NEZAPÍNA 2FA — to robí /enable po overení prvého kódu).
 *
 * Response: { secret, otpauth_uri, manual_key_groups }
 *   - secret             base32 string, pre fallback ručného zadania
 *   - otpauth_uri        otpauth:// URI pre QR code (klient si ho zrenderuje)
 *   - manual_key_groups  secret rozdelený na skupiny po 4 znakoch (čitateľnosť)
 *
 * Ak má user už zapnuté 2FA → 409 (musí najprv disable + re-setup).
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req, { strict: true });
  if (auth.error) return auth.error;

  const sb = getSupabaseAdmin();

  const { data: user } = await sb
    .from("users")
    .select("totp_enabled_at, totp_secret, email, login_email, name")
    .eq("id", auth.user.id)
    .single();

  if (!user) return NextResponse.json({ error: "Užívateľ nenájdený" }, { status: 404 });
  if (user.totp_enabled_at) {
    return NextResponse.json({
      error: "2FA je už zapnuté. Najprv ho vypni cez /api/auth/2fa/disable.",
      code: "ALREADY_ENABLED",
    }, { status: 409 });
  }

  // UX fix 2026-05-20: ak má user secret v DB ale enabled_at IS NULL
  // (= rozrobený setup), VRÁTIME ten istý secret — Authenticator záznam
  // z prvého pokusu stále funguje. Inak by user musel naskenovať novú QR
  // pre každý refresh a starý záznam by ostal mŕtvy.
  const secret = user.totp_secret || generateSecret(32);
  const account = user.login_email || user.email || user.name || auth.user.id;

  // Ak nový secret, ulož ho. Ak existujúci, len audit log.
  if (!user.totp_secret) {
    const { error } = await sb.from("users").update({ totp_secret: secret }).eq("id", auth.user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const otpauth = buildOtpAuthUri({ secret, account: String(account), issuer: "VIANEMA Real" });
  const manualKeyGroups = secret.match(/.{1,4}/g) || [];

  await logAudit({
    action: "2fa.setup_started",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_id: auth.user.id,
    target_type: "user",
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });

  return NextResponse.json({
    secret,
    otpauth_uri: otpauth,
    manual_key_groups: manualKeyGroups,
    issuer: "VIANEMA Real",
    account,
  });
}
