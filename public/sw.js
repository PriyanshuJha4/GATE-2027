// Minimal offline support. Network-first for pages, so a new Vercel deploy is always picked up when online;
// the cached copy is used only when the network fails. /api/* is never cached. Static chunks are cached as they are used.
const VERSION = "gate-v2";
const SHELL = ["/offline", "/sync", "/manifest.json", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase etc. are never touched
  if (url.pathname.startsWith("/api/")) return;

  // JS/CSS chunks have content hashes: cache-first is safe
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // Page loads of the two offline-capable pages: network first, cached copy when offline
  if (req.mode === "navigate" && (url.pathname === "/offline" || url.pathname === "/sync")) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(url.pathname, copy)); }
        return res;
      }).catch(() => caches.match(url.pathname).then((hit) => hit || caches.match("/offline")))
    );
  }
});
