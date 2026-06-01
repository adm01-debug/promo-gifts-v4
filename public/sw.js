// public/sw.js
// Service Worker para Gifts Store PWA
// Versão: 1.3.0

const CACHE_NAME = 'app-cache-v3';
const IMAGE_CACHE_NAME = 'images-cache-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/placeholder.svg'
];

// Install: cachear assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: limpar TODOS os caches antigos
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME, IMAGE_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch logic
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (Supabase, APIs externas, outros domínios Vercel)
  if (url.origin !== self.location.origin) return;

  // Image Strategy: Cache First, Network Fallback
  if (request.destination === 'image' || /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => caches.match('/placeholder.svg'));
        });
      })
    );
    return;
  }

  // General Strategy: Network First, Cache Fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return response;
      })
      .catch(() => caches.match(request).then(res => res || caches.match('/')))
  );
});

// Push & Notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Gifts Store', body: 'Nova atualização disponível.' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg'
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
