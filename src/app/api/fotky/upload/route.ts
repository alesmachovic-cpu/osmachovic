import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/fotky/upload
 *
 * Prijíma FormData s poliami:
 *   - "large" File (≤1600px JPEG q 0.85, resized v prehliadači)
 *   - "thumb" File (400px JPEG q 0.80)
 *   - "userId" string
 *   - "inzeratId" string | "draft"
 *   - "name" string — pôvodný názov (pre metadáta)
 *
 * Upload sa robí service role key (obchádza RLS) pretože CRM používa
 * custom auth (localStorage.crm_user, nie Supabase auth session).
 *
 * Vracia: { url, thumb, path, size }
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const large = form.get("large");
    const thumb = form.get("thumb");
    const userId = String(form.get("userId") || "");
    const inzeratId = String(form.get("inzeratId") || "draft");

    if (!(large instanceof File) || !(thumb instanceof File)) {
      return NextResponse.json({ error: "Missing files" }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const rnd = Math.random().toString(36).slice(2, 8);
    const ts = Date.now();
    const base = `${userId}/${inzeratId}/${ts}-${rnd}`;
    const pathLarge = `${base}.jpg`;
    const pathThumb = `${base}-thumb.jpg`;

    const sb = getSupabaseAdmin();
    const bucket = sb.storage.from("inzerat-fotky");

    const [largeBuf, thumbBuf] = await Promise.all([
      large.arrayBuffer().then(ab => new Uint8Array(ab)),
      thumb.arrayBuffer().then(ab => new Uint8Array(ab)),
    ]);

    const [upLarge, upThumb] = await Promise.all([
      bucket.upload(pathLarge, largeBuf, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
        upsert: false,
      }),
      bucket.upload(pathThumb, thumbBuf, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
        upsert: false,
      }),
    ]);

    if (upLarge.error) {
      return NextResponse.json({ error: `large: ${upLarge.error.message}` }, { status: 500 });
    }
    if (upThumb.error) {
      // rollback large
      await bucket.remove([pathLarge]).catch(() => {});
      return NextResponse.json({ error: `thumb: ${upThumb.error.message}` }, { status: 500 });
    }

    const { data: pubLarge } = bucket.getPublicUrl(pathLarge);
    const { data: pubThumb } = bucket.getPublicUrl(pathThumb);

    return NextResponse.json({
      url: pubLarge.publicUrl,
      thumb: pubThumb.publicUrl,
      path: pathLarge,
      size: largeBuf.byteLength,
    });
  } catch (e) {
    return NextResponse.json(
      { error: String((e as Error)?.message || e) },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/fotky/upload?path={path}
 * Zmaže aj large aj thumb podľa konvencie "base.jpg" + "base-thumb.jpg".
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");
    if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });
    const thumb = path.replace(/\.jpg$/i, "-thumb.jpg");
    const sb = getSupabaseAdmin();
    const { error } = await sb.storage.from("inzerat-fotky").remove([path, thumb]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: String((e as Error)?.message || e) },
      { status: 500 },
    );
  }
}
