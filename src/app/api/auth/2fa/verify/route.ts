import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildSessionCookieValue, buildBillingCookieValue, buildTwoFactorCookieValue } from "@/lib/auth/session";
import { verifyTotp } from "@/lib/totp";
import { logAudit } from "@/lib/audit";
import { rateLimit, getRequestIp, RATE_LIMITS } from "@/lib/rateLimit";
import { decryptDocString } from "@/lib/cryptoDocs";

export const runtime = "nodejs";

/**
 * POST /api/auth/2fa/verify
 * Body: { challenge: "...", code: "123456" | "AAAA-BBBB" }
 *
 * Druhý krok login flow. Vyžaduje:
 *   - platný challenge z /api/auth/login (max 5 min, nepoužitý)
 *   - platný TOTP kód ALEBO backup code
 *
 * Pri úspechu: vystaví session cookie + crm_billing cookie.
 * Backup code (ak použitý): odstránený z DB (single-use).
 *
 * Rate limit: rovnaký ako LOGIN (5/15min/IP) — brute force token shouldn't be easy.
 */
export async function POST(req: NextRequest) {
  const ip = getRequestIp(req);
  const rl = rateLimit({ key: `2fa-verify:${ip}`, ...RATE_LIMITS.LOGIN });
  if (!rl.ok) {
    return NextResponse.json(
      { error: rl.error, code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const challenge = String(body.challenge || "").trim();
  const code = String(body.code || "").trim();

  if (!challenge || !code) {
    return NextResponse.json({ error: "Chýba challenge alebo kód" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // Nájdi platný challenge.
  const { data: ch } = await sb
    .from("auth_2fa_challenges")
    .select("id, user_id, expires_at, used_at")
    .eq("challenge", challenge)
    .maybeSingle();

  if (!ch) {
    return NextResponse.json({ error: "Neplatný challenge — prihláste sa znova" }, { status: 401 });
  }
  if (ch.used_at) {
    return NextResponse.json({ error: "Challenge už bol použitý" }, { status: 401 });
  }
  if (new Date(ch.expires_at) < new Date()) {
    return NextResponse.json({ error: "Challenge vypršal. Prihláste sa znova." }, { status: 401 });
  }

  // Načítaj usera.
  const { data: user } = await sb
    .from("users")
    .select("*")
    .eq("id", ch.user_id)
    .maybeSingle();
  if (!user || !user.totp_secret) {
    return NextResponse.json({ error: "2FA nie je nakonfigurované" }, { status: 400 });
  }

  // Skús TOTP najprv.
  let proofOk = false;
  let usedBackupCodeIdx: number | null = null;
  let usedTotpCounter: number | null = null;

  // C1: decrypt secret (backward compat — ak je plain, vráti as-is)
  const plainSecret = decryptDocString(user.totp_secret);
  const totpResult = verifyTotp(plainSecret, code, { lastUsedCounter: user.totp_last_used_counter });
  if (totpResult.ok) {
    proofOk = true;
    usedTotpCounter = totpResult.counter;
  }

  // Ak TOTP neprešiel, skús backup code.
  if (!proofOk && Array.isArray(user.totp_backup_codes)) {
    for (let i = 0; i < user.totp_backup_codes.length; i++) {
      const hash = user.totp_backup_codes[i];
      if (typeof hash === "string" && await bcrypt.compare(code, hash)) {
        proofOk = true;
        usedBackupCodeIdx = i;
        break;
      }
    }
  }

  if (!proofOk) {
    await logAudit({
      action: "2fa.verify_failed",
      actor_id: ch.user_id,
      target_id: ch.user_id,
      target_type: "user",
      detail: { ip, challenge_id: ch.id },
      ip_address: ip,
    });
    return NextResponse.json({ error: "Kód nesedí" }, { status: 401 });
  }

  // Markni challenge ako použitý + update counter / odstráň backup code.
  await sb.from("auth_2fa_challenges").update({ used_at: new Date().toISOString() }).eq("id", ch.id);

  const updates: Record<string, unknown> = {};
  if (usedTotpCounter != null) {
    updates.totp_last_used_counter = usedTotpCounter;
  }
  if (usedBackupCodeIdx != null) {
    const remaining = (user.totp_backup_codes as string[]).filter((_: string, idx: number) => idx !== usedBackupCodeIdx);
    updates.totp_backup_codes = remaining;
  }
  if (Object.keys(updates).length > 0) {
    await sb.from("users").update(updates).eq("id", user.id);
  }

  await logAudit({
    action: "2fa.verify_ok",
    actor_id: String(user.id),
    actor_name: String(user.name || ""),
    target_id: String(user.id),
    target_type: "user",
    detail: { used_backup_code: usedBackupCodeIdx != null, ip },
    ip_address: ip,
  });

  // Billing status.
  let companyActive = true;
  if (user.company_id) {
    const { data: co } = await sb.from("companies").select("is_active").eq("id", user.company_id).single();
    companyActive = co?.is_active !== false;
  }

  const safeUser = { ...user, password: undefined, totp_secret: undefined, totp_backup_codes: undefined };
  const res = NextResponse.json({ user: safeUser });
  res.headers.append("Set-Cookie", buildSessionCookieValue(String(user.id)));
  res.headers.append("Set-Cookie", buildBillingCookieValue(companyActive));
  // User má 2FA zapnuté (práve overené) → zruš prípadnú stale enforcement cookie.
  res.headers.append("Set-Cookie", buildTwoFactorCookieValue(false));
  return res;
}
