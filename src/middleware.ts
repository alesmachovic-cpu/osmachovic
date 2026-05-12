import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_HOSTS = ["vianema.amgd.sk", "test.amgd.sk", "localhost:3000", "localhost:3001"];

export function middleware(request: NextRequest) {
  // Blokuj Vercel preview URL (funny-stonebraker-*.vercel.app atď.)
  const host = request.headers.get("host") || "";
  if (!ALLOWED_HOSTS.some(h => host.includes(h))) {
    return new NextResponse("Access denied", { status: 403 });
  }

  // Nonce-based CSP je zámerně vynechané — keď je nonce prítomný, prehliadač
  // ignoruje 'unsafe-inline', čo blokuje Next.js bootstrap inline scripty
  // a React sa nehydratuje. Použiváme 'unsafe-inline' bez nonce.
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://*.vercel-analytics.com https://*.vercel-insights.com",
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

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
