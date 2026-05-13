import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireUser(req, { strict: true });
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const userId = body.user_id || auth.user?.id;
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const sb = getSupabaseAdmin();

  const { data, error } = await sb.from("gdpr_requests").insert({
    user_id: userId,
    type: "erasure",
    status: "pending",
    details: { requested_by_ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null },
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit log
  await sb.from("audit_log").insert({
    user_id: auth.user?.id,
    action: "gdpr_erasure_request",
    entity_type: "gdpr_requests",
    entity_id: data.id,
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    user_agent: req.headers.get("user-agent"),
  }).then(() => null, () => null);

  return NextResponse.json({ ok: true, request_id: data.id, message: "Žiadosť zaevidovaná. Spracujeme do 30 dní." });
}
