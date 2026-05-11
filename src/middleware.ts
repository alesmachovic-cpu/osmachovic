import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function middleware(request: NextRequest) {
  const nonce = generateNonce();

  const csp = [
    "default-src 'self'",
    // nonce pre Next.js inline bootstrap scripts; unsafe-inline ako fallback pre staršie browsery
    `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' https://*.vercel-analytics.com https://*.vercel-insights.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://generativelanguage.googleapis.com https://api.resend.com https://*.googleapis.com https://api.openai.com https://accounts.google.com https://*.vercel-insights.com https://challenges.cloudflare.com",
    "frame-src 'self' https://accounts.google.com https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
