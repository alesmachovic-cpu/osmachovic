import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

// Retention policy cleanup — spúšťa sa každú noc o 3:00
// - login_attempts starší ako 24h
// - audit_log starší ako 2 roky
export async function GET() {
  const sb = getSupabaseAdmin();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since2y  = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();

  const [attemptsRes, auditRes] = await Promise.all([
    sb.from("login_attempts").delete().lt("created_at", since24h),
    sb.from("audit_log").delete().lt("created_at", since2y),
  ]);

  return NextResponse.json({
    ok: true,
    login_attempts_cleaned: !attemptsRes.error,
    audit_log_cleaned: !auditRes.error,
    ran_at: new Date().toISOString(),
  });
}
