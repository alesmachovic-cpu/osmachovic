/* ── Client helpers pre browser push notifikácie ── */

/** VAPID public key je base64url-encoded. Web Push API vyžaduje Uint8Array. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Std = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Std);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushState = "unknown" | "granted" | "denied" | "unsupported";

export function detectPushState(): PushState {
  if (typeof window === "undefined") return "unknown";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "unknown";
}

/**
 * Spýta sa browser o povolenie, zaregistruje Service Worker, vytvorí
 * push subscription a uloží ju na server. Vracia nový PushState.
 */
export async function enableBrowserPush(opts: { userId?: string }): Promise<{
  state: PushState;
  error?: string;
}> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { state: "unsupported", error: "Prehliadač nepodporuje push notifikácie" };
  }

  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    return {
      state: perm === "denied" ? "denied" : "unknown",
      error: "Notifikácie neboli povolené",
    };
  }

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!pub) return { state: "granted", error: "VAPID public key chýba" };

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(pub) as BufferSource,
    }));

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      userId: opts.userId,
      userAgent: navigator.userAgent,
    }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    return { state: "granted", error: d.error || "Chyba pri registrácii" };
  }

  return { state: "granted" };
}
