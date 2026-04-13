const CACHE_VERSION = 'emoo-ji-v1';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const TILE_CACHE    = `${CACHE_VERSION}-tiles`;
const MAX_TILE_AGE  = 7 * 24 * 60 * 60 * 1000; // 7 days

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/manifest.json',
  '/lichtwiese.geojson',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,400;0,500;1,400&family=Syne:wght@400;500;600;700;800&display=swap',
];

// ── Install: pre-cache static shell ──────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS.filter(u => !u.startsWith('https://fonts'))))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Pre-cache partial failure:', err))
  );
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('emoo-ji-') && k !== STATIC_CACHE && k !== TILE_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: routing strategy ───────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Map tiles — cache-first with expiry
  if (url.hostname.includes('tile.openstreetmap.org') || url.hostname.includes('tiles.stadiamaps.com')) {
    event.respondWith(tileStrategy(request));
    return;
  }

  // External API calls — network only (no caching, always fresh)
  if (
    url.hostname.includes('jackdaw.online') ||
    url.hostname.includes('open-meteo.com') ||
    url.hostname.includes('discomap.eea.europa.eu') ||
    url.hostname.includes('open-elevation.com') ||
    url.hostname.includes('dataspace.copernicus.eu') ||
    url.hostname.includes('onrender.com')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Google Fonts — network-first with cache fallback
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(networkFirstWithCache(request, STATIC_CACHE));
    return;
  }

  // Static assets — cache-first
  event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE));
});

async function cacheFirstWithNetwork(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline — content not cached', { status: 503 });
  }
}

async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

async function tileStrategy(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    const dateHeader = cached.headers.get('sw-cached-at');
    if (dateHeader && Date.now() - parseInt(dateHeader) < MAX_TILE_AGE) {
      return cached;
    }
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set('sw-cached-at', Date.now().toString());
      const toCache = new Response(await response.blob(), { headers });
      cache.put(request, toCache);
      return response.clone() || toCache;
    }
    return response;
  } catch {
    return cached || new Response('Tile unavailable offline', { status: 503 });
  }
}

// ── Background sync for queued analyses ──────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'analysis-queue') {
    event.waitUntil(processAnalysisQueue());
  }
});

async function processAnalysisQueue() {
  // Placeholder — in Phase 3, retry failed JackDaw API calls from IDB queue
  console.log('[SW] Processing analysis queue...');
}

// ── Push notifications (for long-running analyses) ───────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'eMooJI Analysis Ready', {
      body: data.body || 'Your field analysis is complete.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      tag: 'analysis-result',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
