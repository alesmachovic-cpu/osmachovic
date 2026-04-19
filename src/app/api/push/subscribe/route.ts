import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * POST /api/push/subscribe
 * Body: { subscription: PushSubscriptionJSON, userId?: string }
 *
 * Uloží alebo aktualizuje push subscription pre aktuálneho usera.
 * Client Service Worker sa subscribuje cez pushManager.subscribe() a pošle
 * result sem. Endpoint + keys sú idempotentné (ON CONFLICT endpoint).
 */
export async function POST(request: Request) {
  let body: {
    subscription?: {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    userId?: string;
    userAgent?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: "Neúplný subscription objekt" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      user_id: body.userId || null,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: body.userAgent || null,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "endpoint", ignoreDuplicates: false }
  );

  if (error) {
    console.error("[push/subscribe] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/push/subscribe
 * Body: { endpoint: string }
 * Odhlási konkrétny endpoint (keď user vypne notifikácie).
 */
export async function DELETE(request: Request) {
  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }
  if (!body.endpoint) {
    return NextResponse.json({ error: "Chýba endpoint" }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  await sb.from("push_subscriptions").delete().eq("endpoint", body.endpoint);
  return NextResponse.json({ ok: true });
}
