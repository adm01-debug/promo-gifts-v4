// public/sw.js
// Service Worker para Gifts Store PWA
// Versão: 1.5.0
//
// CHANGELOG v1.5.0 (2026-06-02):
//   FIX: TypeError "Failed to execute 'clone' on 'Response': Response body is already used"
//   CAUSA raiz: res.clone() era chamado DENTRO de caches.open().then() — um callback
//   assíncrono que executa DEPOIS de `return res`. Nesse ponto o browser já consumiu
//   o body do Response, tornando clone() impossível.
//   CORREÇÃO: clonar o Response SINCRONAMENTE antes do return e passar o clone
//   pré-feito para cache.put().
//
// CHANGELOG v1.4.0 (2026-06-02):
//   FIX: event.respondWith(undefined) em navigation requests com query string.
//   BUG-A, BUG-B, BUG-C: cadeias de fallback agora sempre resolvem para Response válida.

const CACHE_NAME = 'app-cache-v5';        // Bump v4→v5: invalida cache com bug de clone
const IMAGE_CACHE_NAME = 'images-cache-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/placeholder.svg'
];

// ─── Helper ──────────────────────────────────────────────────────────────────
function networkFallback() {
  return new Response(
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<title>Offline — Gifts Store</title></head><body>' +
    '<p>Você está offline. Verifique sua conexão e tente novamente.</p>' +
    '</body></html>',
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }
  );
}

// ─── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME, IMAGE_CACHE_NAME];
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) =>
            cacheWhitelist.includes(name) ? null : caches.delete(name)
          )
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Ignorar métodos não-GET
  if (request.method !== 'GET') return;

  // 2. Ignorar cross-origin
  if (url.origin !== self.location.origin) return;

  // ── Estratégia A: Imagens — Cache First, Network Fallback ─────────────────
  if (
    request.destination === 'image' ||
    /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request)
            .then((res) => {
              if (res && res.status === 200) {
                // FIX v1.5.0: clone SINCRONAMENTE antes de qualquer return
                const resClone = res.clone();
                cache.put(request, resClone);
              }
              return res;
            })
            .catch(() =>
              caches.match('/placeholder.svg').then((r) => r || networkFallback())
            );
        })
      )
    );
    return;
  }

  // ── Estratégia B: Navigation ──────────────────────────────────────────────
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            // FIX v1.5.0: clone SINCRONAMENTE
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
          }
          return res;
        })
        .catch(() =>
          caches.match('/index.html')
            .then((r) => r || caches.match('/'))
            .then((r) => r || networkFallback())
        )
    );
    return;
  }

  // ── Estratégia C: Sub-recursos (JS, CSS, fontes, JSON) ────────────────────
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (!res || res.status !== 200 || res.type !== 'basic') {
          return res;
        }
        // FIX v1.5.0: clone SINCRONAMENTE — antes do return
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
        return res;
      })
      .catch(() =>
        caches.match(request)
          .then((r) => r || caches.match('/index.html'))
          .then((r) => r || networkFallback())
      )
  );
});

// ─── Push & Notificações ─────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data
    ? event.data.json()
    : { title: 'Gifts Store', body: 'Nova atualização disponível.' };
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
