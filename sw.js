const CACHE_NAME = 'bounma-ai-v3-shell-v4';
const APP_SHELL = ['./', './index.html', './manifest.json', './config.js', './auth.js', './assets/bounma-mascot.png'];
const EXTERNAL = ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js', 'https://cdn.tailwindcss.com', 'https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@300;400;500;600;700;800&display=swap'];
const cacheable = res => res && (res.ok || res.type === 'opaque');
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(async cache => {
    await cache.addAll(APP_SHELL);
    // Best effort: external CSS/fonts/Tailwind are needed for offline styling
    await Promise.all(EXTERNAL.map(u => cache.add(new Request(u, { mode: 'no-cors' })).catch(() => {})));
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const store = res => { if (cacheable(res)) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(req, copy)); } return res; };
  if (req.mode === 'navigate') {
    // Network first so app updates reach users; fall back to cache offline
    event.respondWith(fetch(req).then(store).catch(() => caches.match('./index.html')));
  } else if (url.origin === self.location.origin || ['script', 'style', 'font'].includes(req.destination)) {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(store).catch(() => cached)));
  }
});
