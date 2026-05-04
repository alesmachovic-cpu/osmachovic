/**
 * HMAC-signed session token pre crm_user authenticáciu.
 *
 * Existujúci AuthProvider ukladá user.id do localStorage["crm_user"] —
 * server tomu nikdy neveril. Tento modul pridáva server-side overovaný
 * cookie `crm_session` ktorý obsahuje:
 *   <userId>.<issuedAt>.<hmac(SESSION_SECRET, userId + issuedAt)>
 *
 * Pri prihlásení (/api/auth/login) sa vytvorí token + nastaví httponly cookie.
 * Server endpointy cez requireUser() overujú HMAC a vrátia user_id, ktorý
 * AuthProvider klient nemôže podvrhnúť.
 *
 * P0 minimal scope: ZACHOVANÁ backward compat — endpointy ktoré ešte
 * nemajú requireUser sa správajú ako predtým. Migrácia per-endpoint.
 */

import crypto from "node:crypto";

const COOKIE_NAME = "crm_session";
const TTL_DAYS = 30;

function getSecret(): string {
  // SESSION_SECRET je server-only env var. Ak chýba, používame fallback ktorý
  // aspoň zabraňuje úplne triviálnemu podvrhnutiu — ale produkcia ho MUSÍ mať.
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    console.error("[auth] SESSION_SECRET is missing or too short in production!");
  }
  return process.env.SESSION_SECRET || "dev-fallback-do-not-use-in-prod";
}

/** Vytvor HMAC token pre user.id. Vráti reťazec ktorý ide do cookie. */
export function signSession(userId: string, issuedAt: number = Date.now()): string {
  if (!userId) throw new Error("signSession: userId required");
  const payload = `${userId}.${issuedAt}`;
  const hmac = crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${hmac}`;
}

/** Overí HMAC + TTL. Vráti userId alebo null. */
export function verifySession(token: string | null | undefined): { userId: string; issuedAt: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, issuedAtStr, providedHmac] = parts;
  const issuedAt = Number(issuedAtStr);
  if (!userId || !Number.isFinite(issuedAt)) return null;
  // TTL kontrola
  const ageMs = Date.now() - issuedAt;
  if (ageMs > TTL_DAYS * 24 * 3600 * 1000) return null;
  if (ageMs < -60_000) return null; // tolerancia 1 min na clock skew
  // Constant-time HMAC compare
  const expectedHmac = crypto.createHmac("sha256", getSecret()).update(`${userId}.${issuedAt}`).digest("base64url");
  if (providedHmac.length !== expectedHmac.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(providedHmac), Buffer.from(expectedHmac))) return null;
  } catch {
    return null;
  }
  return { userId, issuedAt };
}

/** Cookie hodnoty pre Set-Cookie header. */
export function buildSessionCookieValue(userId: string): string {
  const token = signSession(userId);
  const maxAge = TTL_DAYS * 24 * 3600;
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Secure`;
}

export function buildLogoutCookieValue(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
