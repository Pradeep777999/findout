const CACHE_NAME = "findout-v1";

self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
    // Let the browser handle all requests normally.
    // We are not caching API/private data at this stage.
});

// ======================================================
// PUSH EVENT: Receive System Push Notification
// ======================================================
self.addEventListener("push", (event) => {
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = {
                title: "FindMyThing",
                body: event.data.text()
            };
        }
    }

    const title = data.title || "FindMyThing";
    const options = {
        body: data.body || "Possible match found or item status updated.",
        icon: data.icon || "/icons/icon-192.png",
        badge: data.badge || "/icons/icon-192.png",
        vibrate: [200, 100, 200],
        tag: data.tag || (data.itemId ? `item-${data.itemId}` : `fmt-${Date.now()}`),
        renotify: true,
        data: {
            url: data.url || "/",
            itemId: data.itemId,
            type: data.type
        }
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// ======================================================
// NOTIFICATION CLICK: Focus App or Open Target Page
// ======================================================
self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const targetUrl = (event.notification.data && event.notification.data.url)
        ? event.notification.data.url
        : "/";

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
            // Check if there is an existing window open under this origin
            for (const client of clientList) {
                if (client.url && "focus" in client) {
                    // Navigate to the target page if different and focus
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            // If no window is open, open a new window
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});