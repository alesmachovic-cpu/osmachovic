import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { encryptToken } from "@/lib/crypto";

export const runtime = "nodejs";

/**
 * POST /api/admin-migrate/encrypt-tokens
 *
 * Jednorazová migrácia: zašifruje existujúce plain-text Google OAuth tokeny
 * v tabuľke users. Bezpečné spustiť opakovane — tokeny začínajúce "enc:" sa preskočia.
 *
 * Volanie: curl -X POST https://vianema.amgd.sk/api/admin-migrate/encrypt-tokens \
 *   -H "Authorization: Bearer <CRON_SECRET>"
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const { data: users, error } = await sb
    .from("users")
    .select("id, google_access_token, google_refresh_token")
    .not("google_refresh_token", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let encrypted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const user of users ?? []) {
    const accessRaw = user.google_access_token as string | null;
    const refreshRaw = user.google_refresh_token as string | null;

    const accessNeedsEnc = accessRaw && !accessRaw.startsWith("enc:");
    const refreshNeedsEnc = refreshRaw && !refreshRaw.startsWith("enc:");

    if (!accessNeedsEnc && !refreshNeedsEnc) { skipped++; continue; }

    const update: Record<string, string> = {};
    if (accessNeedsEnc) update.google_access_token = encryptToken(accessRaw!);
    if (refreshNeedsEnc) update.google_refresh_token = encryptToken(refreshRaw!);

    const { error: upErr } = await sb.from("users").update(update).eq("id", user.id);
    if (upErr) { errors.push(`${user.id}: ${upErr.message}`); }
    else encrypted++;
  }

  return NextResponse.json({ ok: true, encrypted, skipped, errors });
}
