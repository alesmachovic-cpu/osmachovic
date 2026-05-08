/**
 * Per-user notifikácie — kombinácia web push + email.
 *
 * Doplnok k `lib/monitor/push.ts` (broadcast all). Tu cielené na konkrétneho
 * user-a alebo skupinu používateľov (napr. všetkých manažérov).
 *
 * Použitie:
 *   await notifyUser(userId, { type: "sla_warning", title: "...", body: "...",
 *                              url: "/klienti/abc", emailHtml: "..." });
 *
 *   await notifyManagers({ ... });
 */

import webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { NotifType } from "@/lib/monitor/push";

interface NotifyPayload {
  type: NotifType;
  title: string;
  body: string;
  /** URL na ktorú push notifikácia presmeruje */
  url?: string;
  /** Voliteľný HTML pre email; ak nie je → email sa nepošle */
  emailHtml?: string;
  /** Override email subject; default = title */
  emailSubject?: string;
}

function ensureVapid(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const prv = process.env.VAPID_PRIVATE_KEY;
  const sub = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!pub || !prv) return false;
  webpush.setVapidDetails(sub, pub, prv);
  return true;
}

/** Pošle web push všetkým subscriptions tohto user-a (môže ich mať viac — desktop + mobile). */
async function pushToUser(userId: string, payload: NotifyPayload): Promise<{ sent: number; failed: number }> {
  if (!ensureVapid()) return { sent: 0, failed: 0 };
  const sb = getSupabaseAdmin();
  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs?.length) return { sent: 0, failed: 0 };

  // Skontroluj user prefs (default = všetko zapnuté)
  const { data: u } = await sb.from("users").select("notification_prefs").eq("id", userId).single();
  const prefs = (u?.notification_prefs as Record<string, boolean> | null) || null;
  if (prefs && prefs[payload.type] === false) return { sent: 0, failed: 0 };

  const msg = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/",
    tag: payload.type,
  });

  let sent = 0, failed = 0;
  await Promise.all(subs.map(async (s) => {
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
  }));
  return { sent, failed };
}

/** Pošle email cez Resend daného user-a. Vracia true ak send OK. */
async function emailToUser(userId: string, payload: NotifyPayload): Promise<boolean> {
  if (!payload.emailHtml) return false;
  const RESEND = process.env.RESEND_API_KEY;
  if (!RESEND) return false;
  const sb = getSupabaseAdmin();
  const { data: u } = await sb.from("users").select("email, name, notification_prefs").eq("id", userId).single();
  if (!u?.email) return false;
  const prefs = (u.notification_prefs as Record<string, boolean> | null) || null;
  if (prefs && prefs[payload.type] === false) return false;

  const fromAddr = process.env.RESEND_FROM || "VIANEMA Real <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAddr,
        to: u.email,
        subject: payload.emailSubject || payload.title,
        html: payload.emailHtml,
      }),
    });
    return res.ok;
  } catch (e) {
    console.warn("[notify email] failed:", e);
    return false;
  }
}

/**
 * Hlavná funkcia — pošle push + email konkrétnemu user-ovi.
 * Obidve sú best-effort, neblokujú sa navzájom.
 */
export async function notifyUser(userId: string | null, payload: NotifyPayload): Promise<void> {
  if (!userId) return;
  await Promise.allSettled([
    pushToUser(userId, payload),
    emailToUser(userId, payload),
  ]);
}

/** Pošle notifikáciu všetkým používateľom s rolou 'manager' alebo 'admin'. */
export async function notifyManagers(payload: NotifyPayload): Promise<void> {
  const sb = getSupabaseAdmin();
  const { data: managers } = await sb.from("users").select("id").in("role", ["manager", "admin"]);
  if (!managers?.length) return;
  await Promise.allSettled(managers.map((m) => notifyUser(m.id as string, payload)));
}

/**
 * Helper — preloží makler_id (UUID z makleri tabuľky) na users.id (UUID) cez
 * email. Cron operuje s makler_id (z klienti.makler_id), ale notify potrebuje
 * users.id (cez ktoré sú subscriptions).
 */
export async function userIdFromMaklerId(maklerId: string | null | undefined): Promise<string | null> {
  if (!maklerId) return null;
  const sb = getSupabaseAdmin();
  const { data: m } = await sb.from("makleri").select("email").eq("id", maklerId).single();
  if (!m?.email) return null;
  const { data: u } = await sb.from("users").select("id").eq("email", m.email).single();
  return u?.id ? String(u.id) : null;
}

/** Štandardný HTML email skeleton s Vianema brandingom + AMGD whisper patičkou. */
export function brandedEmailHtml({ title, body, ctaUrl, ctaLabel }: {
  title: string;
  body: string;       // môže obsahovať HTML (napr. <strong>)
  ctaUrl?: string;
  ctaLabel?: string;
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://crmvianema.vercel.app";
  const fullCtaUrl = ctaUrl ? (ctaUrl.startsWith("http") ? ctaUrl : `${baseUrl}${ctaUrl}`) : null;
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0A0A0A; color: #fff; padding: 24px 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <div style="font-size: 24px; font-weight: 500; letter-spacing: -0.03em; line-height: 1;">VIANEMA</div>
        <div style="font-size: 9px; letter-spacing: 0.4em; opacity: 0.55; margin-top: 4px;">REAL</div>
      </div>
      <div style="background: #f9fafb; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="margin: 0 0 14px; font-size: 18px; color: #111;">${title}</h2>
        <div style="font-size: 14px; color: #374151; line-height: 1.6;">${body}</div>
        ${fullCtaUrl && ctaLabel ? `
          <div style="margin: 24px 0;">
            <a href="${fullCtaUrl}" style="display: inline-block; padding: 12px 22px; background: #374151; color: #fff; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">${ctaLabel}</a>
          </div>
        ` : ""}
        <div style="text-align: center; margin-top: 28px; padding-top: 16px; border-top: 1px solid #e5e7eb; opacity: 0.55;">
          <span style="font-size: 9px; letter-spacing: 0.12em; color: #6b7280;">POWERED BY</span>
          <span style="font-size: 11px; font-weight: 500; letter-spacing: -0.02em; color: #374151; margin-left: 8px;">AMGD</span>
        </div>
      </div>
    </div>
  `;
}
