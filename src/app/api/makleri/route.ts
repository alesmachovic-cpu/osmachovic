import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const aktivny = req.nextUrl.searchParams.get("aktivny");
  let query = sb.from("makleri").select("id, meno, email, telefon, aktivny").order("meno");
  if (aktivny === "true") query = query.eq("aktivny", true);
  const { data, error } = await query;
  if (error) {
    console.error("[makleri] Supabase error:", error.message, "code:", error.code);
    // Return empty array — never 500, so callers' .map() never crashes
    return NextResponse.json([]);
  }
  return NextResponse.json(data ?? []);
}
