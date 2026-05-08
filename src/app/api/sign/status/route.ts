import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * GET /api/sign/status?entity_type=naber|objednavka&entity_id=X
 * Vráti či bola entita podpísaná (cez SMS alebo akokoľvek inak).
 * Použité v UI na poll po odoslaní SMS — keď klient podpíše, modal sa zavre.
 */
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("entity_type");
  const id = req.nextUrl.searchParams.get("entity_id");
  if (!t || !id) return NextResponse.json({ error: "params required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  if (t === "naber") {
    const { data } = await sb.from("naberove_listy").select("podpis_data, podpis_datum").eq("id", id).maybeSingle();
    return NextResponse.json({ signed: !!data?.podpis_data, signed_at: data?.podpis_datum });
  }
  if (t === "objednavka") {
    const { data } = await sb.from("objednavky").select("podpis, updated_at").eq("id", id).maybeSingle();
    return NextResponse.json({ signed: !!data?.podpis, signed_at: data?.updated_at });
  }
  return NextResponse.json({ error: "unknown entity_type" }, { status: 400 });
}
