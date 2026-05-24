/**
 * uploadGuards.ts — defence-in-depth pre file upload endpointy.
 *
 * 🚨 FIX 2026-05-20 (P1 file upload DoS):
 *   Pôvodne /api/parse-doc, /api/parse-pdf, /api/fotky/upload nemali žiadny
 *   size limit ani MIME whitelist. Útočník mohol nahrať 10 GB súbor a
 *   vyvolať OOM kill na Vercel worker-i (cena + downtime) alebo zaplatiť
 *   AI tokens pre veľký dokument na náš účet.
 *
 *   Toto modul poskytuje 3 čisté guards:
 *     - assertFileSize  : kontrola size pred načítaním do RAM (cez File.size).
 *     - assertMime      : whitelist MIME types.
 *     - assertFileCount : max počet súborov v jednom POST.
 *
 *   Limits vychádzajú z Vercel Hobby plan limitov + reálnych use-case veľkostí.
 */

export const UPLOAD_LIMITS = {
  /** Max 1 PDF / DOCX pre parse-doc / parse-pdf. Reálne LV-čka majú 1-5 MB. */
  PARSE_DOC_MAX_BYTES: 20 * 1024 * 1024,        // 20 MB
  /** Max 1 fotka — Vercel Hobby payload limit je 4.5 MB, dáme 10 MB s istotou. */
  PHOTO_MAX_BYTES: 10 * 1024 * 1024,            // 10 MB
  /** Max počet fotiek v jednom batch POST-e. */
  PHOTO_MAX_COUNT: 25,
} as const;

export const ALLOWED_DOC_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword",                                                       // .doc (legacy)
]);

export const ALLOWED_PHOTO_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

// Discriminated union s explicit `?: undefined` na ok-vetve — zaisťuje že TS
// správne zúži typ po `if (!result.ok)` (lekcia z analyze-url SSRF fixu).
export type GuardError = { ok: false; status: number; error: string };
export type GuardOk = { ok: true; status?: undefined; error?: undefined };
export type GuardResult = GuardOk | GuardError;

/** Skontroluje veľkosť `File` proti limitu. Voláme PRED `file.arrayBuffer()`. */
export function assertFileSize(file: File, maxBytes: number): GuardResult {
  if (typeof file.size !== "number") {
    return { ok: false, status: 400, error: "Neznáma veľkosť súboru" };
  }
  if (file.size <= 0) {
    return { ok: false, status: 400, error: "Prázdny súbor" };
  }
  if (file.size > maxBytes) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    const limitMb = (maxBytes / 1024 / 1024).toFixed(0);
    return {
      ok: false,
      status: 413,
      error: `Súbor ${file.name} je príliš veľký (${mb} MB). Maximum je ${limitMb} MB.`,
    };
  }
  return { ok: true };
}

/** MIME whitelist. Niektoré klienti pošlú prázdne `type` → fallback cez príponu. */
export function assertMime(file: File, allowed: Set<string>): GuardResult {
  const mime = (file.type || "").toLowerCase();
  if (mime && allowed.has(mime)) return { ok: true };

  // Fallback cez príponu (Safari niekedy nepošle MIME).
  const name = (file.name || "").toLowerCase();
  const extToMime: Record<string, string> = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".heic": "image/heic",
    ".heif": "image/heif",
  };
  for (const ext of Object.keys(extToMime)) {
    if (name.endsWith(ext) && allowed.has(extToMime[ext])) return { ok: true };
  }

  return {
    ok: false,
    status: 415,
    error: `Nepodporovaný typ súboru: ${mime || "neznámy"} (${file.name})`,
  };
}

/** Počet súborov v batch upload-e. */
export function assertFileCount(files: File[], maxCount: number): GuardResult {
  if (files.length === 0) {
    return { ok: false, status: 400, error: "Žiadny súbor" };
  }
  if (files.length > maxCount) {
    return {
      ok: false,
      status: 413,
      error: `Maximum ${maxCount} súborov v jednej dávke (pokus o ${files.length}).`,
    };
  }
  return { ok: true };
}
