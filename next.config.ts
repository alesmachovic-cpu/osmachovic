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
      // TASK 1 — Konsolidácia menu: staré URLs → nové tabové URLs
      // /volni-klienti zostáva (priame URL), ale aj nový alias cez /klienti?tab=volni
      // Tu len redirect-ujeme staré URLs do nového Klienti hubu:
      { source: "/kupujuci", destination: "/klienti?tab=kupujuci", permanent: false },
      { source: "/volni-klienti", destination: "/klienti?tab=volni", permanent: false },
      // Monitor & Analýza — /analyzy zlúčená do /monitor?tab=analyza
      { source: "/analyzy", destination: "/monitor?tab=analyza", permanent: false },
      { source: "/analyza", destination: "/monitor?tab=analyza", permanent: false },
      { source: "/analiza", destination: "/monitor?tab=analyza", permanent: false },
      // Kalkulátor & Matching — staré /kalkulator a /matching zlúčené do /nastroje
      { source: "/kalkulator", destination: "/nastroje?tab=kalkulator", permanent: false },
      { source: "/matching", destination: "/nastroje?tab=matching", permanent: false },
      // Operatíva — /naklady a /kalendar (a /obhliadky) zlúčené do /operativa
      { source: "/naklady", destination: "/operativa?tab=naklady", permanent: false },
      { source: "/kalendar", destination: "/operativa?tab=kalendar", permanent: false },
      { source: "/obhliadky", destination: "/operativa?tab=obhliadky", permanent: false },
    ];
  },
};

export default nextConfig;
