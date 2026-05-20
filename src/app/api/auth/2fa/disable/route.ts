import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { verifyTotp } from "@/lib/totp";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST /api/auth/2fa/disable
 * Body: { password: "...", code?: "123456" | backup_code }
 *
 * Vyžaduje:
 *   1. Aktuálne heslo (anti-stolen-session)
 *   2. ALEBO platný TOTP kód / backup code (proof of possession)
 *
 * Po vypnutí: totp_secret = NULL, totp_enabled_at = NULL, backup_codes = [].
 *
 * Admin-only override: admin môže vypnúť 2FA inému užívateľovi (v prípade
 * straty telefónu) cez body.target_user_id. To vždy ide do audit logu.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req, { strict: true });
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const password = String(body.password || "");
  const code = String(body.code || "").trim();
  const targetUserId = body.target_user_id ? String(body.target_user_id) : auth.user.id;

  // Cross-user disable = iba admin/majiteľ.
  const isCrossUser = targetUserId !== auth.user.id;
  if (isCrossUser) {
    if (auth.user.role !== "super_admin" && auth.user.role !== "majitel" && auth.user.role !== "platform_admin") {
      return NextResponse.json({ error: "Cross-user 2FA disable smie len admin/majiteľ" }, { status: 403 });
    }
  }

  const sb = getSupabaseAdmin();
  const { data: target } = await sb
    .from("users")
    .select("id, password, totp_secret, totp_enabled_at, totp_backup_codes, totp_last_used_counter")
    .eq("id", targetUserId)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "Užívateľ nenájdený" }, { status: 404 });
  if (!target.totp_enabled_at) {
    return NextResponse.json({ error: "2FA už nie je zapnuté", code: "NOT_ENABLED" }, { status: 409 });
  }

  // Same-user: vyžadujeme buď platné heslo, ALEBO TOTP/backup code.
  if (!isCrossUser) {
    let proofOk = false;

    if (password && target.password) {
      proofOk = await bcrypt.compare(password, target.password);
    }
    if (!proofOk && code && target.totp_secret) {
      // Skús TOTP
      const t = verifyTotp(target.totp_secret, code, { lastUsedCounter: target.totp_last_used_counter });
      if (t.ok) proofOk = true;

      // Skús backup code
      if (!proofOk && Array.isArray(target.totp_backup_codes)) {
        for (const hash of target.totp_backup_codes) {
          if (typeof hash === "string" && await bcrypt.compare(code, hash)) {
            proofOk = true;
            break;
          }
        }
      }
    }

    if (!proofOk) {
      return NextResponse.json({ error: "Heslo alebo kód nesedí" }, { status: 400 });
    }
  }

  const { error } = await sb.from("users").update({
    totp_secret: null,
    totp_enabled_at: null,
    totp_backup_codes: [],
    totp_last_used_counter: null,
  }).eq("id", targetUserId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    action: "2fa.disabled",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_id: targetUserId,
    target_type: "user",
    detail: { cross_user: isCrossUser, by_admin: isCrossUser },
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });

  return NextResponse.json({ ok: true });
}
