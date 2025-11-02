/* Dreamex DataLab Service Worker - Basic PWA Shell */
// Bump this version whenever HTML changes should invalidate the cache
const CACHE_VERSION = 'datalab-v2';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/company-complete-registration.html',
  '/manifest.json'
  // Add: '/css/styles.css', '/js/user-display.js', etc. when stable
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET
  if (request.method !== 'GET') return;

  // Network-first for Firebase / dynamic JSON APIs
  if (url.hostname.includes('firebaseio') || url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Network-first for HTML pages (navigation or HTML requests) to avoid stale content
  const acceptHeader = request.headers.get('accept') || '';
  const isHTMLRequest = request.mode === 'navigate' || acceptHeader.includes('text/html');
  if (isHTMLRequest) {
    event.respondWith(
      fetch(request)
        .then(resp => {
          // Update cache in background on success
          const clone = resp.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
          return resp;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first with background revalidation for static assets
  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});

// Optional: Listen for skipWaiting messages for immediate SW activation
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
