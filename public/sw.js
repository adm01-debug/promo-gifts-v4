// public/sw.js
// Service Worker para Gifts Store PWA
// Versão: 3.2.0
//
// CHANGELOG v3.2.0 (2026-06-22 — fix/sw-stale-chunk-recovery):
//   CRÍTICO FIX: Navigation handler mudado de Cache First → Network First.
//   ROOT CAUSE: Com Cache First, após cada deploy do Vercel o SW servia o
//   /index.html antigo (com hashes de chunks velhos). Os chunks novos têm
//   hashes diferentes → browser pedia chunks inexistentes → HTTP 404 em
//   console (ex: MockupGenerator-YQ8BivwR.js, estoque-*.js).
//   SOLUÇÃO: Network First para navigation garante que cada navegação carrega
//   o /index.html mais recente do CDN. Cache continua sendo usado como fallback
//   offline. Performance: /index.html é <5KB, Vercel CDN < 50ms → impacto mínimo.
//   STALE CHUNK RECOVERY: se um chunk com hash retorna 404 (chunk removido
//   num novo deploy), o SW invalida o cache HTML e avisa os tabs abertos via
//   postMessage({type:'SW_STALE_CHUNK'}) para recarregar.
//   CHORE: CACHE_VERSION v9 → v10 (limpa todos os caches antigos na ativação).
//
// CHANGELOG v3.1.0 (2026-06-21 — bugfix/csp-clone):
//   FIX: Imagens cross-origin de fornecedor (xbz, spot, worker, etc.) deixam de
//        ser interceptadas. O SW só intercepta mesma-origem + CDN próprio
//        (imagedelivery.net / cloudflarestream), que estão no connect-src.
//        Antes, o fetch() do SW sobre imagens de fornecedor convertia um
//        img-src (permitido) em connect-src (bloqueado) → violação de CSP.
//   FIX: Navigation handler clonava a Response uma 2ª vez DENTRO do .then()
//        assíncrono, após `return res` já ter entregue o corpo ao browser →
//        "Response body is already used". Agora clona ambas as cópias de forma
//        síncrona, antes do return.
//   CHORE: CACHE_VERSION v8 → v9 (limpa caches antigos / respostas opacas).
//
// CHANGELOG v3.0.0 (2026-06-15 — perf/deep-optimization-2026):
//   PERF: Cache de imagens com limite LRU (max 500 imagens, 90 dias TTL).
//   PERF: Prefetch automático de chunks críticos logo após activate.
//   PERF: Stale-While-Revalidate para Google Fonts (non-blocking update).
//   PERF: Supabase API responses → Network only (não cachear dados dinâmicos).
//   FIX: Nunca cachear requests com Authorization header.
//
// Estratégias por tipo de request:
//   Navigation (SPA)        → Network First + cache fallback offline  ← v3.2.0
//   /assets/* (hashed)      → Cache First (imutável) + 404 recovery   ← v3.2.0
//   Imagens (mesma origem / CDN próprio) → Cache First + LRU (max 500, 90d TTL)
//   Google Fonts             → Stale-While-Revalidate
//   Supabase API (.supabase.co) → Network Only (dados dinâmicos)
//   Resto                   → Stale-While-Revalidate

const CACHE_VERSION = 'v10';
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

/**
 * Verifica se a imagem PODE ser interceptada/cacheada com segurança pelo SW.
 * Regra: apenas mesma-origem OU CDN próprio (imagedelivery.net / cloudflarestream),
 * que estão liberados no connect-src da CSP.
 *
 * Imagens cross-origin de fornecedor (cdn.xbzbrindes.com.br, www.spotgifts.com.br,
 * promo-brindes-images.adm01.workers.dev, etc.) NÃO são interceptadas: o browser
 * as carrega nativamente via <img>, governado por img-src ('https:' liberado).
 * Interceptar com fetch() transformaria um img-src (permitido) em connect-src
 * (bloqueado) → violação de CSP. Além disso, respostas opacas cross-origin não
 * têm header `date` legível, o que quebraria a lógica de TTL/LRU deste cache.
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

/**
 * Stale chunk recovery: invalida o cache HTML e avisa todos os tabs abertos.
 * Chamado quando um chunk hashed retorna 404 (deploy novo substituiu os chunks).
 * O frontend deve escutar `navigator.serviceWorker.addEventListener('message', ...)`
 * e chamar `window.location.reload()` quando receber `SW_STALE_CHUNK`.
 */
function handleStaleChunk(chunkUrl) {
  // 1. Invalidar cache do HTML para que a próxima navegação busque da rede.
  caches.open(CACHE_NAME).then((c) => {
    c.delete('/index.html');
    c.delete('/');
  });

  // 2. Notificar todos os tabs para recarregar.
  self.clients
    .matchAll({ includeUncontrolled: true, type: 'window' })
    .then((clients) =>
      clients.forEach((client) =>
        client.postMessage({ type: 'SW_STALE_CHUNK', url: chunkUrl }),
      ),
    );
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

  // ── B) Navigation (SPA) → Network First + cache fallback offline ────────────
  //
  // v3.2.0 FIX: mudado de Cache First → Network First.
  //
  // Motivo: com Cache First, novos deploys do Vercel mudavam os hashes dos chunks
  // JS mas o SW continuava servindo o /index.html antigo (com referências a chunks
  // obsoletos). O browser tentava carregar chunks que já não existiam no CDN →
  // HTTP 404 no console (ex: MockupGenerator-YQ8BivwR.js 404).
  //
  // Com Network First:
  //   - Cada navegação busca /index.html da rede (< 50ms via Vercel CDN, < 5KB)
  //   - HTML atualizado é guardado no cache para fallback offline
  //   - Se a rede falhar (offline), o cache é servido como fallback
  //   - Impacto de performance: mínimo (HTML é tiny, CDN é rápido)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch('/index.html', { cache: 'no-cache' })
        .then((res) => {
          if (res && res.ok) {
            // Atualizar cache de forma síncrona antes do return (evita "body already used").
            const indexClone = res.clone();
            const rootClone = res.clone();
            caches.open(CACHE_NAME).then((c) => {
              c.put('/index.html', indexClone);
              c.put('/', rootClone);
            });
          }
          return res;
        })
        .catch(() =>
          // Rede falhou (offline) → fallback para cache; se não houver cache → página offline.
          caches
            .match('/index.html')
            .then((cached) => cached || offlineFallback()),
        ),
    );
    return;
  }

  // ── C) Assets com hash → Cache First (imutáveis) + 404 recovery ────────────
  //
  // Chunks com hash são imutáveis: se o conteúdo muda, o hash muda.
  // Cache First é a estratégia correta aqui para máxima performance.
  //
  // v3.2.0 ADIÇÃO: se um chunk hashed retorna 404 (deploy novo removeu esse chunk),
  // o SW invalida o /index.html do cache e avisa os tabs abertos via postMessage
  // para recarregar. Ao recarregar, o Network First da navegação busca o novo HTML
  // (com os novos hashes) e os chunks carregam normalmente.
  if (isHashedAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        // Cache hit: chunk imutável → responder imediatamente.
        if (cached) return cached;

        // Cache miss: buscar da rede.
        return fetch(request).then((res) => {
          if (res && res.ok) {
            // Chunk encontrado → cachear para próximas requisições.
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          } else if (res && res.status === 404) {
            // Chunk não existe mais no CDN: deploy novo mudou os hashes.
            // Iniciar recovery: invalidar HTML e notificar tabs.
            handleStaleChunk(request.url);
          }
          return res;
        }).catch((err) => {
          // Erro de rede (offline ou timeout) → retornar erro para o browser.
          // O React.lazy() vai mostrar o ErrorBoundary configurado.
          return new Response(
            JSON.stringify({ error: 'Network error fetching chunk', url: request.url }),
            { status: 503, headers: { 'Content-Type': 'application/json' } },
          );
        });
      }),
    );
    return;
  }

  // ── D) Imagens cacheáveis (mesma origem + CDN próprio) → Cache First + LRU ──
  // Imagens cross-origin de fornecedor NÃO entram aqui: o browser as carrega
  // nativamente via <img> (img-src), evitando o bloqueio de connect-src.
  if (isCacheableImage(url)) {
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
