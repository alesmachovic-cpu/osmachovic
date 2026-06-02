import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getUserScope } from "@/lib/scope";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

// GET /api/klienti/counts
// Vráti { [klient_id]: { obhliadky: n, nabery: n } } pre všetkých klientov firmy
export async function GET(req: NextRequest) {
  // P0 fix 2026-05-24: strict auth.
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const sb = getSupabaseAdmin();
  const scope = await getUserScope(auth.user.id);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });
  const companyId = scope.company_id;

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
