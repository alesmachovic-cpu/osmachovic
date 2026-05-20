/**
 * reAuth.ts — Force re-authentication pre sensitive actions.
 *
 * 🔒 PEN-TEST M1 FIX (2026-05-20):
 *   Pôvodne stolen session = útočník vykoná ľubovoľnú akciu vrátane
 *   GDPR erasure / KZ podpis / role change. Žiadny "potvrď heslom" gate.
 *
 *   Teraz: pre sensitive actions vyžadujeme RE-PROOF identity v body:
 *     - confirm_password: tvoje heslo, alebo
 *     - confirm_code:     6-cifrový TOTP code (ak má 2FA zapnuté),
 *                         alebo backup code XXXX-XXXX
 *
 *   Aspoň jedno musí matchnúť. Inak 403 RE_AUTH_REQUIRED.
 *
 *   Helper sám si naťahá user z DB cez user_id, nemusí byť pre-loaded.
 */
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyTotp } from "@/lib/totp";
import { decryptDocString } from "@/lib/cryptoDocs";

// Discriminated union s explicit `?: undefined` pre TS narrowing
export type ReAuthResult =
  | { ok: true; method: "password" | "totp" | "backup_code"; reason?: undefined; status?: undefined; error?: undefined }
  | { ok: false; status: number; error: string; reason: "missing" | "wrong" | "rate_limit" | "user_not_found"; method?: undefined };

export async function requireReAuth(opts: {
  userId: string;
  password?: string;
  code?: string;
}): Promise<ReAuthResult> {
  if (!opts.password && !opts.code) {
    return {
      ok: false,
      status: 401,
      error: "Pre túto akciu zadaj svoje heslo alebo 6-cifrový kód z autentifikátora.",
      reason: "missing",
    };
  }

  const sb = getSupabaseAdmin();
  const { data: user } = await sb
    .from("users")
    .select("id, password, totp_secret, totp_enabled_at, totp_backup_codes, totp_last_used_counter")
    .eq("id", opts.userId)
    .maybeSingle();

  if (!user) {
    return { ok: false, status: 404, error: "Užívateľ nenájdený", reason: "user_not_found" };
  }

  // 1. Skús heslo (bcrypt)
  if (opts.password && user.password) {
    try {
      const match = await bcrypt.compare(opts.password, user.password);
      if (match) return { ok: true, method: "password" };
    } catch {
      // pokračuje na TOTP fallback
    }
  }

  // 2. Skús TOTP (ak má 2FA)
  if (opts.code && user.totp_secret && user.totp_enabled_at) {
    const plainSecret = decryptDocString(user.totp_secret);
    const t = verifyTotp(plainSecret, opts.code, { lastUsedCounter: user.totp_last_used_counter });
    if (t.ok) {
      // Update last used counter (replay protection)
      await sb.from("users").update({ totp_last_used_counter: t.counter }).eq("id", user.id);
      return { ok: true, method: "totp" };
    }
  }

  // 3. Skús backup code
  if (opts.code && Array.isArray(user.totp_backup_codes)) {
    for (let i = 0; i < user.totp_backup_codes.length; i++) {
      const hash = user.totp_backup_codes[i];
      if (typeof hash === "string" && await bcrypt.compare(opts.code, hash).catch(() => false)) {
        // Remove used backup code (single-use)
        const remaining = (user.totp_backup_codes as string[]).filter((_, idx) => idx !== i);
        await sb.from("users").update({ totp_backup_codes: remaining }).eq("id", user.id);
        return { ok: true, method: "backup_code" };
      }
    }
  }

  return {
    ok: false,
    status: 403,
    error: "Heslo alebo kód nesedí. Skontroluj že máš zapnuté 2FA ak posielaš TOTP kód.",
    reason: "wrong",
  };
}
