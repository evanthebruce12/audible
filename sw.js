/* Audible service worker: shows push notifications and opens the right screen when tapped. */

/* ---------------------------------------------------------------
   App shell cache.
   Without this every launch pulled ~263KB from the network before
   anything could paint, which left the static launch image frozen
   on screen for well over a second. Serve the shell from Cache
   Storage, then refresh it in the background and tell the page when
   a newer build is ready.
   --------------------------------------------------------------- */
const SHELL = "audible-shell-v12";
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon.png", "./icon-192.png", "./icon-512.png", "./favicon.png"];

self.addEventListener("install", e => {
  self.skipWaiting();
  /* addAll rejects as a unit, so one missing file left the whole precache
     empty. Cache each asset on its own. */
  e.waitUntil(caches.open(SHELL).then(c =>
    Promise.all(ASSETS.map(a => c.add(a).catch(() => {})))).catch(() => {}));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== IMGS).map(k => caches.delete(k)))));
});

/* only the shell; Sleeper and ESPN calls always go straight to the network */
/* "./" became "" after the replace and endsWith("") is always true, so this
   used to claim every same-origin request. Match real filenames only. */
const SHELL_FILES = ASSETS.map(a => a.replace(/^\.\//, "")).filter(Boolean);
function isShell(req){
  if(req.method !== "GET") return false;
  let u; try{ u = new URL(req.url); }catch(e){ return false; }
  if(u.origin !== self.location.origin) return false;
  if(u.searchParams.has("fresh")) return false;   /* the page's own update check must reach the network */
  if(req.mode === "navigate") return true;
  const name = u.pathname.split("/").pop();
  return SHELL_FILES.includes(name);
}
self.addEventListener("fetch", e => {
  if(!isShell(e.request)) return;
  e.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const hit = await cache.match(e.request, {ignoreSearch: true});
    const net = fetch(e.request).then(res => {
      if(res && res.ok) cache.put(e.request, res.clone()).catch(() => {});
      return res;
    }).catch(() => null);
    if(hit){ e.waitUntil(net); return hit; }        /* cache first */
    return (await net) || fetch(e.request);
  })());
});

self.addEventListener("message", e => { if(e.data && e.data.type === "skip-waiting") self.skipWaiting(); });

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
