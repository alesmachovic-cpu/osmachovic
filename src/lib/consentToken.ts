import crypto from "crypto";

/**
 * Stateless HMAC token pre verejný „chcem zostať" link v consent-refresh maili.
 * Token nesie klient_id + purpose + expiráciu, podpísaný SESSION_SECRET.
 * Nepotrebuje tabuľku tokenov — confirm endpoint si ho overí sám.
 */
const SECRET = process.env.SESSION_SECRET || "";

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function signConsentToken(klientId: string, purpose: string, ttlDays = 60): string {
  const payload = b64url(Buffer.from(JSON.stringify({
    k: klientId,
    p: purpose,
    e: Date.now() + ttlDays * 24 * 60 * 60 * 1000,
  })));
  const sig = b64url(crypto.createHmac("sha256", SECRET).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyConsentToken(token: string): { klientId: string; purpose: string } | null {
  if (!SECRET || !token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = b64url(crypto.createHmac("sha256", SECRET).update(payload).digest());
  // timing-safe porovnanie
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(fromB64url(payload).toString("utf8")) as { k: string; p: string; e: number };
    if (!data.k || !data.p || typeof data.e !== "number" || Date.now() > data.e) return null;
    return { klientId: data.k, purpose: data.p };
  } catch {
    return null;
  }
}
