import type { NextConfig } from "next";

/**
 * HTTP security headers — defense-in-depth proti XSS, clickjacking, MIME sniffing,
 * leak referrer info. Aplikuje sa na všetky routes.
 */
const securityHeaders = [
  // Prevent MIME sniffing (XSS vector)
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Prevent clickjacking — nikto nemôže embedovať appku do iframe
  { key: "X-Frame-Options", value: "DENY" },
  // Referrer policy — chráni citlivé URL query params pred leakom
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Force HTTPS for 2 years (HSTS), vrátane subdomén
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Permissions policy — vypni features ktoré appka nepotrebuje
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // Premenovanie: /odklik → /volni-klienti (zachová staré bookmarks)
      { source: "/odklik", destination: "/volni-klienti", permanent: true },
    ];
  },
};

export default nextConfig;
