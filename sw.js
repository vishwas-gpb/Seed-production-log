// Service worker for the Seed Production Log PWA.
// This app is plain static files (no WebAssembly, nothing else registers a
// worker), so a simple precache of a KNOWN, SMALL file list is reliable.
// Bump CACHE (v1 -> v2 ...) whenever you change the app, to push updates.

const CACHE = "seedlog-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch the Google Sheet upload call

  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).catch(() => {
        if (req.mode === "navigate") return caches.match("./index.html");
      });
    })
  );
});
