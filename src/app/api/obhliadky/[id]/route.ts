import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";

// Detail endpoint — vracia VŠETKY stĺpce vrátane podpis_data a podpis_meta,
// ktoré sú vylúčené z list endpointu /api/obhliadky kvôli payload size.
// Používa sa v /obhliadky/[id] detail page pre zobrazenie podpisu.
//
// 🚨 P0 FIX 2026-05-20 (Release Gate, Security Auditor):
//   Pôvodne tento endpoint použil readSessionUserId (optional). Anon
//   request → companyFilter = null → SELECT bez scope → anyone s UUID
//   obhliadky dostane VŠETKY dáta vrátane podpis_data (base64), podpis_meta
//   (IP), kontakt kupujucich. GDPR breach.
//
//   Teraz: requireUser(strict) + povinný company_id filter.

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(req, { strict: true });
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sb = getSupabaseAdmin();

  const { data, error } = await sb
    .from("obhliadky")
    .select("*")
    .eq("id", id)
    .eq("company_id", auth.user.company_id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Obhliadka nenájdená" }, { status: 404 });

  return NextResponse.json({ obhliadka: data });
}
