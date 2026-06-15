import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { requireReAuth } from "@/lib/auth/reAuth";
import { logAudit } from "@/lib/audit";
import { getStorageClient } from "@/lib/supabase-storage";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { applyWatermark } from "@/lib/watermark";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/fotky/watermark-batch
 *
 * Spätné dávkové watermarkovanie EXISTUJÚCICH portfolio fotiek (one-time).
 * Destruktívna admin operácia — preto role gate (majitel/platform_admin) +
 * re-auth + audit. Beží len na deployed dev (Storage = service role).
 *
 * Body: {
 *   mode: "backup" | "apply",
 *   offset?, limit?,           // chunking (limit ≤ 50, default 8) — Vercel timeout
 *   paths?: string[],          // explicitný zoznam (pre verify na 1 inzeráte)
 *   password? | code?,         // re-auth
 * }
 *
 * Bezpečné poradie (POVINNÉ):
 *  1) mode:"backup" — skopíruje inzerat-fotky → inzerat-fotky-orig (originály).
 *  2) mode:"apply"  — číta z inzerat-fotky-orig (čistý originál), vypáli
 *     watermark, upsert do inzerat-fotky. Idempotentné (re-run watermarkuje
 *     z čistého originálu, nikdy dvakrát). Ak originál v zálohe chýba → SKIP
 *     (nikdy newatermarkuje bez zálohy).
 *
 * Watermark je nevratný → "apply" spúšťať AŽ po overenej zálohe + verify na
 * 1 inzeráte (cez `paths`), s Alešom pri tom.
 */

const MAIN_BUCKET = "inzerat-fotky";
const ORIG_BUCKET = "inzerat-fotky-orig";

type Bucket = ReturnType<ReturnType<typeof getStorageClient>["storage"]["from"]>;

/** Rekurzívne vylistuj všetky .jpg cesty v buckete ({userId}/{inzeratId}/*.jpg). */
async function listAllJpgs(bucket: Bucket, prefix = "", acc: string[] = []): Promise<string[]> {
  const { data, error } = await bucket.list(prefix, { limit: 1000 });
  if (error) throw new Error(`list "${prefix}": ${error.message}`);
  for (const entry of data ?? []) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.name.toLowerCase().endsWith(".jpg")) acc.push(path);
    else await listAllJpgs(bucket, path, acc);  // folder → recurse
  }
  return acc;
}

/** Záloha jednej fotky main → orig (skip ak už zálohovaná). */
async function backupOne(mainB: Bucket, origB: Bucket, path: string): Promise<"copied" | "exists" | "error"> {
  const slash = path.lastIndexOf("/");
  const dir = slash >= 0 ? path.slice(0, slash) : "";
  const name = path.slice(slash + 1);
  const { data: present } = await origB.list(dir, { search: name, limit: 1 });
  if (present?.some(e => e.name === name)) return "exists";
  const { data: blob, error: dErr } = await mainB.download(path);
  if (dErr || !blob) return "error";
  const buf = Buffer.from(await blob.arrayBuffer());
  const { error: uErr } = await origB.upload(path, buf, { contentType: "image/jpeg", upsert: false });
  return uErr ? "error" : "copied";
}

/** Watermark jednej fotky: číta z orig (čistý) → upsert do main. */
async function applyOne(mainB: Bucket, origB: Bucket, path: string): Promise<"done" | "no_backup" | "error"> {
  const { data: blob, error: dErr } = await origB.download(path);
  if (dErr || !blob) return "no_backup";  // bez zálohy NErob nič
  let wm: Buffer;
  try {
    wm = await applyWatermark(Buffer.from(await blob.arrayBuffer()));
  } catch {
    return "error";
  }
  const { error: uErr } = await mainB.upload(path, wm, { contentType: "image/jpeg", upsert: true });
  return uErr ? "error" : "done";
}

export async function POST(req: NextRequest) {
  // Destruktívne → len majitel/platform_admin + re-auth + audit.
  const auth = await requireUser(req, { requireRole: ["majitel", "platform_admin"] });
  if (auth.error) return auth.error;

  let body: { mode?: string; offset?: number; limit?: number; paths?: string[]; password?: string; code?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  const mode = body.mode;
  if (mode !== "backup" && mode !== "apply") {
    return NextResponse.json({ error: 'mode musí byť "backup" alebo "apply"' }, { status: 400 });
  }

  const re = await requireReAuth({ userId: auth.user.id, password: body.password, code: body.code });
  if (!re.ok) return NextResponse.json({ error: re.error, reason: re.reason }, { status: re.status });

  const sb = getStorageClient();
  const mainB = sb.storage.from(MAIN_BUCKET);
  const origB = sb.storage.from(ORIG_BUCKET);

  // Cross-tenant guard: len fotky userov tejto firmy ({userId}/ prefix).
  const { data: companyUsers } = await getSupabaseAdmin()
    .from("users").select("id").eq("company_id", auth.user.company_id);
  const allowedUids = new Set((companyUsers ?? []).map((u: { id: string | number }) => String(u.id)));

  let all: string[];
  if (Array.isArray(body.paths) && body.paths.length) {
    all = body.paths.filter(p => allowedUids.has(p.split("/")[0]));
  } else {
    all = (await listAllJpgs(mainB)).filter(p => allowedUids.has(p.split("/")[0])).sort();
  }

  const offset = Number.isFinite(body.offset) ? Math.max(0, Number(body.offset)) : 0;
  const limit = Number.isFinite(body.limit) ? Math.min(50, Math.max(1, Number(body.limit))) : 8;
  const chunk = all.slice(offset, offset + limit);

  const res = { copied: 0, exists: 0, done: 0, no_backup: 0, error: 0, errors: [] as string[] };
  for (const p of chunk) {
    const r = mode === "backup" ? await backupOne(mainB, origB, p) : await applyOne(mainB, origB, p);
    res[r] += 1;
    if (r === "error" || r === "no_backup") res.errors.push(`${p}:${r}`);
  }

  const nextOffset = offset + limit < all.length ? offset + limit : null;
  await logAudit({
    action: "fotky.watermark_batch",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_type: "storage",
    detail: { mode, offset, limit, total: all.length, processed: chunk.length, copied: res.copied, done: res.done, errors: res.errors.length },
  });

  return NextResponse.json({ mode, total: all.length, processed: chunk.length, nextOffset, ...res });
}
