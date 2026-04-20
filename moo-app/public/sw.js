const CACHE = 'emooji-v2'; // bumped version forces old cache to clear
const PRECACHE = ['/', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = e.request.url;

  // Never intercept Firebase, API, or external requests
  if (
    url.includes('firebaseapp.com') ||
    url.includes('googleapis.com') ||
    url.includes('identitytoolkit') ||
    url.includes('firebase') ||
    url.includes('/api/') ||
    url.includes('jackdaw') ||
    url.includes('poliruralplus') ||
    url.includes('onrender.com/api')
  ) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Only cache valid same-origin responses
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        // Clone BEFORE reading — this is the critical fix
        const toCache = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, toCache));
        return res;
      }).catch(() => caches.match('/'));
    })
  );
});