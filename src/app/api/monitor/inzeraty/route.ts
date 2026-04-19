import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * DELETE /api/monitor/inzeraty
 * Body: { ids: string[], actorEmail?: string }
 *
 * Zmaže viacero inzerátov naraz. Super-admin only (ales.machovic@gmail.com).
 * UI posiela body s actorEmail, serverom over (jednoduchá kontrola pre personal CRM).
 */
const SUPER_ADMIN_EMAIL = "ales.machovic@gmail.com";

export async function DELETE(request: Request) {
  let body: { ids?: string[]; actorEmail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  if (body.actorEmail !== SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: "Nedostatočné oprávnenia" }, { status: 403 });
  }

  const ids = (body.ids || []).filter((id) => typeof id === "string" && id.length > 0);
  if (ids.length === 0) {
    return NextResponse.json({ error: "Prázdny zoznam ID" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { error, count } = await sb
    .from("monitor_inzeraty")
    .delete({ count: "exact" })
    .in("id", ids);

  if (error) {
    console.error("[monitor/inzeraty] delete error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: count || 0 });
}
