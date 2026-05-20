/**
 * totp.ts — RFC 6238 TOTP implementácia (zero-dependency, Node crypto).
 *
 * Prečo vlastná implementácia:
 *   CLAUDE.md zakazuje pridávať npm packages bez konzultácie. RFC 6238 TOTP
 *   je ~50 riadkov cez Node `crypto` — radšej ako pridať otplib (3-4 deps).
 *
 * Compatible with: Google Authenticator, Authy, 1Password, Bitwarden,
 *                  Microsoft Authenticator, Aegis Authenticator.
 *
 * Algoritmus: HMAC-SHA1, 6 cifier, 30s krok, 1-krok tolerancia (±30s).
 */

import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; // RFC 4648 base32 (žiadne 0/1/8/9 pre čitateľnosť)

/** Vygeneruje cryptographically random base32 secret (default 32 znakov = 160 bits). */
export function generateSecret(length: number = 32): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** Base32 decode (RFC 4648). */
function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const c of clean) {
    const idx = ALPHABET.indexOf(c);
    if (idx < 0) continue;
    buffer = (buffer << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

/** Vypočíta TOTP kód pre daný čas (default = now). */
export function totp(secret: string, atSec: number = Math.floor(Date.now() / 1000)): string {
  const step = 30;
  const counter = Math.floor(atSec / step);

  // 8-byte counter as big-endian
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter), 0);

  const key = base32Decode(secret);
  const hmac = crypto.createHmac("sha1", key).update(counterBuf).digest();

  // Dynamic truncation (RFC 4226)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(code % 1_000_000).padStart(6, "0");
}

/**
 * Overí TOTP kód s ±1 step tolerance (±30s). Vracia counter ktorý matchol
 * alebo null. Counter sa ukladá do `users.totp_last_used_counter` aby sa
 * zabránilo replay attacku (rovnaký kód nevie byť použitý znova).
 */
// Discriminated union s explicit `?: undefined` na ok-vetve (TS narrowing).
export type VerifyTotpResult =
  | { ok: true; counter: number; reason?: undefined }
  | { ok: false; reason: string; counter?: undefined };

export function verifyTotp(
  secret: string,
  code: string,
  options?: { lastUsedCounter?: number | null; window?: number },
): VerifyTotpResult {
  const cleanCode = (code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleanCode)) return { ok: false, reason: "invalid_format" };

  const window = options?.window ?? 1;
  const nowSec = Math.floor(Date.now() / 1000);
  const currentCounter = Math.floor(nowSec / 30);

  for (let i = -window; i <= window; i++) {
    const counter = currentCounter + i;
    if (options?.lastUsedCounter != null && counter <= options.lastUsedCounter) {
      continue; // replay protection
    }
    const expected = totp(secret, counter * 30);
    if (timingSafeEqual(cleanCode, expected)) {
      return { ok: true, counter };
    }
  }
  return { ok: false, reason: "mismatch_or_replay" };
}

/** Constant-time string compare (zabráni timing attacku na code). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Vytvorí otpauth:// URI pre QR code (Google Authenticator, Authy, atď.).
 * Issuer = "VIANEMA Real" (alebo company name).
 * Account = email užívateľa.
 */
export function buildOtpAuthUri(opts: {
  secret: string;
  account: string;
  issuer?: string;
}): string {
  const issuer = encodeURIComponent(opts.issuer || "VIANEMA Real");
  const account = encodeURIComponent(opts.account);
  const label = `${issuer}:${account}`;
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer: opts.issuer || "VIANEMA Real",
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Vygeneruje N náhodných backup codes vo formáte "XXXX-XXXX" (alfanumerické). */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = crypto.randomBytes(5);
    const left = bytes.subarray(0, 2).toString("hex").toUpperCase();   // 4 znaky
    const right = bytes.subarray(2, 4).toString("hex").toUpperCase();  // 4 znaky
    codes.push(`${left}-${right}`);
  }
  return codes;
}
