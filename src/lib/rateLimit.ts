/**
 * rateLimit.ts — generický rate limiter pre auth endpointy.
 *
 * 🚨 FIX 2026-05-20 (P2):
 *   /api/auth/register, /forgot, /reset nemali žiadny rate limit. Útočník mohol:
 *     - register: vytvárať tisíce účtov spammingom
 *     - forgot: spočítať existujúce emaily (timing oracle) + spamovať obetí mailom
 *     - reset: brute-force token (ak má slabú entropy)
 *
 * Riešenie: lightweight in-memory rate limiter per-IP/per-identifier.
 * Pre väčšie deployments (multi-instance Vercel) by mal byť Redis-backed, ale
 * pre Vercel Hobby s jedným regiónom je in-memory dostačujúci a hlavne
 * zero-dependency.
 *
 * Bonus: ak Vercel funkcia stratí pamäť (cold start), limit sa resetuje —
 * to je acceptable tradeoff (útok bude detekovaný cez login_attempts tabuľku).
 */

type Bucket = { count: number; firstSeen: number };
const buckets = new Map<string, Bucket>();

// Periodicky čistíme expirované buckety (každých 5 min v memory).
let lastCleanup = 0;
function maybeCleanup(now: number) {
  if (now - lastCleanup < 5 * 60 * 1000) return;
  lastCleanup = now;
  for (const [key, b] of buckets) {
    if (now - b.firstSeen > 60 * 60 * 1000) buckets.delete(key); // 1h max retention
  }
}

export type RateLimitOptions = {
  /** Identifikátor (napr. IP, email, IP+email). */
  key: string;
  /** Max počet pokusov v okne. */
  max: number;
  /** Časové okno v sekundách. */
  windowSec: number;
};

// Discriminated union s explicit `?: undefined` na ok-vetve (TS narrowing).
export type RateLimitResult =
  | { ok: true; remaining: number; retryAfterSec?: undefined; error?: undefined }
  | { ok: false; retryAfterSec: number; error: string; remaining?: undefined };

export function rateLimit(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  maybeCleanup(now);

  const b = buckets.get(opts.key);
  const windowMs = opts.windowSec * 1000;

  if (!b || now - b.firstSeen > windowMs) {
    buckets.set(opts.key, { count: 1, firstSeen: now });
    return { ok: true, remaining: opts.max - 1 };
  }

  b.count++;
  if (b.count > opts.max) {
    const retryAfterSec = Math.ceil((b.firstSeen + windowMs - now) / 1000);
    return {
      ok: false,
      retryAfterSec,
      error: `Príliš veľa požiadaviek. Skús znova za ${Math.ceil(retryAfterSec / 60)} min.`,
    };
  }

  return { ok: true, remaining: opts.max - b.count };
}

/** Convenience helper pre auth-style routes — z requestu vyextrahuje IP. */
export function getRequestIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
         req.headers.get("x-real-ip") ||
         "unknown";
}

/**
 * Predpripravené presety pre konkrétne auth flows.
 *
 * Konzervatívne čísla — nezablokujú legitímnych userov, ale zastavia automatizované útoky.
 */
export const RATE_LIMITS = {
  REGISTER:    { max: 3,  windowSec: 60 * 60 },  // 3 registrácie / hodinu / IP
  FORGOT:      { max: 5,  windowSec: 15 * 60 },  // 5 forgot požiadaviek / 15 min / IP+email
  RESET:       { max: 10, windowSec: 15 * 60 },  // 10 reset POSTov / 15 min / IP
  LOGIN:       { max: 5,  windowSec: 15 * 60 },  // (už existuje DB-based, toto je defence-in-depth)
} as const;
