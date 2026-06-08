import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { getUserScope } from "@/lib/scope";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Register porušení ochrany osobných údajov (G9, GDPR čl. 33 ods. 5).
 * Admin-only. POST = zaeviduj incident, GET = zoznam incidentov firmy.
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const scope = await getUserScope(auth.user.id);
  if (!scope?.isAdmin) return NextResponse.json({ error: "Len admin/majiteľ" }, { status: 403 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("breach_register")
    .select("*")
    .eq("company_id", scope.company_id)
    .order("detected_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ breaches: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const scope = await getUserScope(auth.user.id);
  if (!scope?.isAdmin) return NextResponse.json({ error: "Len admin/majiteľ" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  const description = String(body.description || "").trim();
  if (!description) return NextResponse.json({ error: "description required" }, { status: 400 });

  const risk = String(body.risk_level || "normal");
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("breach_register").insert({
    company_id: scope.company_id,
    description: description.slice(0, 2000),
    occurred_at: body.occurred_at || null,
    data_categories: body.data_categories ? String(body.data_categories).slice(0, 500) : null,
    affected_count: typeof body.affected_count === "number" ? body.affected_count : null,
    risk_level: ["none", "normal", "high"].includes(risk) ? risk : "normal",
    reported_uoou: body.reported_uoou === true,
    reported_uoou_at: body.reported_uoou === true ? (body.reported_uoou_at || new Date().toISOString()) : null,
    subjects_notified: body.subjects_notified === true,
    measures: body.measures ? String(body.measures).slice(0, 2000) : null,
    created_by: auth.user.id,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    action: "gdpr.breach.recorded",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_id: data?.id,
    target_type: "breach",
    detail: { risk_level: risk, reported_uoou: body.reported_uoou === true },
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });
  return NextResponse.json({ ok: true, id: data?.id });
}
