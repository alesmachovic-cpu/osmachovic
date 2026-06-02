#!/usr/bin/env node
/**
 * API Auth Guard — static analysis pre src/app/api/**\/route.ts
 *
 * DVOJ-VRSTVOVÁ KONTROLA:
 *
 * TIER 1 — HARD FAIL (CI fail). Zabezpečuje že:
 *   a) VIANEMA_COMPANY_ID fallback pattern sa NIKDY nevráti (príčina P0 leak 24.5.).
 *   b) 11 sensitive endpointov ktoré sme manuálne fixli si udržia requireUser().
 *
 * TIER 2 — WARNING (report len). Vypíše ostatné endpointy bez requireUser ako
 *   "legacy debt" na postupné riešenie. Nezablokuje CI.
 *
 * Whitelist — routes ktoré SÚ zámerne verejné (auth, webhooks, cron, public utils).
 *
 * Vznik: 2026-06-02 po dvojkolovom security audite (P0 leaks na 11 endpointoch).
 * Cieľ: zabrániť že budúci agent (AI/človek) náhodne pridá VIANEMA fallback
 *       alebo odstráni requireUser() z dnešných sensitive routes.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const API_ROOT = "src/app/api";

// ───────────────────────────────────────────────────────────────────────────
// TIER 1 — HARD FAIL list: endpointy ktoré sme audit-fixli a MUSIA mať auth.
// Ak nový PR odstráni requireUser z týchto routes → CI fail.
// ───────────────────────────────────────────────────────────────────────────
const TIER1_MUST_HAVE_AUTH = new Set([
  // PR #11/#12 (security/tenant-isolation) — 24.5.2026
  "src/app/api/klienti/route.ts",
  "src/app/api/nehnutelnosti/route.ts",
  "src/app/api/faktury/route.ts",
  "src/app/api/dashboard/route.ts",
  // PR #13/#14 (security/tenant-isolation-2) — 2.6.2026
  "src/app/api/obhliadky/route.ts",
  "src/app/api/nabery/route.ts",
  "src/app/api/klienti/counts/route.ts",
  // PR #4-#9 (early security session) — 24.5.2026
  "src/app/api/audit/route.ts",
  "src/app/api/ulohy/route.ts",
  "src/app/api/klient-dokumenty/route.ts",
  "src/app/api/obchody/route.ts",
]);

// ───────────────────────────────────────────────────────────────────────────
// PUBLIC WHITELIST — routes ktoré sú zámerne verejné.
// Akýkoľvek nový public endpoint musí byť explicitne pridaný sem + komentár.
// ───────────────────────────────────────────────────────────────────────────
const PUBLIC_WHITELIST = new Set([
  // Auth flow — login/logout/forgot musia byť dostupné bez session
  "src/app/api/auth/login/route.ts",
  "src/app/api/auth/logout/route.ts",
  "src/app/api/auth/forgot/route.ts",
  "src/app/api/auth/reset/route.ts",
  "src/app/api/auth/google/route.ts",            // redirect to Google
  "src/app/api/auth/google/callback/route.ts",   // OAuth callback
  "src/app/api/auth/google/match/route.ts",      // overuje JWT, nie session
  "src/app/api/auth/2fa/verify/route.ts",        // verify s challenge tokenom
  "src/app/api/auth/session-bootstrap/route.ts", // legacy session bootstrap
  "src/app/api/auth/register/route.ts",          // registrácia nového usera

  // Verejné utility endpointy
  "src/app/api/locale/route.ts",                 // i18n preferences (cookie)
  "src/app/api/weather/route.ts",                // public weather proxy
  "src/app/api/ico-lookup/route.ts",             // FinStat lookup, public
  "src/app/api/ulica-search/route.ts",           // street autocomplete, public

  // Cron jobs — chránené cez CRON_SECRET header (vlastný mechanizmus)
  "src/app/api/cron/cleanup/route.ts",
  "src/app/api/cron/scrape/route.ts",
  "src/app/api/cron/api-status/route.ts",
  "src/app/api/cron/pravidelne-naklady/route.ts",
  "src/app/api/cron/lv-reminder/route.ts",
  "src/app/api/cron/volni-klienti/route.ts",
  "src/app/api/cron/foto-rotation/route.ts",
  "src/app/api/cron/monitor-daily/route.ts",
  "src/app/api/cron/qa-smoke/route.ts",
  "src/app/api/cron/daily-audit/route.ts",
  "src/app/api/cron/auto-uz-kupil/route.ts",

  // Webhooky — chránené signature verification
  "src/app/api/billing/webhook/route.ts",        // Stripe signature
  "src/app/api/push/subscribe/route.ts",         // VAPID — vlastný flow
]);

const HTTP_HANDLERS = ["GET", "POST", "PATCH", "DELETE", "PUT"];

function walkRoutes(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkRoutes(full, files);
    else if (entry === "route.ts" || entry === "route.tsx") files.push(full);
  }
  return files;
}

function findHandlerIssues(src, filePath) {
  const issues = [];
  for (const method of HTTP_HANDLERS) {
    const re = new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`);
    const match = re.exec(src);
    if (!match) continue;

    // Extract handler body
    let i = src.indexOf("{", match.index);
    if (i < 0) continue;
    let depth = 1;
    let j = i + 1;
    while (j < src.length && depth > 0) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") depth--;
      j++;
    }
    const head = src.slice(i, Math.min(j, i + 3000));

    if (!/requireUser\s*\(/.test(head)) {
      issues.push(method);
    }
  }
  return issues;
}

// ───────────────────────────────────────────────────────────────────────────
const routes = walkRoutes(API_ROOT);
const tier1Failures = [];   // HARD FAIL
const vianemaFailures = []; // HARD FAIL
const tier2Warnings = [];   // legacy debt, warning only

for (const filePath of routes) {
  const relPath = relative(process.cwd(), filePath);
  const src = readFileSync(filePath, "utf8");

  // VIANEMA pattern check — VŽDY, aj pre whitelisted routes.
  if (/let\s+\w*[Cc]ompany\w*\s*=\s*VIANEMA_COMPANY_ID/.test(src)) {
    vianemaFailures.push(relPath);
  }

  if (PUBLIC_WHITELIST.has(relPath)) continue;

  const methodsWithoutAuth = findHandlerIssues(src, filePath);
  if (methodsWithoutAuth.length === 0) continue;

  if (TIER1_MUST_HAVE_AUTH.has(relPath)) {
    tier1Failures.push({ route: relPath, methods: methodsWithoutAuth });
  } else {
    tier2Warnings.push({ route: relPath, methods: methodsWithoutAuth });
  }
}

// ───────────────────────────────────────────────────────────────────────────
let hardFail = false;

if (vianemaFailures.length > 0) {
  hardFail = true;
  console.error("✗ VIANEMA_COMPANY_ID fallback pattern detected (P0 leak class!):");
  for (const f of vianemaFailures) console.error(`    ${f}`);
  console.error("  Fix: použiť `requireUser(req)` + `getUserScope(auth.user.id)`.");
  console.error("");
}

if (tier1Failures.length > 0) {
  hardFail = true;
  console.error("✗ TIER 1 routes lost requireUser() (regression of audit fixes 24.5.+2.6.2026):");
  for (const f of tier1Failures) {
    console.error(`    ${f.route} — chýba auth v: ${f.methods.join(", ")}`);
  }
  console.error("  Tieto endpointy boli ručne fix-nuté po audite. NEodstraňuj requireUser bez konzultácie.");
  console.error("");
}

if (tier2Warnings.length > 0) {
  console.warn(`⚠ TIER 2: ${tier2Warnings.length} legacy routes bez requireUser() (warning, nie fail):`);
  for (const f of tier2Warnings.slice(0, 10)) {
    console.warn(`    ${f.route} (${f.methods.join(", ")})`);
  }
  if (tier2Warnings.length > 10) console.warn(`    ... a ${tier2Warnings.length - 10} ďalších`);
  console.warn("  Postupne pridať requireUser() alebo do PUBLIC_WHITELIST.");
  console.warn("");
}

if (hardFail) {
  console.error(`✗ API Auth Guard FAILED. Routes checked: ${routes.length}.`);
  process.exit(1);
}

console.log(`✓ API Auth Guard passed.`);
console.log(`  Routes checked: ${routes.length}`);
console.log(`  TIER 1 protected: ${TIER1_MUST_HAVE_AUTH.size}`);
console.log(`  Public whitelist: ${PUBLIC_WHITELIST.size}`);
console.log(`  TIER 2 legacy warnings: ${tier2Warnings.length}`);
process.exit(0);
