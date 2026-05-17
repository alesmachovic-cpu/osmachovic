import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getUserScope } from "@/lib/scope";
import { readSessionUserId } from "@/lib/auth/requireUser";

// Detail endpoint — vracia VŠETKY stĺpce vrátane podpis_data a podpis_meta,
// ktoré sú vylúčené z list endpointu /api/obhliadky kvôli payload size.
// Používa sa v /obhliadky/[id] detail page pre zobrazenie podpisu.

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sb = getSupabaseAdmin();

  // Scope check — user musí mať prístup ku company tejto obhliadky
  const sessionUserId = readSessionUserId(req);
  let companyFilter: string | null = null;
  if (sessionUserId) {
    const scope = await getUserScope(sessionUserId);
    if (scope) companyFilter = scope.company_id;
  }

  let q = sb.from("obhliadky").select("*").eq("id", id);
  if (companyFilter) q = q.eq("company_id", companyFilter);

  const { data, error } = await q.maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Obhliadka nenájdená" }, { status: 404 });

  return NextResponse.json({ obhliadka: data });
}
