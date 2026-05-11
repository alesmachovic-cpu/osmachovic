import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getUserScope } from "@/lib/scope";

export const runtime = "nodejs";

/**
 * GET /api/dashboard?user_id=X
 * Returns dashboard statistics for the logged-in user.
 * Uses service_role key → bypasses RLS.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const scope = await getUserScope(userId);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

  const addMaklerFilter = <T extends ReturnType<ReturnType<typeof sb.from>["select"]>>(q: T): T => {
    if (scope.isAdmin || !scope.makler_id) return q;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (q as any).eq("makler_id", scope.makler_id) as T;
  };

  const [
    { count: kCount },
    { count: nCount },
    { data: recentK },
    { data: recentN },
    { data: monthlyK },
    { data: yearlyK },
    { count: naberyCount },
    { count: zmluvyCount },
    { count: naberyTotal },
    { count: inzeratyCount },
    { count: predaneCount },
    { count: objednavkyCount },
  ] = await Promise.all([
    addMaklerFilter(sb.from("klienti").select("*", { count: "exact", head: true })),
    addMaklerFilter(sb.from("nehnutelnosti").select("*", { count: "exact", head: true })),
    addMaklerFilter(sb.from("klienti").select("id,meno,status,created_at").order("created_at", { ascending: false }).limit(5)),
    addMaklerFilter(sb.from("nehnutelnosti").select("id,nazov,cena,created_at").order("created_at", { ascending: false }).limit(5)),
    addMaklerFilter(sb.from("klienti").select("proviziaeur").gte("created_at", monthStart)),
    addMaklerFilter(sb.from("klienti").select("proviziaeur").gte("created_at", yearStart)),
    sb.from("naberove_listy").select("*", { count: "exact", head: true }).gte("created_at", monthStart),
    sb.from("naberove_listy").select("*", { count: "exact", head: true }).gte("created_at", monthStart).eq("zmluva", true),
    sb.from("naberove_listy").select("*", { count: "exact", head: true }),
    addMaklerFilter(sb.from("nehnutelnosti").select("*", { count: "exact", head: true }).neq("stav", "predane")),
    addMaklerFilter(sb.from("nehnutelnosti").select("*", { count: "exact", head: true }).eq("stav", "predane")),
    sb.from("objednavky").select("*", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    kCount: kCount ?? 0,
    nCount: nCount ?? 0,
    recentK: recentK ?? [],
    recentN: recentN ?? [],
    monthlyK: monthlyK ?? [],
    yearlyK: yearlyK ?? [],
    naberyCount: naberyCount ?? 0,
    zmluvyCount: zmluvyCount ?? 0,
    naberyTotal: naberyTotal ?? 0,
    inzeratyCount: inzeratyCount ?? 0,
    predaneCount: predaneCount ?? 0,
    objednavkyCount: objednavkyCount ?? 0,
  });
}
