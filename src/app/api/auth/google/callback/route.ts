import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, saveTokens } from "@/lib/google";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const userId = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    console.error("[google-callback] Google error:", error);
    return NextResponse.redirect(new URL(`/nastavenia?google=error&detail=${error}`, req.nextUrl.origin));
  }

  if (!code || !userId) {
    console.error("[google-callback] Missing code or userId");
    return NextResponse.redirect(new URL("/nastavenia?google=missing", req.nextUrl.origin));
  }

  try {
    const redirectUri = `${req.nextUrl.origin}/api/auth/google/callback`;
    console.log("[google-callback] Exchanging code, redirectUri:", redirectUri);
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    console.log("[google-callback] Got tokens, fetching userinfo");

    // Get user's Google email
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoRes.json();
    const googleEmail = userInfo.email || "";
    console.log("[google-callback] Google email:", googleEmail, "userId:", userId);

    await saveTokens(userId, tokens, googleEmail);
    console.log("[google-callback] Tokens saved successfully");

    return NextResponse.redirect(new URL("/nastavenia?google=ok", req.nextUrl.origin));
  } catch (e) {
    console.error("[google-callback] Error:", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.redirect(new URL(`/nastavenia?google=error&detail=${encodeURIComponent(msg)}`, req.nextUrl.origin));
  }
}
