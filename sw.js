// Flip-Radar Service Worker
// App-Gerüst: sofort aus dem Cache (kein Warten aufs Netz), im Hintergrund aktualisieren.
// Daten (data/deals.json): nie aus diesem Cache – die App lädt sie selbst und hält eine Kopie.
const CACHE = "flipradar-v4";
const SHELL = ["./", "index.html", "manifest.webmanifest", "apple-touch-icon.png", "icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.includes("/data/")) return;
  const key = req.mode === "navigate" ? "index.html" : req;
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const treffer = await c.match(key);
      const netz = fetch(req).then((r) => {
        if (r && r.ok) c.put(key, r.clone());
        return r;
      }).catch(() => treffer);
      if (treffer) {
        e.waitUntil(netz); // still im Hintergrund aktualisieren
        return treffer;
      }
      return netz;
    })
  );
});

// Web-Push vom Mac: Mitteilung zeigen, Tipp öffnet diese App (nicht Safari)
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Flip-Radar", {
    body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", tag: "flipradar-" + Date.now(), data: { url: "./" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((liste) => {
    for (const c of liste) {
      if ("focus" in c) { c.postMessage("neu-laden"); return c.focus(); }
    }
    return clients.openWindow("./");
  }));
});
