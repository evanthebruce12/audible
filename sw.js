/* Audible service worker: shows push notifications and opens the right screen when tapped. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch(err) { d = {body: e.data ? e.data.text() : ""}; }
  const title = d.title || "Audible";
  const opts = {body: d.body || "", tag: d.tag || undefined, renotify: !!d.tag, icon: "icon-192.png", data: {url: d.url || "./#home"}};
  const jobs = [self.registration.showNotification(title, opts)];
  if(typeof d.badge === "number" && self.navigator && self.navigator.setAppBadge){
    jobs.push(d.badge > 0 ? self.navigator.setAppBadge(d.badge).catch(() => {}) : self.navigator.clearAppBadge().catch(() => {}));
  }
  e.waitUntil(Promise.all(jobs));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./#home", self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({type: "window", includeUncontrolled: true});
    for(const w of wins){
      if(w.url.startsWith(self.registration.scope)){
        try { await w.focus(); } catch(err) {}
        w.postMessage({type: "open", url});
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
