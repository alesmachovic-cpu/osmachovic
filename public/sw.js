/* ── Service Worker pre web push notifikácie ── */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Machovič CRM", body: event.data.text() };
  }

  const title = data.title || "Machovič CRM";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-96.png",
    data: { url: data.url || "/" },
    requireInteraction: false,
    tag: data.tag || "monitor",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  // Vždy otvoríme nový tab (nech user nestráca rozprácovanú prácu v inom tabe)
  event.waitUntil(self.clients.openWindow(url));
});
