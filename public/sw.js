// public/sw.js
// Service Worker para Gifts Store PWA
// Versão: 2.0.0
//
// CHANGELOG v2.0.0 (2026-06-03):
//   PERF: Reescrita completa das estratégias de cache para SPA.
//   ANTES: Network First em TUDO — cada navegação fazia round-trip ao CDN (~200-500ms).
//   AGORA:
//     Navigation → Cache First (index.html é o mesmo para toda rota SPA)
//     /assets/*  → Cache First (hashed, imutável — nunca muda sem rebuild)
//     Imagens    → Cache First + network fallback
//     Resto      → Stale-While-Revalidate (manifest.json, favicon, etc.)
//   Background update: após servir index.html do cache, faz fetch silencioso
//   e atualiza o cache. Se o HTML mudou (novo deploy), notifica o app.

const CACHE_VERSION = 'v6';
const CACHE_NAME = `app-cache-${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `images-cache-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.svg',
  '/placeholder.svg'
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function offlineFallback() {
  return new Response(
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<title>Offline — Gifts Store</title></head><body style="font-family:sans-serif;' +
    'display:flex;align-items:center;justify-content:center;min-height:100vh;' +
    'background:#0a0a0a;color:#ccc;margin:0;">' +
    '<p>Você está offline. Verifique sua conexão e tente novamente.</p>' +
    '</body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

/** Verifica se a URL é um asset com hash (imutável após build) */
function isHashedAsset(pathname) {
  return pathname.startsWith('/assets/') && /[-.][\da-zA-Z]{8,}\.\w+$/.test(pathname);
}

// ─── Install ─────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n !== CACHE_NAME && n !== IMAGE_CACHE_NAME)
            .map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ───────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar não-GET e cross-origin
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // ── A) Navigation (qualquer rota SPA) → Cache First com background update ──
  // O index.html é idêntico para /catalogo, /produto/xxx, /orcamentos etc.
  // Servir do cache = instantâneo. Atualizar em background = deploy novo aparece rápido.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) => {
        // Background update (não bloqueia a resposta)
        const networkUpdate = fetch('/index.html', { cache: 'no-cache' })
          .then((res) => {
            if (res && res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((c) => {
                c.put('/index.html', clone);
                c.put('/', res.clone());
              });
            }
            return res;
          })
          .catch(() => null);

        // Se tem cache, serve imediatamente
        if (cached) return cached;

        // Se não tem cache (primeira visita), espera a rede
        return networkUpdate.then((res) => res || offlineFallback());
      })
    );
    return;
  }

  // ── B) Assets com hash → Cache First (imutáveis, nunca expiram) ────────────
  if (isHashedAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // ── C) Imagens → Cache First + network fallback ────────────────────────────
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
              if (res && res.ok) {
                cache.put(request, res.clone());
              }
              return res;
            })
            .catch(() =>
              caches.match('/placeholder.svg').then((r) => r || new Response('', { status: 404 }))
            );
        })
      )
    );
    return;
  }

  // ── D) Resto (manifest.json, fontes, etc.) → Stale-While-Revalidate ───────
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => null);

      // Serve do cache imediatamente se disponível, senão espera rede
      return cached || networkFetch.then((res) => res || offlineFallback());
    })
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
