/* ── AES-256-GCM šifrovanie dokumentov uložených v DB ────────
 *
 * Používame:
 *   - AES-256-GCM (authenticated encryption — chráni pred tampering)
 *   - 32-byte master key (base64) v env vare DOC_ENCRYPTION_KEY
 *   - Unikátny 12-byte IV (nonce) per každý dokument
 *
 * Formát uloženej hodnoty (string):
 *   "v1:" + base64(iv) + ":" + base64(authTag) + ":" + base64(ciphertext)
 *
 * Prefix "v1:" umožní neskôr prejsť na iný algoritmus bez breaking change
 * (čitateľ deteguje verziu a použije správny decode). */

import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const VERSION = "v1";

function getKey(): Buffer {
  const raw = process.env.DOC_ENCRYPTION_KEY;
  if (!raw) throw new Error("DOC_ENCRYPTION_KEY nie je nastavený v env");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`DOC_ENCRYPTION_KEY musí byť 32 bytes base64 (je ${key.length})`);
  }
  return key;
}

/** Zašifruje plaintext string (napr. base64 obsah PDF) do formátu "v1:IV:TAG:CT". */
export function encryptDocString(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

/** Odšifruje string ktorý vyzerá "v1:IV:TAG:CT". Ak nie je šifrovaný formát,
 *  vráti pôvodnú hodnotu (backward compat pre staré nezašifrované dokumenty). */
export function decryptDocString(stored: string): string {
  if (!stored || !stored.startsWith(`${VERSION}:`)) return stored;
  const parts = stored.split(":");
  if (parts.length !== 4) return stored;
  const [, ivB64, tagB64, ctB64] = parts;
  try {
    const key = getKey();
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const ct = Buffer.from(ctB64, "base64");
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString("utf8");
  } catch (e) {
    console.error("[cryptoDocs] decrypt failed:", String(e).slice(0, 200));
    throw new Error("Dokument sa nepodarilo odšifrovať (chybný kľúč alebo dáta)");
  }
}

/** Detekcia či je hodnota už zašifrovaná (prefix "v1:"). */
export function isEncrypted(value: string | null | undefined): boolean {
  return !!value && value.startsWith(`${VERSION}:`);
}
