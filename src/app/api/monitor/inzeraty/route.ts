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
// Super-admin môže byť prihlásený cez Google (gmail) aj cez business email.
// Akceptujeme obe varianty (user.email alebo user.login_email z UI).
const SUPER_ADMIN_EMAILS = [
  "ales.machovic@gmail.com",
  "ales.machovic@vianema.eu",
  "ales@vianema.eu",
];

export async function DELETE(request: Request) {
  let body: { ids?: string[]; actorEmail?: string; actorLoginEmail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  const candidateEmails = [body.actorEmail, body.actorLoginEmail]
    .filter((e): e is string => typeof e === "string")
    .map((e) => e.toLowerCase());

  const isSuperAdmin = candidateEmails.some((e) => SUPER_ADMIN_EMAILS.includes(e));
  if (!isSuperAdmin) {
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
