import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getUserScope } from "@/lib/scope";
import { readSessionUserId } from "@/lib/auth/requireUser";
import { VIANEMA_COMPANY_ID } from "@/lib/auth/companyScope";

export const runtime = "nodejs";

// GET /api/klienti/counts
// Vráti { [klient_id]: { obhliadky: n, nabery: n } } pre všetkých klientov firmy
export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const userId = readSessionUserId(req);
  let companyId = VIANEMA_COMPANY_ID;
  if (userId) {
    const scope = await getUserScope(userId);
    if (scope?.company_id) companyId = scope.company_id;
  }

  const [obhliadkyRes, naberyRes] = await Promise.all([
    sb.from("obhliadky").select("predavajuci_klient_id").eq("company_id", companyId),
    sb.from("naberove_listy").select("klient_id").eq("company_id", companyId),
  ]);

  const counts: Record<string, { obhliadky: number; nabery: number }> = {};

  for (const o of obhliadkyRes.data ?? []) {
    const id = o.predavajuci_klient_id as string | null;
    if (!id) continue;
    if (!counts[id]) counts[id] = { obhliadky: 0, nabery: 0 };
    counts[id].obhliadky++;
  }

  for (const n of naberyRes.data ?? []) {
    const id = n.klient_id as string | null;
    if (!id) continue;
    if (!counts[id]) counts[id] = { obhliadky: 0, nabery: 0 };
    counts[id].nabery++;
  }

  return NextResponse.json(counts);
}
