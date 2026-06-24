const CACHE_NAME = 'cursor-tracker-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/icon-192.svg',
  '/assets/icon-512.svg'
];

// Install Service Worker and cache app assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate and clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

// Network-first, fallback-to-cache strategy
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});