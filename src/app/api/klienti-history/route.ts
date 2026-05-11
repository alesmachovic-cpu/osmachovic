import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * GET /api/klienti-history?from=ISO_DATE
 * Vráti záznamy z klienti_history od dátumu (from_makler_id, action, created_at).
 */
export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const from = req.nextUrl.searchParams.get("from");
  let query = sb.from("klienti_history").select("from_makler_id, action, created_at").order("created_at", { ascending: false });
  if (from) query = query.gte("created_at", from);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
