// public/sw.js
// Service Worker para Gifts Store PWA
// Versão: 1.5.0
//
// CHANGELOG v1.5.0 (2026-06-02):
//   FIX: TypeError "Response body is already used" on res.clone()
//   CAUSA raiz: res.clone() dentro de caches.open().then() executa DEPOIS
//   que o browser já consumiu o body do Response retornado por respondWith().
//   FIX: clonar sincronamente ANTES do return.
//
// CHANGELOG v1.4.0 (2026-06-02):
//   FIX: TypeError "Failed to convert value to 'Response'" em navigation requests
//   com query string (ex: /?search=94297&sort=price-asc).
//   CAUSA raiz: caches.match() resolve para `undefined` quando não há hit no cache.
//   event.respondWith(undefined) é inválido — gera network error no browser.
//
//   BUGS CORRIGIDOS:
//   BUG-A: .catch() da Estratégia Geral resolvia para undefined quando cache miss
//          em caches.match(request) E caches.match('/').
//   BUG-B: Navigation requests com query string (?search=X&sort=Y) nunca batem no
//          cache (URL diverge do "/" cacheado); precisam de tratamento separado.
//   BUG-C: Image fallback caches.match('/placeholder.svg') também podia ser undefined.

const CACHE_NAME = 'app-cache-v5';        // Bump v4→v5: fix res.clone() body-already-used
const IMAGE_CACHE_NAME = 'images-cache-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/placeholder.svg'
];

// ─── Helper ──────────────────────────────────────────────────────────────────
// event.respondWith() NUNCA pode receber undefined/null — causa TypeError imediato.
// networkFallback() é o último recurso, garantindo sempre uma Response válida.
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

  // 2. Ignorar cross-origin (Supabase, CDN de imagens, APIs externas, Vercel)
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
                cache.put(request, res.clone());
              }
              return res;
            })
            .catch(() =>
              // BUG-C FIX: caches.match pode retornar undefined → networkFallback() garante Response
              caches.match('/placeholder.svg').then((r) => r || networkFallback())
            );
        })
      )
    );
    return;
  }

  // ── Estratégia B: Navigation (carregamento de página) ─────────────────────
  //
  // BUG-B FIX: URLs com query string (/?search=X&sort=Y) NUNCA batem em
  // caches.match(request) porque o cache armazena "/" sem parâmetros.
  // Para SPAs React, o fallback correto é /index.html — o React Router
  // processa a rota internamente depois do load.
  //
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            // v1.5.0 FIX: clone SINCRONO antes do return — se clonar dentro de
            // caches.open().then(), o body já foi consumido pelo browser.
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
          }
          return res;
        })
        .catch(() =>
          caches.match('/index.html')
            .then((r) => r || caches.match('/'))
            .then((r) => r || networkFallback())  // BUG-B FIX: nunca undefined
        )
    );
    return;
  }

  // ── Estratégia C: Sub-recursos (JS, CSS, fontes, JSON) ────────────────────
  // Network First, Cache Fallback
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (!res || res.status !== 200 || res.type !== 'basic') {
          return res;
        }
        // v1.5.0 FIX: clone SINCRONO antes do return
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
        return res;
      })
      .catch(() =>
        // BUG-A FIX: cadeia com networkFallback() no final — nunca undefined
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
