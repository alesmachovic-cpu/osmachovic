import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * /api/audit — audit log endpoint
 *
 * POST: zapíš audit záznam (z API routes)
 *   Body: { user_id, action, entity_type?, entity_id?, detail? }
 *
 * GET: zobraz audit log (admin)
 *   Query: ?user_id=xxx | ?action=xxx | ?entity_type=xxx
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sb = getSupabaseAdmin();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const userAgent = request.headers.get("user-agent") || "";

    const { error } = await sb.from("audit_log").insert({
      user_id: body.user_id || null,
      action: body.action,
      entity_type: body.entity_type || null,
      entity_id: body.entity_id || null,
      detail: body.detail || null,
      ip, user_agent: userAgent,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sb = getSupabaseAdmin();

    let query = sb.from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    const userId = searchParams.get("user_id");
    const action = searchParams.get("action");
    const entityType = searchParams.get("entity_type");

    if (userId) query = query.eq("user_id", userId);
    if (action) query = query.eq("action", action);
    if (entityType) query = query.eq("entity_type", entityType);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ logs: data || [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
