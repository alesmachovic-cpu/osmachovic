import { NextRequest, NextResponse } from "next/server";
import { getStorageClient } from "@/lib/supabase-storage";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg" };

/**
 * POST /api/web/upload — FormData { file, siteId }
 * Uloží fotku do bucketu `web-fotky` (verejný) a vráti { url }.
 * Fotka je v prehliadači zmenšená (max 1600 px) — viď admin.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const form = await req.formData();
  const file = form.get("file");
  const siteId = String(form.get("siteId") || "spolocne").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!(file instanceof File)) return NextResponse.json({ error: "Chýba súbor" }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Povolené sú JPG, PNG, WEBP a SVG" }, { status: 400 });
  if (file.size > 6 * 1024 * 1024) return NextResponse.json({ error: "Súbor je väčší než 6 MB" }, { status: 413 });

  const path = `${siteId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXT[file.type]}`;
  const sb = getStorageClient();
  const bucket = sb.storage.from("web-fotky");
  const buf = new Uint8Array(await file.arrayBuffer());
  const { error } = await bucket.upload(path, buf, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data } = bucket.getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path });
}
