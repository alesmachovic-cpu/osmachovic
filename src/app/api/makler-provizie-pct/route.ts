import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const maklerId = req.nextUrl.searchParams.get("makler_id");
  let query = sb.from("makler_provizie_pct").select("*");
  if (maklerId) query = query.eq("makler_id", maklerId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
