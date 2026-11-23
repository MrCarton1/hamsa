// همسة · service worker: opens fast, updates itself, and shows notifications when the app is closed.
// Notification previews are decrypted HERE, on the phone, with this device's private key: the server never sees them.
importScripts('config.js', 'crypto.js', 'i18n.js');
const CACHE = 'hamsa-v10';
const SHELL = ['./', './index.html', './style.css', './app.js', './config.js', './crypto.js', './i18n.js', './icon.svg', './icon-192.png', './manifest.json',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.50.0/dist/umd/supabase.min.js'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || !(u.origin === location.origin || u.href.startsWith('https://cdn.jsdelivr.net/'))) return;
  // newest version when the internet answers within 3 seconds, otherwise the saved copy
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; });
    if (!hit) return net;
    return Promise.race([net.catch(() => hit), new Promise(r => setTimeout(() => r(hit), 3000))]);
  }));
});

self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil((async () => {
    // tell the server "it reached this phone": the sender's second dot lights up
    if (d.ack && self.HAMSA) fetch(self.HAMSA.url + '/functions/v1/push', { method: 'POST', headers: { apikey: self.HAMSA.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ ack: d.ack }) }).catch(() => {});
    let lang = 'en'; try { lang = (await HC.pref('lang')) || 'en'; } catch {}
    const T = (self.I18N[lang] || self.I18N.en);
    let body = T.notifTitle;
    if (d.k === 'image') body = T.photo; else if (d.k === 'voice') body = T.voice; else if (d.k === 'sticker') body = T.sticker;
    if (d.e) { try { const me = await HC.current(); if (me) { const r = await HC.open({ ct: d.e.ct, iv: d.e.iv, keys: { [me.id]: d.e.k } }, me, d.e.sp); if (r.payload.t) body = (d.k === 'image' ? T.photo + ' ' : '') + r.payload.t; } } catch {} }
    await self.registration.showNotification(d.title || 'همسة', { body: String(body).slice(0, 180), icon: 'icon-192.png', badge: 'icon-192.png', tag: d.conv || 'hamsa', renotify: true, dir: T.dir, lang, data: { conv: d.conv } });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close(); const conv = e.notification.data && e.notification.data.conv;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
    const w = wins[0]; if (w) { w.postMessage({ open: conv }); return w.focus(); }
    return self.clients.openWindow(new URL('./?c=' + (conv || ''), self.registration.scope).href);
  }));
});
