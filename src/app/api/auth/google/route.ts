import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/google";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/google/callback`;
  const authUrl = getGoogleAuthUrl(userId, redirectUri);

  return NextResponse.redirect(authUrl);
}
