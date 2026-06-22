// public/sw.js
// Service Worker para Gifts Store PWA
// Versão: 3.7.0
//
// CHANGELOG v3.7.0 (2026-06-22 — fix/sw-spa-routes-non-navigate):
//   BUG-SW-7 FIX [MÉDIO]: Seção E (Stale-While-Revalidate) fazia network fetch
//     para rotas SPA (ex: /filtros, /produtos, /novidades) em requests NÃO-navigate.
//     O browser faz requests não-navigate para essas URLs ao validar PWA shortcuts
//     e prefetch de links de manifesto. Vercel só serve index.html para requests
//     navigate (browser navigation), retornando 404 para fetch não-navigate.
//     Resultado: "sw.js:451 Falha ao carregar Buscar: GET /filtros" no console.
//     Fix: detectar SPA paths (pathname sem extensão de arquivo) e retornar
//     index.html do cache diretamente, sem fazer network request que causaria 404.
//   CHORE: CACHE_VERSION v13 → v14 (garante re-instalação limpa).
//
// CHANGELOG v3.6.0 (2026-06-22 — fix/sw-precache-resilient):
//   BUG-AUDIT-6 FIX [MÉDIO]: cache.addAll() é atômico — se qualquer URL do
//     PRECACHE_URLS retornar erro (ex: ícone sem hash ainda não propagado no CDN
//     durante warmup de deploy), o install event inteiro falha e o SW não instala.
//     Fix: separar o precache em dois grupos:
//       - PRECACHE_CRITICAL: URLs sem as quais o app não funciona offline
//       - PRECACHE_OPTIONAL: URLs desejáveis mas não críticas para o boot
//     Resultado: install nunca falha por causa de um ícone PWA ainda propagando.
//   CHORE: CACHE_VERSION v12 → v13.
//
// CHANGELOG v3.4.0 (2026-06-22 — fix/sw-cdn-race-retry-mime-fix):
//   BUG-SW-5 FIX [CRÍTICO]: Race condition CDN do Vercel durante deploy.
//   BUG-SW-6 FIX [MÉDIO]: Edge nodes do Vercel CDN servem assets com Content-Type errado.
//
// CHANGELOG v3.3.0 (2026-06-22 — fix/sw-5xx-fallback-offline-status):
//   BUG-SW-1 FIX [CRÍTICO]: navigate → fallback 5xx para cache.
//   BUG-SW-2 FIX [CRÍTICO]: offlineFallback() status 503 → 200.
//   BUG-SW-3 FIX [MÉDIO]: Seção E propagava 5xx ao browser.
//   BUG-SW-4 FIX [BAIXO]: Google Fonts fallback status 503 → 200.
//
// CHANGELOG v3.2.0 (2026-06-22 — fix/sw-stale-chunk-recovery):
//   CRÍTICO FIX: Navigation handler mudado de Cache First → Network First.
//   STALE CHUNK RECOVERY via postMessage({type:'SW_STALE_CHUNK'}).
//
// Estratégias por tipo de request:
//   Navigation (SPA)                   → Network First + cache fallback (5xx e offline)  ← v3.3.0
//   /assets/* (hashed)                 → Cache First + retry 1s + MIME fix                ← v3.4.0
//   SPA routes não-navigate            → Cache index.html (sem network fetch)             ← v3.7.0 NEW
//   Imagens (mesma origem / CDN próprio) → Cache First + LRU (max 500, 90d TTL)
//   Google Fonts                        → Stale-While-Revalidate
//   Supabase API (.supabase.co)         → Network Only (dados dinâmicos)
//   Resto                              → Stale-While-Revalidate + fallback offline        ← v3.3.0

const CACHE_VERSION = 'v14'; // v3.7.0 — SPA routes non-navigate fix
const CACHE_NAME = `app-cache-${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `images-cache-${CACHE_VERSION}`;
const FONT_CACHE_NAME = `fonts-cache-${CACHE_VERSION}`;

// Limite de imagens em cache (LRU eviction quando exceder)
const IMAGE_CACHE_MAX = 500;
// TTL de imagens em cache (90 dias em ms)
const IMAGE_CACHE_TTL = 90 * 24 * 60 * 60 * 1000;


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
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

/**
 * v3.4.0: Corrige o Content-Type de uma Response quando o servidor (ex: edge node
 * do Vercel CDN) retorna text/plain para assets estáticos tipados (.js, .css, etc.).
 */
function withCorrectMimeType(res, pathname) {
  const ct = res.headers.get('content-type') || '';
  const ext = pathname.split('.').pop()?.toLowerCase();
  const mimeMap = {
    js:    'application/javascript; charset=utf-8',
    mjs:   'application/javascript; charset=utf-8',
    css:   'text/css; charset=utf-8',
    woff2: 'font/woff2',
    woff:  'font/woff',
    ttf:   'font/ttf',
    otf:   'font/otf',
  };
  const expected = mimeMap[ext];
  if (!expected) return res;
  if (ct && ct.indexOf(expected.split(';')[0]) !== -1) return res;
  const headers = new Headers(res.headers);
  headers.set('Content-Type', expected);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** Verifica se a URL é um asset com hash (imutável após build) */
function isHashedAsset(pathname) {
  return pathname.startsWith('/assets/') && /[-.][a-zA-Z0-9]{8,}\.\w+$/.test(pathname);
}

/**
 * v3.7.0 NEW: Verifica se o pathname é uma rota SPA (sem extensão de arquivo).
 * Rotas SPA não existem como arquivos estáticos no servidor; o Vercel só as serve
 * em modo navigate (redireciona para index.html). Em requests não-navigate
 * (prefetch, manifest validation, PWA shortcuts), o servidor retorna 404.
 * Solução: servir do cache (index.html) sem fazer network request.
 */
function isSpaPath(pathname) {
  // Pathname sem ponto = sem extensão de arquivo = rota SPA
  // Exceto: raiz '/' que já é precacheada, e paths de API
  return !pathname.includes('.') && !pathname.startsWith('/api/');
}

/** Verifica se a request não deve ser cacheada (auth, API dinâmica, etc.) */
function shouldSkipCache(request) {
  const url = new URL(request.url);
  if (url.hostname.includes('.supabase.co')) return true;
  if (request.headers.has('Authorization')) return true;
  if (request.method !== 'GET') return true;
  return false;
}

/**
 * Verifica se a imagem PODE ser interceptada/cacheada com segurança pelo SW.
 * Regra: apenas mesma-origem OU CDN próprio (imagedelivery.net / cloudflarestream).
 */
function isCacheableImage(url) {
  const sameOrigin = url.origin === self.location.origin;
  const ownCdn =
    url.hostname === 'imagedelivery.net' ||
    url.hostname.includes('cloudflarestream.com');
  const looksLikeImage = /\.(jpg|jpeg|png|gif|webp|avif|svg|ico)$/i.test(url.pathname);
  return ownCdn || (sameOrigin && looksLikeImage);
}

/** Verifica se a URL é de Google Fonts */
function isGoogleFont(url) {
  return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
}

/**
 * LRU Eviction: remove entradas mais antigas quando o cache excede IMAGE_CACHE_MAX.
 */
async function evictOldImages(cache) {
  const keys = await cache.keys();
  if (keys.length <= IMAGE_CACHE_MAX) return;
  const entries = await Promise.all(
    keys.map(async (req) => {
      const res = await cache.match(req);
      const date = res?.headers.get('date');
      return { req, ts: date ? new Date(date).getTime() : 0 };
    }),
  );
  entries.sort((a, b) => a.ts - b.ts);
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

/**
 * Stale chunk recovery: invalida o cache HTML e avisa todos os tabs abertos.
 */
function handleStaleChunk(chunkUrl) {
  caches.open(CACHE_NAME).then((c) => {
    c.delete('/index.html');
    c.delete('/');
  });
  self.clients
    .matchAll({ includeUncontrolled: true, type: 'window' })
    .then((clients) =>
      clients.forEach((client) =>
        client.postMessage({ type: 'SW_STALE_CHUNK', url: chunkUrl }),
      ),
    );
}

// ─── Install ─────────────────────────────────────────────────────────────────

const PRECACHE_CRITICAL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.svg',
  '/placeholder.svg',
];

const PRECACHE_OPTIONAL = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/og-image.png',
  '/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(PRECACHE_CRITICAL);
      await Promise.allSettled(
        PRECACHE_OPTIONAL.map((url) =>
          cache.add(url).catch(() => {
            /* ignorar falhas de URLs opcionais */
          }),
        ),
      );
    }).then(() => self.skipWaiting()),
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
          return cached || networkFetch.then((res) => res || new Response('', { status: 200 }));
        }),
      ),
    );
    return;
  }

  // ── B) Navigation (SPA) → Network First + cache fallback (5xx e offline) ───
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch('/index.html', { cache: 'no-cache' })
        .then((res) => {
          if (res && res.ok) {
            const indexClone = res.clone();
            const rootClone = res.clone();
            caches.open(CACHE_NAME).then((c) => {
              c.put('/index.html', indexClone);
              c.put('/', rootClone);
            });
            return res;
          }
          return caches.match('/index.html').then((cached) => cached || res);
        })
        .catch(() =>
          caches
            .match('/index.html')
            .then((cached) => cached || offlineFallback()),
        ),
    );
    return;
  }

  // ── C) Assets com hash → Cache First (imutáveis) + 404 recovery ────────────
  if (isHashedAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return (async () => {
          try {
            let res = await fetch(request);
            if (res && res.ok) {
              res = withCorrectMimeType(res, url.pathname);
              const clone = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, clone));
              return res;
            }
            if (res && res.status === 404) {
              await new Promise((r) => setTimeout(r, 1000));
              let retryRes = await fetch(request).catch(() => null);
              if (retryRes && retryRes.ok) {
                retryRes = withCorrectMimeType(retryRes, url.pathname);
                const clone = retryRes.clone();
                caches.open(CACHE_NAME).then((c) => c.put(request, clone));
                return retryRes;
              }
              handleStaleChunk(request.url);
              return retryRes || res;
            }
            return res;
          } catch (_err) {
            return new Response(
              JSON.stringify({ error: 'Network error fetching chunk', url: request.url }),
              { status: 503, headers: { 'Content-Type': 'application/json' } },
            );
          }
        })();
      }),
    );
    return;
  }

  // ── D) Imagens cacheáveis (mesma origem + CDN próprio) → Cache First + LRU ──
  if (isCacheableImage(url)) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached && !isImageExpired(cached)) return cached;
          return fetch(request)
            .then((res) => {
              if (res && res.ok) {
                cache.put(request, res.clone());
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

  // ── E) Resto → Stale-While-Revalidate ───────────────────────────────────────
  if (url.origin === self.location.origin) {
    // v3.7.0 FIX [BUG-SW-7]: Rotas SPA em requests não-navigate (prefetch,
    // manifest/PWA shortcuts validation) retornam 404 do Vercel porque o servidor
    // só serve index.html para requests navigate. Evitar network fetch aqui;
    // retornar index.html do cache diretamente → sem console error.
    // Exemplos: /filtros, /produtos, /novidades (validação de PWA shortcuts).
    if (isSpaPath(url.pathname) && request.mode !== 'navigate') {
      event.respondWith(
        caches.match('/index.html').then((cached) => cached || offlineFallback()),
      );
      return;
    }

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
        return cached || networkFetch.then((res) => (res && res.ok ? res : null) || offlineFallback());
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
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
