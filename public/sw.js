// Service worker for ARISE — makes the app installable and gives the app
// shell (HTML/JS/CSS/icons) basic offline resilience, while deliberately
// leaving ALL Firebase traffic (Firestore, Storage, Auth) completely
// untouched. This app's data is real-time and auth-gated — caching any of
// that would show stale campus data or a wrong sign-in state instead of
// helping, so only same-origin static assets ever get cached.

const CACHE_VERSION = "arise-v1";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only ever handle same-origin GET requests — anything else (Firestore,
  // Storage, Auth, any cross-origin call) passes straight through untouched.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Page loads: network-first, so a signed-in user always gets the latest
  // build when online; falls back to the cached shell only when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Everything else same-origin (hashed JS/CSS bundles, icons):
  // stale-while-revalidate — instant from cache if available, refreshed in
  // the background. Vite's build hashes filenames, so a new deploy is a new
  // URL anyway — this can never serve genuinely outdated code.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
