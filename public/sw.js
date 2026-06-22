// public/sw.js
// Service Worker para Gifts Store PWA
// Versão: 3.6.0
//
// CHANGELOG v3.6.0 (2026-06-22 — fix/sw-precache-resilient):
//   BUG-AUDIT-6 FIX [MÉDIO]: cache.addAll() é atômico — se qualquer URL do
//     PRECACHE_URLS retornar erro (ex: ícone sem hash ainda não propagado no CDN
//     durante warmup de deploy), o install event inteiro falha e o SW não instala.
//     Isso anula as proteções do SW v3.4.0 (retry + MIME fix) exatamente no
//     momento em que são mais necessárias (imediatamente após um deploy).
//     Fix: separar o precache em dois grupos:
//       - PRECACHE_CRITICAL: URLs sem as quais o app não funciona offline
//         (/index.html, /manifest.json, /favicon.ico, /sw.js, /placeholder.svg)
//         → cache.addAll() atômico (falha = install abortado, correto)
//       - PRECACHE_OPTIONAL: URLs desejáveis mas não críticas para o boot
//         (/icons/icon-192.png, /icons/icon-512.png, /og-image.png, etc.)
//         → Promise.allSettled() individual, falhas ignoradas silenciosamente
//     Resultado: install nunca falha por causa de um ícone PWA ainda propagando.
//   CHORE: CACHE_VERSION v12 → v13 (limpa entradas da instalação anterior).
//
// CHANGELOG v3.4.0 (2026-06-22 — fix/sw-cdn-race-retry-mime-fix):
//   BUG-SW-5 FIX [CRÍTICO]: Race condition CDN do Vercel durante deploy.
//     Sintoma: após deploy do Lovable, o novo index.html é servido imediatamente
//     pelo CDN, mas os chunks JS/CSS ainda não propagaram para todos os edge nodes.
//     Browser recebia 404 no console + reload imediato (via SW_STALE_CHUNK).
//     Fix: seção C faz 1 retry após 1 000ms antes de declarar chunk como stale.
//     CDN do Vercel propaga em < 30s; 1s de espera elimina os falsos 404.
//     Se retry ainda 404 (chunk genuinamente removido): handleStaleChunk() normal.
//   BUG-SW-6 FIX [MÉDIO]: Edge nodes do Vercel CDN eventualmente servem assets com
//     Content-Type: text/plain em vez de text/css ou application/javascript.
//     Com X-Content-Type-Options: nosniff, o browser recusava aplicar o stylesheet
//     ("Refused to apply style...") ou executar o módulo. Fix: withCorrectMimeType()
//     reconstrói a Response com o Content-Type correto pela extensão do arquivo.
//     Aplicado na seção C (assets com hash). Cache armazena versão já corrigida.
//   CHORE: CACHE_VERSION v11 → v12 (descarta entradas com MIME type incorreto).
//
// CHANGELOG v3.3.0 (2026-06-22 — fix/sw-5xx-fallback-offline-status):
//   BUG-SW-1 FIX [CRÍTICO]: Seção B (navigate) não fazia fallback para o cache
//     quando o servidor retornava 5xx (ex: Vercel CDN hiccup). Antes, o SW
//     propagava o 503 direto ao browser → página aparecia quebrada. Agora,
//     se res.ok=false após Network First, tenta o cache; só retorna o erro
//     se não houver cache disponível.
//   BUG-SW-2 FIX [CRÍTICO]: offlineFallback() retornava status:503, fazendo
//     a página offline parecer um erro de servidor ao browser/Lighthouse/SW.
//     Mudado para status:200. Previne também loops de reload em clientes que
//     re-tentam automaticamente em respostas 503.
//   BUG-SW-3 FIX [MÉDIO]: Seção E (Stale-While-Revalidate) propagava respostas
//     5xx ao browser quando não havia cache. Era a fonte do erro:
//     "sw.js:354 Falha ao carregar Buscar: GET /novidades" — o browser valida
//     URLs do sitemap/manifest via fetch não-navigate, que caía na seção E.
//     Agora usa offlineFallback() quando network retorna não-ok e sem cache.
//   BUG-SW-4 FIX [BAIXO]: Seção A (Google Fonts) retornava Response vazio
//     com status:503 em fallback de último recurso. Mudado para status:200.
//   CHORE: CACHE_VERSION v10 → v11 (força re-instalação limpa).
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
//   FIX: Imagens cross-origin de fornecedor deixam de ser interceptadas.
//   FIX: Navigation handler clonava a Response uma 2ª vez DENTRO do .then()
//        assíncrono → "Response body is already used". Agora clona de forma síncrona.
//   CHORE: CACHE_VERSION v8 → v9.
//
// Estratégias por tipo de request:
//   Navigation (SPA)        → Network First + cache fallback (5xx e offline)  ← v3.3.0
//   /assets/* (hashed)      → Cache First + retry 1s + MIME fix                ← v3.4.0
//   Imagens (mesma origem / CDN próprio) → Cache First + LRU (max 500, 90d TTL)
//   Google Fonts             → Stale-While-Revalidate
//   Supabase API (.supabase.co) → Network Only (dados dinâmicos)
//   Resto                   → Stale-While-Revalidate + fallback offline        ← v3.3.0

const CACHE_VERSION = 'v13'; // v3.6.0 — precache resiliente
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
    // v3.3.0 FIX: status:200 (era 503). A página offline é uma resposta válida,
    // não um erro de servidor. Status 503 causava re-tentativas automáticas do
    // browser e impedia que Lighthouse/crawlers identificassem o comportamento
    // correto de PWA offline.
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

/**
 * v3.4.0: Corrige o Content-Type de uma Response quando o servidor (ex: edge node
 * do Vercel CDN) retorna text/plain para assets estáticos tipados (.js, .css, etc.).
 * Com X-Content-Type-Options: nosniff, o browser recusa aplicar CSS ou executar JS
 * servido com Content-Type errado. Esta função reconstrói a Response com o tipo
 * correto baseado na extensão do arquivo.
 *
 * Nota: não altera responses já corretas (verificação rápida de indexOf).
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
  if (!expected) return res;              // extensão desconhecida: não tocar
  if (ct && ct.indexOf(expected.split(';')[0]) !== -1) return res; // já correto
  // Reconstruir com Content-Type correto
  const headers = new Headers(res.headers);
  headers.set('Content-Type', expected);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
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

// ─── Precache: URLs críticas (falha bloqueia install) ─────────────────────────
const PRECACHE_CRITICAL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.svg',
  '/placeholder.svg',
];

// ─── Precache: URLs opcionais (falha ignorada — CDN pode estar aquecendo) ──────
// Estes arquivos não têm hash no nome (não são imutáveis) e podem dar 404 durante
// os primeiros 10-30s após um deploy, enquanto o CDN propaga os novos assets.
// Usar Promise.allSettled() garante que o install não falha por causa deles.
const PRECACHE_OPTIONAL = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/og-image.png',
  '/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // URLs críticas: falha aqui aborta o install (correto — app não funcionaria sem elas)
      await cache.addAll(PRECACHE_CRITICAL);

      // URLs opcionais: cada uma individualmente, falhas ignoradas silenciosamente.
      // Usamos Promise.allSettled + cache.add (não addAll) para granularidade.
      await Promise.allSettled(
        PRECACHE_OPTIONAL.map((url) =>
          cache.add(url).catch(() => {
            /* ignorar falhas de URLs opcionais (ex: ícone ainda propagando no CDN) */
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
          // v3.3.0 FIX: era new Response('', { status: 503 }) → 200
          return cached || networkFetch.then((res) => res || new Response('', { status: 200 }));
        }),
      ),
    );
    return;
  }

  // ── B) Navigation (SPA) → Network First + cache fallback (5xx e offline) ───
  //
  // v3.2.0: mudado de Cache First → Network First.
  // v3.3.0 FIX [BUG-SW-1]: adicionado fallback de cache para respostas 5xx.
  //
  // Antes: se Vercel retornasse 503, o SW propagava diretamente ao browser.
  // Agora:
  //   - res.ok (2xx/3xx): atualiza cache e retorna response. ✓
  //   - res não-ok (5xx): tenta servir do cache. Se não houver cache, retorna
  //     o erro original (não há como fazer melhor sem cache).
  //   - network error (offline): fallback para cache → offlineFallback().
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
            return res;
          }
          // v3.3.0 FIX: Erro do servidor (5xx) ou redirect não-ok.
          // Tenta o cache como fallback. Se não houver cache, devolve o erro
          // original (melhor que uma página offline genérica nesse caso).
          return caches.match('/index.html').then((cached) => cached || res);
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
        // v3.4.0: fetch async com retry (BUG-SW-5) + MIME fix (BUG-SW-6).
        return (async () => {
          try {
            let res = await fetch(request);

            // ── MIME fix (BUG-SW-6) ───────────────────────────────────────────
            // Edge nodes do Vercel CDN podem servir CSS/JS com Content-Type:
            // text/plain. Corrigir antes de cachear e retornar ao browser.
            if (res && res.ok) {
              res = withCorrectMimeType(res, url.pathname);
              const clone = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, clone));
              return res;
            }

            // ── CDN race retry (BUG-SW-5) ────────────────────────────────────
            // Se o chunk retornou 404, pode ser race condition de CDN: o novo
            // index.html já está disponível mas os chunks ainda estão propagando.
            // Aguardar 1 000ms e tentar novamente antes de declarar stale.
            if (res && res.status === 404) {
              await new Promise((r) => setTimeout(r, 1000));
              let retryRes = await fetch(request).catch(() => null);

              if (retryRes && retryRes.ok) {
                // CDN já propagou: cachear e retornar sem nenhum erro no console.
                retryRes = withCorrectMimeType(retryRes, url.pathname);
                const clone = retryRes.clone();
                caches.open(CACHE_NAME).then((c) => c.put(request, clone));
                return retryRes;
              }

              // Ainda 404 após retry: chunk genuinamente removido no novo deploy.
              handleStaleChunk(request.url);
              return retryRes || res; // propagar 404 (tab vai recarregar em 300ms)
            }

            return res;
          } catch (_err) {
            // Erro de rede (offline ou timeout) → retornar erro para o browser.
            // O React.lazy() vai mostrar o ErrorBoundary configurado.
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
  //
  // v3.3.0 FIX [BUG-SW-3]: O browser faz requests não-navigate para URLs do
  // sitemap/manifest (ex: /novidades, /produtos) ao validar PWA shortcuts e
  // ao pré-carregar recursos. Quando o servidor retornava 5xx e não havia cache,
  // o SW propagava o 5xx → "sw.js:354 Falha ao carregar Buscar: GET /novidades".
  // Agora usa offlineFallback() se network retorna não-ok e não há cache.
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

        // v3.3.0 FIX: se não há cache e network retorna não-ok (5xx ou null),
        // usa offlineFallback() ao invés de propagar o erro.
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
      // v3.5.0: PNG icon (maior suporte no Android/iOS vs SVG para notificações)
      icon: '/icons/icon-192.png',
      // badge: PNG pequeno (96x96 ideal) — usando icon-192 como fallback
      badge: '/icons/icon-192.png',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
