import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

// Retention policy cleanup — spúšťa sa každú noc o 3:00.
// - login_attempts staršie ako 24h sa mažú (operatívne dáta).
//
// 🔒 F9 (2026-06-03): audit_log sa ZÁMERNE NEMAŽE. Je append-only
// (migr. 080_audit_log_immutable — BEFORE DELETE trigger), čo je forenzný
// invariant + kryje zákonnú retenciu (AML § 19 = 5 r., DPH § 76 = 10 r.).
// Predošlý kód robil `audit_log.delete().lt(2 roky)` → trigger ho blokol,
// cron tichо vracal `audit_log_cleaned: false` (mŕtvy no-op) a 2 roky boli
// aj tak pod zákonnou lehotou. Delete odstránený; retencia = append-only,
// odôvodnená oprávneným záujmom + zákonnou povinnosťou (GDPR čl. 6).
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const queryKey = request.nextUrl.searchParams.get("key");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && queryKey !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const attemptsRes = await sb.from("login_attempts").delete().lt("created_at", since24h);
  if (attemptsRes.error) {
    console.error("[cron/cleanup] login_attempts delete zlyhal:", attemptsRes.error.message);
  }

  return NextResponse.json({
    ok: !attemptsRes.error,
    login_attempts_cleaned: !attemptsRes.error,
    login_attempts_error: attemptsRes.error?.message,
    audit_log: "append-only — zámerne sa nemaže (forenzná + zákonná retencia 5/10 r.)",
    ran_at: new Date().toISOString(),
  });
}
