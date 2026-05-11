import crypto from "node:crypto";

const KEY_HEX = process.env.TOKEN_ENCRYPTION_KEY || "";

function getKey(): Buffer | null {
  if (!KEY_HEX || KEY_HEX.length !== 64) return null;
  return Buffer.from(KEY_HEX, "hex");
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext; // fallback: no key = no encryption (transition period)

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptToken(ciphertext: string): string {
  if (!ciphertext.startsWith("enc:")) return ciphertext; // plaintext (unencrypted legacy token)

  const key = getKey();
  if (!key) return ciphertext; // key not configured — return as-is

  const [, ivHex, tagHex, encHex] = ciphertext.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(encHex, "hex")).toString("utf8") + decipher.final("utf8");
}
