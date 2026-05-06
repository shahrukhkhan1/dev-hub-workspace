/* DevSuite Hub service worker
 * Strategy:
 *   - App shell + same-origin assets: cache-first with background revalidate.
 *   - External CDNs needed by the playground (Pyodide, unpkg, jsdelivr,
 *     cdnjs, cdn.tailwindcss): network-first, fall back to cache.
 *   - Anything else: pass-through fetch.
 * If the network is down and the asset isn't cached, the request fails
 * gracefully and the UI hides CDN injection (see code.tsx online detection).
 */
const VERSION = "v1";
const SHELL_CACHE = `devsuite-shell-${VERSION}`;
const CDN_CACHE = `devsuite-cdn-${VERSION}`;

const CDN_HOSTS = [
  "cdn.jsdelivr.net",
  "unpkg.com",
  "cdnjs.cloudflare.com",
  "cdn.tailwindcss.com",
  "code.jquery.com",
];

self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => ![SHELL_CACHE, CDN_CACHE].includes(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Skip HTML navigations entirely so new deploys aren't shadowed by a stale shell.
  if (req.mode === "navigate") return;

  if (CDN_HOSTS.some(h => url.hostname === h || url.hostname.endsWith("." + h))) {
    event.respondWith((async () => {
      const cache = await caches.open(CDN_CACHE);
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await cache.match(req);
        if (cached) return cached;
        return new Response("", { status: 504, statusText: "Offline and not cached" });
      }
    })());
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(req);
      const network = fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    })());
  }
});
