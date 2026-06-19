/* eslint-disable no-restricted-globals */
/**
 * Karachi Naseeb — minimal Web Push service worker.
 * Receives the push payload from the backend (FastAPI / pywebpush) and shows a
 * native OS notification. Tapping it deep-links to the live tracking page so the
 * customer lands exactly where they want to be (the order they were notified about).
 *
 * Keep this file lean — it's installed once per browser and updates are rare. Don't
 * import anything heavy; bundlers don't process it.
 */

self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: "Karachi Naseeb", body: event.data ? event.data.text() : "Order update" }; }
    const title = data.title || "Order update";
    const options = {
        body: data.body || "",
        icon: data.icon || "/favicon.ico",
        badge: data.badge || "/favicon.ico",
        data: { url: data.url || "/" },
        tag: data.tag || "order-update",
        renotify: true,
        vibrate: [120, 60, 120],
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || "/";
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
            // If a tab is already open on the target URL, focus it. Otherwise open a new one.
            for (const c of clients) {
                if (c.url.endsWith(targetUrl) && "focus" in c) return c.focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
        })
    );
});
