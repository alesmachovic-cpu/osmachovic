/* ── Web Push notifikácie pre monitor ── */

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
  const { data: subs } = await sb.from("push_subscriptions").select("*");
  if (!subs || subs.length === 0) return;

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
