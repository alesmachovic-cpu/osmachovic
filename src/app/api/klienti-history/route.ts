import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

/**
 * GET /api/klienti-history?from=ISO_DATE
 *
 * 🚨 FIX 2026-05-20 (P1 cross-tenant leak):
 *   Pôvodne endpoint nemal auth ani company filter → každý anonymný request
 *   vracal celú audit históriu naprieč všetkými firmami.
 *
 *   Teraz: requireUser + filter na klient.company_id cez join cez klient_id.
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const sb = getSupabaseAdmin();

  // 1) Získaj set klient_id pre danú firmu (multi-tenant scope).
  const { data: klienti } = await sb
    .from("klienti")
    .select("id")
    .eq("company_id", auth.user.company_id);
  const klientIds = (klienti ?? []).map(k => k.id);
  if (klientIds.length === 0) return NextResponse.json([]);

  const from = req.nextUrl.searchParams.get("from");
  let query = sb
    .from("klienti_history")
    .select("from_makler_id, action, created_at, klient_id")
    .in("klient_id", klientIds)
    .order("created_at", { ascending: false });
  if (from) query = query.gte("created_at", from);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
