import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, saveTokens } from "@/lib/google";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const userId = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/nastavenia?google=error", req.nextUrl.origin));
  }

  if (!code || !userId) {
    return NextResponse.redirect(new URL("/nastavenia?google=missing", req.nextUrl.origin));
  }

  try {
    const redirectUri = `${req.nextUrl.origin}/api/auth/google/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    // Get user's Google email
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoRes.json();
    const googleEmail = userInfo.email || "";

    await saveTokens(userId, tokens, googleEmail);

    return NextResponse.redirect(new URL("/nastavenia?google=ok", req.nextUrl.origin));
  } catch (e) {
    console.error("[google-callback]", e);
    return NextResponse.redirect(new URL("/nastavenia?google=error", req.nextUrl.origin));
  }
}
