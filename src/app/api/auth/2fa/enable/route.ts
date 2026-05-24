import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { verifyTotp, generateBackupCodes } from "@/lib/totp";
import { logAudit } from "@/lib/audit";
import { decryptDocString } from "@/lib/cryptoDocs";

export const runtime = "nodejs";

/**
 * POST /api/auth/2fa/enable
 * Body: { code: "123456" }
 *
 * Overí prvý TOTP kód proti secret (vygenerovanému cez /setup) a ak prejde,
 * aktivuje 2FA + vygeneruje 10 backup codes. Plaintext backup codes vráti
 * RAZ v response — užívateľ ich MUSÍ uložiť, lebo neskôr sú len hashe v DB.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req, { strict: true });
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "").trim();
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Zadaj 6-cifrový kód z autentifikátora" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data: user } = await sb
    .from("users")
    .select("totp_secret, totp_enabled_at")
    .eq("id", auth.user.id)
    .single();

  if (!user || !user.totp_secret) {
    return NextResponse.json({ error: "Najprv spusti /api/auth/2fa/setup" }, { status: 400 });
  }
  if (user.totp_enabled_at) {
    return NextResponse.json({ error: "2FA je už zapnuté", code: "ALREADY_ENABLED" }, { status: 409 });
  }

  // C1: decrypt secret (backward compat — ak je plain, vráti as-is)
  const plainSecret = decryptDocString(user.totp_secret);
  const verified = verifyTotp(plainSecret, code);
  if (!verified.ok) {
    await logAudit({
      action: "2fa.enable_failed",
      actor_id: auth.user.id,
      actor_name: auth.user.name,
      target_id: auth.user.id,
      target_type: "user",
      detail: { reason: verified.reason },
      ip_address: req.headers.get("x-forwarded-for") || undefined,
    });
    return NextResponse.json({ error: "Kód nesedí. Skontroluj čas v telefóne a skús znova." }, { status: 400 });
  }

  // Vygeneruj backup codes (plaintext) + bcrypt hashes (uložené v DB).
  const plainBackup = generateBackupCodes(10);
  const hashedBackup = await Promise.all(plainBackup.map(c => bcrypt.hash(c, 8)));

  const { error: updErr } = await sb.from("users").update({
    totp_enabled_at: new Date().toISOString(),
    totp_backup_codes: hashedBackup,
    totp_last_used_counter: verified.counter,
  }).eq("id", auth.user.id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  await logAudit({
    action: "2fa.enabled",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_id: auth.user.id,
    target_type: "user",
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });

  return NextResponse.json({
    ok: true,
    backup_codes: plainBackup,
    warning: "Tieto backup kódy ulož na bezpečné miesto. Po zatvorení tohto okna ich už neuvidíš. Každý funguje len raz.",
  });
}
