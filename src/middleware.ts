import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Stránky ktoré sú dostupné aj pri pozastavenom účte
const BILLING_EXEMPT = [
  "/nastavenia",
  "/api/billing",
  "/api/auth",
  "/api/locale",
  "/api/admin",
  "/admin",
];

function isBillingExempt(pathname: string): boolean {
  return BILLING_EXEMPT.some(p => pathname.startsWith(p));
}

const ALLOWED_HOSTS = ["vianema.amgd.sk", "dev.amgd.sk", "localhost:3000", "localhost:3001"];

// Vercel nastavuje x-forwarded-host na skutočný host požiadavky (aj pri internom
// routingu), zatiaľ čo `host` header môže byť prepísaný na kanonickú doménu.
// Blokujeme ak ANI jeden z nich nie je v ALLOWED_HOSTS.
function isAllowedHost(req: NextRequest): boolean {
  const host = req.headers.get("host") || "";
  const forwarded = req.headers.get("x-forwarded-host") || "";
  const candidates = [host, forwarded].filter(Boolean);
  if (candidates.length === 0) return false;
  return candidates.every(h => ALLOWED_HOSTS.some(a => h.includes(a)));
}

// Cesty ktoré majú vlastnú autentifikáciu (CRON_SECRET, OAuth callback) a
// nesmú byť za Basic Auth na dev.amgd.sk — inak by sa Vercel cron jobs ani
// Google OAuth callback nedostali do appky.
const DEV_BASIC_AUTH_EXEMPT = [
  "/api/cron/",
  "/api/auth/google/callback",
  "/auth/callback",
];

function isDevBasicAuthExempt(pathname: string): boolean {
  return DEV_BASIC_AUTH_EXEMPT.some(p => pathname.startsWith(p));
}

function isDevHost(req: NextRequest): boolean {
  const host = req.headers.get("host") || "";
  const forwarded = req.headers.get("x-forwarded-host") || "";
  return host.includes("dev.amgd.sk") || forwarded.includes("dev.amgd.sk");
}

export function middleware(request: NextRequest) {
  // Blokuj Vercel preview URL (funny-stonebraker-*.vercel.app atď.)
  if (!isAllowedHost(request)) {
    return new NextResponse("Access denied", { status: 403 });
  }

  const { pathname } = request.nextUrl;

  // 🔒 Dev environment Basic Auth — bráni botom skenovať dev.amgd.sk.
  // Aktívne IBA na dev.amgd.sk, IBA ak je nastavený `DEV_BASIC_AUTH_PW` env var.
  // Whitelist: cron jobs (CRON_SECRET) + OAuth callback (Google redirect).
  if (isDevHost(request) && !isDevBasicAuthExempt(pathname)) {
    const pw = process.env.DEV_BASIC_AUTH_PW;
    if (pw) {
      const authHeader = request.headers.get("authorization") || "";
      const expected = `Basic ${Buffer.from(`dev:${pw}`).toString("base64")}`;
      if (authHeader !== expected) {
        return new NextResponse("Authentication required (dev environment)", {
          status: 401,
          headers: { "WWW-Authenticate": 'Basic realm="dev.amgd.sk"' },
        });
      }
    }
  }

  // Billing guard — ak firma má is_active=false, presmeruj na billing stránku.
  // Cookie crm_billing=suspended nastaví /api/auth/login a /api/auth/google/match.
  const billing = request.cookies.get("crm_billing")?.value;
  if (billing === "suspended" && !isBillingExempt(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/nastavenia";
    url.search = "?tab=billing&suspended=1";
    return NextResponse.redirect(url);
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
    "frame-src 'self' blob: https://accounts.google.com https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
