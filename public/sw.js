// public/sw.js
// Service Worker para Gifts Store PWA
// Versão: 3.9.0
//
// CHANGELOG v3.9.0 (2026-06-28 — fix/sw-503-stale-chunk-detection):
//   BUG-SW-14 FIX [CRÍTICO]: looksStale() não detectava res.status === 503.
//     O Vercel retorna "503 Stale Chunk" para chunks removidos em novo deploy.
//     Como looksStale() só verificava 404 e HTML, 503 caía no branch "erro
//     não-obsoleto" e era repassado ao browser sem chamar handleStaleChunk().
//     O postMessage SW_STALE_CHUNK (→ reload em 300ms) NUNCA disparava neste
//     path — a app ficava travada até o usuário dar hard refresh manual.
//
//   BUG-SW-15 FIX [ALTO]: ampliação da detecção de "stale" para qualquer
//     status não-ok. Para assets hashed (conteúdo imutável por construção),
//     qualquer falha de rede (502, 503, 504, 404…) indica que o CDN não tem
//     mais aquele hash — ou seja, houve um novo deploy. A distinção anterior
//     entre "stale" e "outro erro não-ok" era incorreta: não existe cenário
//     em que um hashed asset retorna 5xx por razão que não seja deploy/CDN.
//     Fix: looksStale() simplificado para !res.ok (+ HTML check para módulos).
//
//   BUG-SW-21 FIX [BAIXO]: handleStaleChunk() — cadeia
//     self.clients.matchAll().then() não tinha .catch(). Se matchAll falhar
//     (Service Worker não controla clients ainda) ou postMessage rejeitar,
//     a Promise pendia sem handler → unhandledrejection silencioso.
//     Fix: .catch(() => {}) adicionado ao final da cadeia.
//
// CHANGELOG v3.8.0 (2026-06-27 — fix/sw-base64url-hashed-asset-routing):
//   [contexto] Após cada deploy, chunks lazy versionados (ex:
//     /assets/CloudStatusBanner-Dkobv_wg.js) falhavam com
//     "Failed to load module script: ... MIME type text/html".
//
//   BUG-SW-9 FIX [CRÍTICO]: hashes do Vite/Rollup usam o alfabeto base64url
//     [A-Za-z0-9_-], NÃO base62. O regex antigo de isHashedAsset exigia
//     [a-zA-Z0-9] logo após o separador, então qualquer chunk cujo hash
//     contivesse '_' ou '-' (Dkobv_wg tem '_' na posição 6) NÃO era
//     reconhecido como asset e caía na Seção E (Stale-While-Revalidate),
//     que devolvia offlineFallback() (HTML, status 200). O browser então
//     tentava parsear HTML como módulo ES → erro de MIME. Pior: a Seção E
//     nunca chamava handleStaleChunk(), então o recovery (postMessage
//     SW_STALE_CHUNK → reload) NUNCA disparava para esses chunks — o erro
//     era permanente até hard-refresh manual.
//     Fix: isHashedAsset passa a identificar asset versionado por estar em
//     /assets/ + extensão estática (HASHED_ASSET_EXT_RE), independente do
//     alfabeto do hash.
//
//   BUG-SW-10 FIX [ALTO]: a recuperação da Seção C só tratava "chunk
//     ausente" como status 404. Porém o Vercel devolve a própria página 404
//     em HTML (e o rewrite do vercel.json corretamente NÃO reescreve .js →
//     index.html, mas um CDN/edge em propagação pode devolver HTML mesmo
//     assim). Agora handleHashedAsset detecta obsolescência por status 404
//     OU corpo HTML numa requisição de módulo (isModuleAssetPath +
//     responseLooksLikeHtml).
//
//   BUG-SW-11 FIX [ALTO]: respostas de erro/fallback de sub-resource eram
//     HTML (offlineFallback, ou withCorrectMimeType forçando JS sobre um
//     corpo HTML). Agora: chunk obsoleto → staleChunkResponse() (503,
//     Content-Type correto por extensão, JAMAIS text/html) e sub-resource
//     genérico → genericResourceFallback() (504, não-HTML). offlineFallback
//     (HTML) fica restrito a navigate / documentos de rota SPA.
//
// CHANGELOG v3.7.1 (2026-06-23 — fix/sw-isspapath-api-edge-case):
//   BUG-SW-8 FIX [BAIXO]: isSpaPath('/api') (sem trailing slash) retornava
//     true porque !'/api'.startsWith('/api/') === true.
//     Na prática inócuo (sem Vercel Functions em /api), mas defensivamente
//     incorreto — se funções forem adicionadas em /api no futuro quebraria.
//     Fix: checar pathname === '/api' explicitamente além de startsWith('/api/').
//     Refatorado como early-returns para maior legibilidade.
//
// CHANGELOG v3.7.0 (2026-06-22 — fix/sw-spa-routes-non-navigate):
//   BUG-SW-7 FIX [MÉDIO]: Seção E fazia network fetch para rotas SPA
//     não-navigate (ex: /filtros). Vercel só serve index.html para navigate.
//     Fix: isSpaPath detecta rotas sem extensão e serve index.html do cache.
//
// CHANGELOG v3.6.0 — PRECACHE_CRITICAL / PRECACHE_OPTIONAL split.
// CHANGELOG v3.4.0 — CDN race retry + MIME fix.
// CHANGELOG v3.3.0 — navigate Network First + offlineFallback status 200.
// CHANGELOG v3.2.0 — Stale chunk recovery postMessage.
//
// Estratégias por tipo de request:
//   Navigation (SPA)                   → Network First + cache fallback        ← v3.3.0
//   /assets/* (hashed)                 → Cache First + retry 1s + MIME fix     ← v3.4.0
//   SPA routes não-navigate            → Cache index.html (sem network fetch)  ← v3.7.0
//   Stale chunk 503 detection          → looksStale captura qualquer não-ok    ← v3.9.0
//   Imagens (mesma origem / CDN)       → Cache First + LRU (max 500, 90d TTL)
//   Google Fonts                       → Stale-While-Revalidate
//   Supabase API (.supabase.co)        → Network Only (dados dinâmicos)
//   Resto                              → Stale-While-Revalidate + fallback     ← v3.3.0

const CACHE_VERSION = 'v16'; // v3.9.0 — BUG-SW-14/15 looksStale captura 503+5xx; BUG-SW-21 handleStaleChunk .catch()
const CACHE_NAME = `app-cache-${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `images-cache-${CACHE_VERSION}`;
const FONT_CACHE_NAME = `fonts-cache-${CACHE_VERSION}`;

const IMAGE_CACHE_MAX = 500;
const IMAGE_CACHE_TTL = 90 * 24 * 60 * 60 * 1000;


// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// BUG-SW-9 FIX [CRÍTICO]: identifica asset versionado por /assets/ + extensão
//   estática — JAMAIS por padrão do hash. Hashes do Vite/Rollup são base64url
//   ([A-Za-z0-9_-]); o regex antigo /[-.][a-zA-Z0-9]{8,}/ ignorava '_' e '-',
//   então chunks como CloudStatusBanner-Dkobv_wg.js escapavam desta seção.
const HASHED_ASSET_EXT_RE = /\.(?:js|mjs|css|woff2?|ttf|otf|map)$/i;

// Apenas tipos que o browser carrega como módulo/stylesheet — usados na
// detecção de "HTML servido no lugar de um módulo".
function isModuleAssetPath(pathname) {
  return /\.(?:js|mjs|css)$/i.test(pathname);
}

function responseLooksLikeHtml(res) {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  return ct.includes('text/html');
}

function isHashedAsset(pathname) {
  return pathname.startsWith('/assets/') && HASHED_ASSET_EXT_RE.test(pathname);
}

// Resposta para chunk obsoleto/ausente: status 503 + Content-Type correto para
// a extensão (NUNCA text/html). Assim o browser recebe um erro limpo de
// carregamento de módulo e o recovery (SW_STALE_CHUNK → reload) assume,
// em vez de tentar parsear HTML como JavaScript.
function staleChunkResponse(pathname) {
  const ext = (pathname.split('.').pop() || '').toLowerCase();
  const ctMap = {
    js: 'application/javascript; charset=utf-8',
    mjs: 'application/javascript; charset=utf-8',
    css: 'text/css; charset=utf-8',
    woff2: 'font/woff2',
    woff: 'font/woff',
    ttf: 'font/ttf',
    otf: 'font/otf',
    map: 'application/json; charset=utf-8',
  };
  const ct = ctMap[ext] || 'application/octet-stream';
  return new Response('/* stale chunk reloading: ' + pathname + ' */', {
    status: 503,
    statusText: 'Stale Chunk',
    headers: { 'Content-Type': ct, 'Cache-Control': 'no-store' },
  });
}

// Fallback genérico de sub-resource (não-navegação): 504 + corpo vazio,
// nunca HTML, para não envenenar consumidores que esperam JS/JSON.
function genericResourceFallback() {
  return new Response('', {
    status: 504,
    statusText: 'Offline',
    headers: { 'Cache-Control': 'no-store' },
  });
}

/**
 * v3.7.1: Corrigido edge case de /api sem trailing slash.
 *
 * Retorna true se o pathname é uma rota SPA que deve ser servida
 * a partir do cache de index.html em requests não-navigate.
 * Critérios:
 *   1. Sem extensão de arquivo (sem ponto) — arquivos têm extensão
 *   2. Não é /api, /api/ ou /api/... — podem ser Vercel Functions
 *
 * @param {string} pathname - ex: '/filtros', '/produtos/canecas'
 * @returns {boolean}
 */
function isSpaPath(pathname) {
  if (pathname.includes('.')) return false;                      // tem extensão → não é SPA
  if (pathname === '/api') return false;                         // /api exato    → pode ser endpoint
  if (pathname.startsWith('/api/')) return false;               // /api/...       → endpoints
  return true;
}

function shouldSkipCache(request) {
  const url = new URL(request.url);
  if (url.hostname.includes('.supabase.co')) return true;
  if (request.headers.has('Authorization')) return true;
  if (request.method !== 'GET') return true;
  return false;
}

function isCacheableImage(url) {
  const sameOrigin = url.origin === self.location.origin;
  const ownCdn =
    url.hostname === 'imagedelivery.net' ||
    url.hostname === 'cloudflarestream.com' ||
    url.hostname.endsWith('.cloudflarestream.com');
  const looksLikeImage = /\.(jpg|jpeg|png|gif|webp|avif|svg|ico)$/i.test(url.pathname);
  return ownCdn || (sameOrigin && looksLikeImage);
}

function isGoogleFont(url) {
  return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
}

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

function isImageExpired(response) {
  const date = response?.headers.get('date');
  if (!date) return false;
  return Date.now() - new Date(date).getTime() > IMAGE_CACHE_TTL;
}

function handleStaleChunk(chunkUrl) {
  caches.open(CACHE_NAME).then((c) => {
    c.delete('/index.html');
    c.delete('/');
  }).catch(() => {}); // Guard: não deixar rejeição sem handler
  self.clients
    .matchAll({ includeUncontrolled: true, type: 'window' })
    .then((clients) =>
      clients.forEach((client) =>
        client.postMessage({ type: 'SW_STALE_CHUNK', url: chunkUrl }),
      ),
    )
    .catch(() => {}); // BUG-SW-21 FIX: guard para rejeição de matchAll/postMessage
}
// ── Roteamento de asset versionado (/assets/*) ────────────────────────────────
// BUG-SW-9/10/11 FIX: Cache-first (imutável por hash). Trata deploy/CDN em
//   propagação e detecta chunk obsoleto por status 404 OU corpo HTML numa
//   requisição de módulo. Uma tentativa de retry; se ainda obsoleto, dispara
//   handleStaleChunk() (limpa index.html + postMessage SW_STALE_CHUNK → reload
//   em ~300ms via sw-register.ts) e devolve staleChunkResponse() (503,
//   Content-Type correto, JAMAIS text/html). Nunca cacheia nem devolve HTML.
async function handleHashedAsset(request, url) {
  const { pathname } = url;
  const isModule = isModuleAssetPath(pathname);

  // Guard: Cache API pode falhar (quota excedida, IndexedDB bloqueada em
  // private-browsing restrito). Se lançar, prosseguimos direto para network.
  let cached = null;
  try { cached = await caches.match(request); } catch (_e) { /* sem cache */ }
  if (cached) return cached;

  // BUG-SW-14/15 FIX: hashed assets são IMUTÁVEIS por definição (hash = conteúdo).
  // Qualquer status não-ok significa que o asset não existe neste deploy/CDN edge.
  // Inclui: 404 (removido), 503 (Vercel "Stale Chunk"), 502/504 (CDN em propagação).
  // A distinção anterior entre "stale" e "outro erro não-ok" era incorreta —
  // para assets content-addressed, qualquer falha de rede → recovery.
  const looksStale = (res) => {
    if (!res) return true;
    if (!res.ok) return true; // BUG-SW-14/15: qualquer não-2xx = stale para hashed assets
    // Status 200 mas corpo é HTML (Vercel edge rewrites obsoletos para módulos)
    if (isModule && responseLooksLikeHtml(res)) return true;
    return false;
  };

  const acceptable = (res) =>
    res && res.ok && !(isModule && responseLooksLikeHtml(res));

  try {
    const res = await fetch(request);

    if (acceptable(res)) {
      const fixed = withCorrectMimeType(res, pathname);
      const clone = fixed.clone();
      caches.open(CACHE_NAME).then((c) => c.put(request, clone)).catch(() => {});
      return fixed;
    }

    if (looksStale(res)) {
      await new Promise((r) => setTimeout(r, 1000));
      const retry = await fetch(request).catch(() => null);
      if (acceptable(retry)) {
        const fixed = withCorrectMimeType(retry, pathname);
        const clone = fixed.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, clone)).catch(() => {});
        return fixed;
      }
      handleStaleChunk(request.url);
      return staleChunkResponse(pathname);
    }

    // Resposta não-ok porém não-obsoleta (ex: 500/403): repassa sem cachear,
    // garantindo Content-Type correto se for um módulo.
    return isModule ? withCorrectMimeType(res, pathname) : res;
  } catch (_err) {
    // Falha de rede (provável offline): erro limpo, sem forçar reload em loop.
    return staleChunkResponse(pathname);
  }
}


// ─── Install ──────────────────────────────────────────────────────────────────

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

// ─── Activate ─────────────────────────────────────────────────────────────────

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

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (shouldSkipCache(request)) return;

  // ── A) Google Fonts → Stale-While-Revalidate ──────────────────────────────
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

  // ── B) Navigation (SPA) → Network First + cache fallback ──────────────────
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

  // ── C) Assets versionados → Cache First + recovery + MIME guard ───────────
  if (isHashedAsset(url.pathname)) {
    event.respondWith(handleHashedAsset(request, url));
    return;
  }

  // ── D) Imagens cacheáveis (mesma origem + CDN próprio) → Cache First + LRU ─
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

  // ── E) Resto → Stale-While-Revalidate ─────────────────────────────────────
  if (url.origin === self.location.origin) {
    // v3.7.0 FIX [BUG-SW-7]: Rotas SPA em requests não-navigate
    // (prefetch, manifest/PWA shortcuts validation) retornam 404 do Vercel
    // porque o servidor só serve index.html para requests navigate.
    // Evitar network fetch aqui; retornar index.html do cache diretamente.
    // v3.7.1 FIX [BUG-SW-8]: Adicionado check pathname === '/api'
    // para cobrir /api sem trailing slash (antes escapava o filtro).
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
        return cached || networkFetch.then((res) => (res && res.ok ? res : null) || genericResourceFallback());
      }),
    );
  }
});

// ─── Push & Notificações ──────────────────────────────────────────────────────

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
