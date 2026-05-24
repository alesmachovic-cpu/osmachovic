import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

/**
 * GET /api/klienti/history?klient_id=X
 *
 * Vráti audit history konkrétneho klienta z `klienti_history` + JOIN na
 * makléra (z/do) + JOIN na user (kto vykonal akciu).
 *
 * 🚨 FIX 2026-05-20 (P1 cross-tenant leak): requireUser + over že klient
 * patrí do company auth-usera. Inak 403.
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const klient_id = req.nextUrl.searchParams.get("klient_id");
  if (!klient_id) return NextResponse.json({ error: "klient_id required" }, { status: 400 });

  const sb = getSupabaseAdmin();

  // P1 cross-tenant guard.
  const { data: kl } = await sb
    .from("klienti")
    .select("company_id")
    .eq("id", klient_id)
    .maybeSingle();
  if (!kl) return NextResponse.json({ error: "Klient nenájdený" }, { status: 404 });
  if (kl.company_id !== auth.user.company_id && auth.user.role !== "platform_admin") {
    return NextResponse.json({ error: "Klient patrí do inej firmy" }, { status: 403 });
  }
  const { data, error } = await sb
    .from("klienti_history")
    .select("id, action, dovod, from_makler_id, to_makler_id, by_user_id, meta, created_at")
    .eq("klient_id", klient_id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Resolvuj makler_id → meno + by_user_id → meno
  const maklerIds = new Set<string>();
  const userIds = new Set<string>();
  for (const h of data || []) {
    if (h.from_makler_id) maklerIds.add(String(h.from_makler_id));
    if (h.to_makler_id) maklerIds.add(String(h.to_makler_id));
    if (h.by_user_id) userIds.add(String(h.by_user_id));
  }
  const [{ data: makleri }, { data: users }] = await Promise.all([
    maklerIds.size > 0
      ? sb.from("makleri").select("id, meno").in("id", Array.from(maklerIds))
      : Promise.resolve({ data: [] }),
    userIds.size > 0
      ? sb.from("users").select("id, name").in("id", Array.from(userIds))
      : Promise.resolve({ data: [] }),
  ]);
  const maklerMap: Record<string, string> = {};
  for (const m of makleri || []) maklerMap[String(m.id)] = String(m.meno);
  const userMap: Record<string, string> = {};
  for (const u of users || []) userMap[String(u.id)] = String(u.name);

  const enriched = (data || []).map(h => ({
    ...h,
    from_makler_name: h.from_makler_id ? maklerMap[String(h.from_makler_id)] || null : null,
    to_makler_name: h.to_makler_id ? maklerMap[String(h.to_makler_id)] || null : null,
    by_user_name: h.by_user_id ? userMap[String(h.by_user_id)] || null : null,
  }));

  return NextResponse.json({ history: enriched });
}
