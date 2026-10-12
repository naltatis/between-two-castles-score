// Offline cache: hashed build assets cache-first, everything else network-first with the cache
// as offline fallback (the browser's HTTP cache already turns repeat downloads of the big
// reference files into cheap 304 revalidations).
const CACHE = "btc-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  ),
);
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const hashed = req.url.includes("/assets/");
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const cached = await c.match(req);
      if (hashed && cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok) void c.put(req, res.clone());
        return res;
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    }),
  );
});
