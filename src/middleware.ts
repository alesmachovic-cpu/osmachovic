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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // Blokuj Vercel preview URL (funny-stonebraker-*.vercel.app atď.)
  if (!isAllowedHost(request)) {
    // P1 fix 2026-05-24: API musí vždy JSON, nie HTML.
    if (isApi) {
      return NextResponse.json({ error: "Access denied", code: "FORBIDDEN_HOST" }, { status: 403 });
    }
    return new NextResponse("Access denied", { status: 403 });
  }

  // Billing guard — ak firma má is_active=false, presmeruj na billing stránku.
  // Cookie crm_billing=suspended nastaví /api/auth/login a /api/auth/google/match.
  const billing = request.cookies.get("crm_billing")?.value;
  if (billing === "suspended" && !isBillingExempt(pathname)) {
    // P1 fix 2026-05-24: API musí vrátiť JSON 402 (Payment Required), nie HTML redirect.
    // Inak API klienti / monitoring dostane HTML login page namiesto strukturovaného erroru.
    if (isApi) {
      return NextResponse.json({
        error: "Účet je pozastavený (billing)",
        code: "ACCOUNT_SUSPENDED",
      }, { status: 402 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/nastavenia";
    url.search = "?tab=billing&suspended=1";
    return NextResponse.redirect(url);
  }

  // 🔒 2FA enforcement — admin bez 2FA (cookie crm_2fa=setup, nastaví login/google-match)
  // → presmeruj na povinný setup. Len HTML navigácia; API prechádza (chránené requireUser).
  // Exempt: setup page samotná + /auth (OAuth callback) — inak by sa flow zacyklil/rozbil.
  const twoFa = request.cookies.get("crm_2fa")?.value;
  if (twoFa === "setup" && !isApi
      && !pathname.startsWith("/nastavenia/security")
      && !pathname.startsWith("/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/nastavenia/security";
    url.search = "?setup2fa=1";
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
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
