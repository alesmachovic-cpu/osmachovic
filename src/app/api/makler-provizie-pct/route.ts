import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const sb = getSupabaseAdmin();
  const maklerId = req.nextUrl.searchParams.get("makler_id");
  let query = sb.from("makler_provizie_pct").select("*");
  if (maklerId) query = query.eq("makler_id", maklerId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
