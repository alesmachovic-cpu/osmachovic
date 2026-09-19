/**
 * Prihlasovacia session: httpOnly cookie `weby_session` = <userId>.<vydané>.<HMAC>.
 * Podpisuje sa SESSION_SECRET (server-only env). Platnosť 30 dní.
 */
import crypto from "node:crypto";

export const COOKIE = "weby_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET nie je nastavený");
    return "dev-only-secret-change-me";
  }
  return s;
}

export function sign(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const mac = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function verify(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, ts, mac] = parts;
  const expected = crypto.createHmac("sha256", secret()).update(`${userId}.${ts}`).digest("base64url");
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  if (Date.now() - Number(ts) > TTL_MS) return null;
  return userId;
}

export function cookieValue(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL_MS / 1000}${secure}`;
}

export function logoutCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
