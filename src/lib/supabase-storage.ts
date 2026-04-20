import { createHmac } from "node:crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase má dva formáty API kľúčov:
 *   1. Legacy JWT (eyJ...) — stále akceptovaný Storage API
 *   2. Nový "sb_secret_*" — Storage API ho zatiaľ odmieta ("Invalid Compact JWS")
 *
 * Tento projekt už migruje na nový formát, ale my pre Storage
 * potrebujeme JWT. Mint-ujeme si ho na servri z `SUPABASE_JWT_SECRET`
 * (legacy JWT secret, ktorý Supabase stále používa na verifikáciu).
 */

let cachedToken: string | null = null;
let cachedUntil = 0;

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Vráti (zo cache) service_role JWT platný ~1h, podpísaný legacy JWT secretom.
 * Throws ak `SUPABASE_JWT_SECRET` nie je nastavený.
 */
export function mintServiceRoleJwt(): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error("Missing SUPABASE_JWT_SECRET env var");
  }

  const now = Math.floor(Date.now() / 1000);
  // Cache 50 min (renew 10 min before expiry)
  if (cachedToken && now < cachedUntil - 600) return cachedToken;

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    role: "service_role",
    iss: "supabase",
    iat: now,
    exp: now + 3600,
  };

  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", secret).update(`${h}.${p}`).digest());

  cachedToken = `${h}.${p}.${sig}`;
  cachedUntil = now + 3600;
  return cachedToken;
}

/**
 * Supabase klient špecificky pre Storage operácie — používa JWT podpísaný
 * legacy secretom, nie nový `sb_secret_*` (ktorý Storage API odmieta).
 */
let _storageClient: SupabaseClient | null = null;
let _storageTokenSeen: string | null = null;

export function getStorageClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  const token = mintServiceRoleJwt();
  // Recreate client if token rotated (cache invalidation)
  if (!_storageClient || _storageTokenSeen !== token) {
    _storageClient = createClient(url, token, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    _storageTokenSeen = token;
  }
  return _storageClient;
}
