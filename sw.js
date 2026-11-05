const CACHE_NAME = 'bounma-ai-v3-shell-v5';
const APP_SHELL = ['./', './index.html', './manifest.json', './config.js', './auth.js', './assets/bounma-mascot.png', './assets/bounma-mascot-128.png', './assets/bounma-mascot-192.png', './assets/bounma-mascot-512.png'];
const EXTERNAL = ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js', 'https://cdn.tailwindcss.com', 'https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@300;400;500;600;700;800&display=swap'];
const cacheable = res => res && (res.ok || res.type === 'opaque');
const store = (req, res) => { if (cacheable(res)) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(req, copy)); } return res; };
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
// Own files: network first (updates reach users), fall back to cache after 6s or offline
async function ownFile(req) {
  const net = fetch(req).then(res => store(req, res));
  net.catch(() => {});
  try {
    return await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 6000))]);
  } catch (e) {
    const cached = await caches.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await caches.match('./index.html') : null);
    if (cached) return cached;
    try { return await net; } catch (e2) { return Response.error(); }
  }
}
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) event.respondWith(ownFile(req));
  else if (['script', 'style', 'font'].includes(req.destination)) event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(res => store(req, res))));
  // Supabase API calls and everything else go straight to the network
});
