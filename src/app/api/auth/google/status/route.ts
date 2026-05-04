import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, isSuperAdmin } from "@/lib/auth/requireUser";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  // Default: pozri vlastný status. Super_admin môže pozerať iného cez ?userId=
  const queryUserId = req.nextUrl.searchParams.get("userId");
  let targetUserId = auth.user.id;
  if (queryUserId && queryUserId !== auth.user.id) {
    if (!isSuperAdmin(auth.user.role)) {
      return NextResponse.json({ error: "Nemáš oprávnenie" }, { status: 403 });
    }
    targetUserId = queryUserId;
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );

  const { data } = await sb
    .from("users")
    .select("google_email, google_refresh_token")
    .eq("id", targetUserId)
    .single();

  return NextResponse.json({
    connected: !!data?.google_refresh_token,
    email: data?.google_email || null,
  });
}
