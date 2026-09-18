import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sb } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg" };

/** POST /api/upload FormData { file, siteId } → { url } (bucket weby-fotky, verejný). */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const form = await req.formData();
  const file = form.get("file");
  const siteId = String(form.get("siteId") || "spolocne").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!(file instanceof File)) return NextResponse.json({ error: "Chýba súbor" }, { status: 400 });
  if (!ALLOWED[file.type]) return NextResponse.json({ error: "Povolené sú JPG, PNG, WEBP a SVG" }, { status: 400 });
  if (file.size > 6 * 1024 * 1024) return NextResponse.json({ error: "Súbor je väčší než 6 MB" }, { status: 413 });
  const path = `${siteId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ALLOWED[file.type]}`;
  const bucket = sb().storage.from("weby-fotky");
  const { error } = await bucket.upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: bucket.getPublicUrl(path).data.publicUrl, path });
}
