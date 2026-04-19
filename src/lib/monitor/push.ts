/* ── Web Push notifikácie pre monitor + ostatné automatické eventy ── */

import webpush from "web-push";
import type { ScrapedInzerat } from "./types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function ensureVapid() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const prv = process.env.VAPID_PRIVATE_KEY;
  const sub = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!pub || !prv) return false;
  webpush.setVapidDetails(sub, pub, prv);
  return true;
}

/** Notifikacne kategorie — per-user opt-in cez users.notification_prefs. */
export type NotifType = "monitor" | "odklik" | "lv" | "naklady";

/**
 * Generic push sender — pošle notifikáciu všetkým zariadeniam userov ktorí
 * majú daný typ zapnutý v notification_prefs. Ak user nemá prefs (NULL/empty),
 * default = všetko povolené.
 *
 * Mŕtve subscriptions (410/404) automaticky cleanujeme.
 */
export async function sendPushToAll(payload: {
  type: NotifType;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<{ sent: number; failed: number }> {
  if (!ensureVapid()) return { sent: 0, failed: 0 };
  const sb = getSupabaseAdmin();

  // Všetky subscriptions + ich user prefs
  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("*, users(notification_prefs)");
  if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

  // Filter: zachovaj subs kde user má daný typ zapnutý (alebo nemá prefs vôbec)
  const allowedSubs = subs.filter((s) => {
    const prefs = (s as { users?: { notification_prefs?: Record<string, boolean> } }).users?.notification_prefs;
    if (!prefs) return true; // default = všetko zapnuté
    return prefs[payload.type] !== false;
  });
  if (allowedSubs.length === 0) return { sent: 0, failed: 0 };

  const msg = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/",
    tag: payload.tag || payload.type,
  });

  let sent = 0, failed = 0;
  await Promise.all(
    allowedSubs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          msg
        );
        sent++;
      } catch (e: unknown) {
        failed++;
        const err = e as { statusCode?: number };
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    })
  );
  return { sent, failed };
}

/**
 * Pošle push notifikáciu všetkým subscribnutým userom pri novom inzeráte.
 * Ak subscription endpoint vráti 410 (Gone) alebo 404, zmažeme subscription.
 *
 * Jeden inzerát = jedna notifikácia per subscription. Pri batchi (napr.
 * 5 nových), pošleme max 3 notifikácie a ostatné zhrnieme do jednej ("+2 ďalšie").
 */
export async function sendPushForNewListings(listings: ScrapedInzerat[]): Promise<void> {
  if (!ensureVapid() || listings.length === 0) return;

  const sb = getSupabaseAdmin();
  const { data: rawSubs } = await sb
    .from("push_subscriptions")
    .select("*, users(notification_prefs)");
  if (!rawSubs || rawSubs.length === 0) return;

  // Filter subs podľa users.notification_prefs.monitor
  const subs = rawSubs.filter((s) => {
    const prefs = (s as { users?: { notification_prefs?: Record<string, boolean> } }).users?.notification_prefs;
    if (!prefs) return true;
    return prefs.monitor !== false;
  });
  if (subs.length === 0) return;

  // Max 3 individualne, zvyšok shrnúť
  const individual = listings.slice(0, 3);
  const extra = listings.length - individual.length;

  const payloads = individual.map((l) => ({
    title: `🏠 Nový súkromný byt${l.lokalita ? ` · ${l.lokalita}` : ""}`,
    body: `${l.cena ? `${l.cena.toLocaleString("sk")} €` : "Cena dohodou"}${l.plocha ? ` · ${l.plocha} m²` : ""}${l.izby ? ` · ${l.izby}-izb` : ""}\n${l.nazov || ""}`.slice(0, 200),
    url: l.url,
    tag: `monitor-${l.external_id}`,
  }));

  if (extra > 0) {
    payloads.push({
      title: `🏠 +${extra} ďalších inzerátov`,
      body: `V Monitore čaká ${extra} ďalších nových súkromných inzerátov.`,
      url: "/monitor",
      tag: "monitor-more",
    });
  }

  const results = await Promise.allSettled(
    subs.flatMap((s) =>
      payloads.map(async (p) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth },
            },
            JSON.stringify(p)
          );
        } catch (e: unknown) {
          const err = e as { statusCode?: number };
          // 410 = Gone (user odhlásil notifikácie), 404 = Not Found
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
          throw e;
        }
      })
    )
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) console.warn(`[push] ${failed}/${results.length} push notifications failed`);
}
