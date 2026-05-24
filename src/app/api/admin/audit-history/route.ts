import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, isSuperAdmin } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

/**
 * GET /api/admin/audit-history
 * Vracia posledných 14 dní audit_runs pre dashboard.
 * Admin-only.
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  if (!isSuperAdmin(auth.user.role)) {
    return NextResponse.json({ error: "Len admin" }, { status: 403 });
  }

  const sb = getSupabaseAdmin();
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();

  const { data, error } = await sb
    .from("audit_runs")
    .select("id, run_at, source, counts, results, email_summary")
    .gte("run_at", since)
    .order("run_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ runs: data || [] });
}
