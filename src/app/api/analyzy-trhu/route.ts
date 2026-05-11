import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const klientId = req.nextUrl.searchParams.get("klient_id");
  let query = sb.from("analyzy_trhu").select("*").order("created_at", { ascending: false });
  if (klientId) query = query.eq("klient_id", klientId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
