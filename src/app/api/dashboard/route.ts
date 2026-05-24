import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getUserScope } from "@/lib/scope";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

/**
 * GET /api/dashboard?user_id=X
 * Returns dashboard statistics for the logged-in user.
 * Uses service_role key → bypasses RLS.
 *
 * P0 fix 2026-05-24: strict auth + IDOR guard — pred fixom server akceptoval
 * ľubovoľný user_id z query, čím sa dal pozrieť dashboard ktoréhokoľvek
 * makléra (vrátane súm provízií).
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  // IDOR guard — len ja na svoj dashboard; admin/super_admin na kohokoľvek
  if (userId !== auth.user.id && auth.user.role !== "platform_admin" && auth.user.role !== "super_admin") {
    return NextResponse.json({ error: "Nemáš prístup k cudziemu dashboardu" }, { status: 403 });
  }

  const sb = getSupabaseAdmin();
  const scope = await getUserScope(userId);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

  // 🚨 Cross-tenant filter: každý query musí ísť cez addCompanyAndMaklerFilter,
  // ktorý PRIDÁ company_id (multi-tenant scope) + voliteľne makler_id (vlastník).
  const companyId = scope.company_id;
  const addCompanyAndMaklerFilter = <T extends ReturnType<ReturnType<typeof sb.from>["select"]>>(q: T, addMakler: boolean = true): T => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let scoped = (q as any).eq("company_id", companyId) as T;
    if (addMakler && !scope.isAdmin && scope.makler_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scoped = (scoped as any).eq("makler_id", scope.makler_id) as T;
    }
    return scoped;
  };
  const addMaklerFilter = addCompanyAndMaklerFilter;

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
    sb.from("naberove_listy").select("*", { count: "exact", head: true }).eq("company_id", companyId).gte("created_at", monthStart),
    sb.from("naberove_listy").select("*", { count: "exact", head: true }).eq("company_id", companyId).gte("created_at", monthStart).eq("zmluva", true),
    sb.from("naberove_listy").select("*", { count: "exact", head: true }).eq("company_id", companyId),
    addMaklerFilter(sb.from("nehnutelnosti").select("*", { count: "exact", head: true }).neq("stav", "predane")),
    addMaklerFilter(sb.from("nehnutelnosti").select("*", { count: "exact", head: true }).eq("stav", "predane")),
    sb.from("objednavky").select("*", { count: "exact", head: true }).eq("company_id", companyId),
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
