const CACHE_NAME = 'tch-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/Top_Cheese_Hockey_logo.png',
  '/colin-67s.jpg',
  '/terms.html',
  '/privacy.html',
  '/manifest.json',
];

// Install — cache all static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - API calls: network only, fail gracefully
// - Everything else: network first, cache fallback (so new deploys and
//   local changes show up immediately when online — the cache only
//   kicks in when there's genuinely no connection)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API calls — always try network, return offline response if fails
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline', message: 'This feature requires an internet connection.' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // External requests (Clerk, Stripe) — network only, don't cache
  if (!url.hostname.includes('topcheesehockey.com') && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // App shell and assets — network first, cache fallback for offline use
  event.respondWith(
    fetch(event.request).then(response => {
      if (response && response.status === 200 && response.type === 'basic') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
