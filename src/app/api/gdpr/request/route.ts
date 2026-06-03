import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

const ALLOWED = ["access", "export", "erasure", "rectification", "objection", "restriction"];

/**
 * Registruje GDPR žiadosť prihláseného používateľa do gdpr_requests (status
 * pending). Nahrádza rozbité priame volanie erasure z /transparency — žiadosť
 * sa zaeviduje a RK ju spracuje do 30 dní (čl. 12 ods. 3 GDPR). Notifikuje
 * manažérov firmy.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body: { type?: string; reason?: string } = {};
  try { body = await req.json(); } catch { /* prázdne */ }
  const type = String(body.type || "").trim();
  if (!ALLOWED.includes(type)) {
    return NextResponse.json({ error: "Neplatný typ žiadosti" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  const { data, error } = await sb.from("gdpr_requests").insert({
    user_id: auth.user.id,
    type,
    status: "pending",
    details: { reason: (body.reason || "").slice(0, 500), self_requested: true, actor_name: auth.user.name },
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    action: "gdpr.request.created",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_id: data?.id,
    target_type: "gdpr_request",
    detail: { type },
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });

  return NextResponse.json({ ok: true, id: data?.id });
}
