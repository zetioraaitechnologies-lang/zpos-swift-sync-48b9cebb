// ZPoS minimal service worker.
// Purpose: satisfy the browser install-prompt requirement (must have a
// fetch handler) without caching anything — the app is offline-first via
// localStorage, so we don't need a Workbox cache layer.
// A same-path kill-switch can be shipped later if needed.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-only pass-through. Required so browsers treat this as a real
// SW and enable the "Install app" affordance.
self.addEventListener("fetch", (event) => {
  // Only handle top-level navigations and same-origin GETs.
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => Response.error()));
});
