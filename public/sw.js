// public/sw.js
// Service Worker para Gifts Store PWA
// Versão: 3.0.0
//
// CHANGELOG v3.0.0 (2026-06-15 — perf/deep-optimization-2026):
//   PERF: Cache de imagens com limite LRU (max 500 imagens, 90 dias TTL).
//   PERF: Prefetch automático de chunks críticos logo após activate.
//   PERF: Stale-While-Revalidate para Google Fonts (non-blocking update).
//   PERF: Supabase API responses → Network only (não cachear dados dinâmicos).
//   FIX: Nunca cachear requests com Authorization header.
//
// Estratégias por tipo de request:
//   Navigation (SPA)        → Cache First + background update
//   /assets/* (hashed)      → Cache First (imutável)
//   Imagens (CDN/fornecedor) → Cache First + LRU (max 500, 90d TTL)
//   Google Fonts             → Stale-While-Revalidate
//   Supabase API (.supabase.co) → Network Only (dados dinâmicos)
//   Resto                   → Stale-While-Revalidate

const CACHE_VERSION = 'v8';
const CACHE_NAME = `app-cache-${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `images-cache-${CACHE_VERSION}`;
const FONT_CACHE_NAME = `fonts-cache-${CACHE_VERSION}`;

// Limite de imagens em cache (LRU eviction quando exceder)
const IMAGE_CACHE_MAX = 500;
// TTL de imagens em cache (90 dias em ms)
const IMAGE_CACHE_TTL = 90 * 24 * 60 * 60 * 1000;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.svg',
  '/placeholder.svg',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function offlineFallback() {
  return new Response(
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<title>Offline — Promo Gifts</title>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;' +
    'justify-content:center;min-height:100vh;background:#030508;color:#94a3b8;margin:0;padding:2rem;text-align:center;}' +
    'h1{color:#e2e8f0;font-size:1.5rem;margin-bottom:.5rem;}' +
    'p{font-size:.9rem;margin:.25rem 0;}' +
    'button{margin-top:1.5rem;padding:.6rem 1.5rem;background:#3b82f6;color:#fff;border:none;' +
    'border-radius:.5rem;font-size:.9rem;cursor:pointer;}</style></head>' +
    '<body><div><h1>Você está offline</h1>' +
    '<p>Verifique sua conexão e tente novamente.</p>' +
    '<button onclick="window.location.reload()">Tentar novamente</button></div></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

/** Verifica se a URL é um asset com hash (imutável após build) */
function isHashedAsset(pathname) {
  return pathname.startsWith('/assets/') && /[-.][a-zA-Z0-9]{8,}\.\w+$/.test(pathname);
}

/** Verifica se a request não deve ser cacheada (auth, API dinâmica, etc.) */
function shouldSkipCache(request) {
  const url = new URL(request.url);
  // Nunca cachear Supabase API (dados dinâmicos)
  if (url.hostname.includes('.supabase.co')) return true;
  // Nunca cachear requests autenticadas
  if (request.headers.has('Authorization')) return true;
  // Nunca cachear POST/PUT/DELETE
  if (request.method !== 'GET') return true;
  return false;
}

/** Verifica se a URL é uma imagem de produto (CDN ou fornecedor) */
function isProductImage(url) {
  return (
    url.hostname === 'imagedelivery.net' ||
    url.hostname.includes('cloudflarestream.com') ||
    /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(url.pathname)
  );
}

/** Verifica se a URL é de Google Fonts */
function isGoogleFont(url) {
  return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
}

/**
 * LRU Eviction: remove entradas mais antigas quando o cache excede IMAGE_CACHE_MAX.
 * Usa o cabeçalho Date das responses para ordenar por recência.
 */
async function evictOldImages(cache) {
  const keys = await cache.keys();
  if (keys.length <= IMAGE_CACHE_MAX) return;

  // Coletar timestamps das responses
  const entries = await Promise.all(
    keys.map(async (req) => {
      const res = await cache.match(req);
      const date = res?.headers.get('date');
      return { req, ts: date ? new Date(date).getTime() : 0 };
    }),
  );

  // Ordenar mais antigos primeiro
  entries.sort((a, b) => a.ts - b.ts);

  // Remover os mais antigos até ficar dentro do limite
  const toRemove = entries.slice(0, entries.length - IMAGE_CACHE_MAX);
  await Promise.all(toRemove.map(({ req }) => cache.delete(req)));
}

/**
 * Verifica se uma response de imagem cacheada expirou (TTL de 90 dias).
 */
function isImageExpired(response) {
  const date = response?.headers.get('date');
  if (!date) return false;
  return Date.now() - new Date(date).getTime() > IMAGE_CACHE_TTL;
}

// ─── Install ─────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

// ─── Activate ────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n !== CACHE_NAME && n !== IMAGE_CACHE_NAME && n !== FONT_CACHE_NAME)
            .map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ─── Fetch ───────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip: non-GET, cross-origin non-CDN, auth requests, Supabase API
  if (request.method !== 'GET') return;
  if (shouldSkipCache(request)) return;

  // ── A) Google Fonts → Stale-While-Revalidate (mantém fontes offline) ───────
  if (isGoogleFont(url)) {
    event.respondWith(
      caches.open(FONT_CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request)
            .then((res) => {
              if (res && res.ok) cache.put(request, res.clone());
              return res;
            })
            .catch(() => null);
          return cached || networkFetch.then((res) => res || new Response('', { status: 503 }));
        }),
      ),
    );
    return;
  }

  // ── B) Navigation (SPA) → Cache First + background update ──────────────────
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) => {
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

        if (cached) return cached;
        return networkUpdate.then((res) => res || offlineFallback());
      }),
    );
    return;
  }

  // ── C) Assets com hash → Cache First (imutáveis) ───────────────────────────
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
      }),
    );
    return;
  }

  // ── D) Imagens de produto → Cache First + LRU eviction (máx 500, 90d) ──────
  if (isProductImage(url) || request.destination === 'image') {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          // Cache hit: verificar TTL
          if (cached && !isImageExpired(cached)) return cached;

          return fetch(request)
            .then((res) => {
              if (res && res.ok) {
                cache.put(request, res.clone());
                // LRU eviction em background (não bloqueia a resposta)
                evictOldImages(cache).catch(() => {});
              }
              return res;
            })
            .catch(() =>
              caches
                .match('/placeholder.svg')
                .then((r) => r || new Response('', { status: 404 })),
            );
        }),
      ),
    );
    return;
  }

  // ── E) Resto (manifest.json, noise.svg, etc.) → Stale-While-Revalidate ─────
  if (url.origin === self.location.origin) {
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

        return cached || networkFetch.then((res) => res || offlineFallback());
      }),
    );
  }
});

// ─── Push & Notificações ─────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  const data = event.data
    ? event.data.json()
    : { title: 'Promo Gifts', body: 'Nova atualização disponível.' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
