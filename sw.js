// همسة · service worker: opens fast (saved copy of the app) and shows notifications when the app is closed.
importScripts('config.js');   // self.HAMSA: the server address, to say "delivered"
const CACHE = 'hamsa-v7';
const SHELL = ['./', './index.html', './style.css', './app.js', './config.js', './icon.svg', './icon-192.png', './manifest.json',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.50.0/dist/umd/supabase.min.js'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || !(u.origin === location.origin || u.href.startsWith('https://cdn.jsdelivr.net/'))) return;
  // newest version from the internet when it answers within 3 seconds, otherwise the saved copy (fast on weak signal)
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; });
    if (!hit) return net;
    return Promise.race([net.catch(() => hit), new Promise(r => setTimeout(() => r(hit), 3000))]);
  }));
});

self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    // tell the server this phone received it: the sender's trail lights its second dot, even with the app closed
    if (d.ack && self.HAMSA) fetch(self.HAMSA.url + '/functions/v1/push', { method: 'POST', headers: { apikey: self.HAMSA.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ ack: d.ack }) }).catch(() => {});
    await self.registration.showNotification(d.title || 'همسة', { body: d.body || 'رسالة جديدة', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.conv || 'hamsa', renotify: true, dir: 'rtl', lang: 'ar', data: { conv: d.conv } });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close(); const conv = e.notification.data && e.notification.data.conv;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
    const w = wins[0]; if (w) { w.postMessage({ open: conv }); return w.focus(); }
    return self.clients.openWindow(new URL('./?c=' + (conv || ''), self.registration.scope).href);
  }));
});
