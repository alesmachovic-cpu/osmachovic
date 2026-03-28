import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ connected: false });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );

  const { data } = await sb
    .from("users")
    .select("google_email, google_refresh_token")
    .eq("id", userId)
    .single();

  return NextResponse.json({
    connected: !!data?.google_refresh_token,
    email: data?.google_email || null,
  });
}
