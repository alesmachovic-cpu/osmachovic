import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, isSuperAdmin } from "@/lib/auth/requireUser";
import { encryptDocString, isEncrypted } from "@/lib/cryptoDocs";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST /api/admin/totp-encrypt-backfill
 *
 * 🔒 SECURITY BACKFILL 2026-05-20 (pen-test C1):
 *   Pôvodne sa TOTP secrety ukladali plaintext v `users.totp_secret`.
 *   Po fixe nové secrety idú cez encryptDocString. Ale EXISTUJÚCE plain
 *   secrety zostanú v DB kým ich tento backfill neprepíše.
 *
 *   Tento endpoint:
 *     1. Nájde všetkých users s NEEnkryptovaným totp_secret
 *     2. Pre každého re-uloží encryptDocString(plain)
 *     3. Audit log pre každú re-encryption
 *
 *   Admin-only. Idempotent — opätovné spustenie nič nezhorší.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req, { strict: true });
  if (auth.error) return auth.error;
  if (!isSuperAdmin(auth.user.role)) {
    return NextResponse.json({ error: "Len admin / majiteľ" }, { status: 403 });
  }

  const sb = getSupabaseAdmin();
  const { data: users } = await sb
    .from("users")
    .select("id, totp_secret")
    .not("totp_secret", "is", null);

  if (!users || users.length === 0) {
    return NextResponse.json({ ok: true, message: "Žiadny user nemá totp_secret", processed: 0 });
  }

  let encrypted = 0;
  let alreadyEncrypted = 0;
  const errors: string[] = [];

  for (const u of users) {
    if (isEncrypted(u.totp_secret)) {
      alreadyEncrypted++;
      continue;
    }
    try {
      const enc = encryptDocString(u.totp_secret);
      const { error } = await sb.from("users").update({ totp_secret: enc }).eq("id", u.id);
      if (error) {
        errors.push(`${u.id}: ${error.message}`);
      } else {
        encrypted++;
      }
    } catch (e) {
      errors.push(`${u.id}: ${String(e).slice(0, 100)}`);
    }
  }

  await logAudit({
    action: "admin.totp_encrypt_backfill",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_type: "users",
    detail: {
      total_users_with_secret: users.length,
      newly_encrypted: encrypted,
      already_encrypted: alreadyEncrypted,
      errors_count: errors.length,
    },
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });

  return NextResponse.json({
    ok: errors.length === 0,
    total: users.length,
    newly_encrypted: encrypted,
    already_encrypted: alreadyEncrypted,
    errors: errors.length > 0 ? errors : undefined,
  });
}
