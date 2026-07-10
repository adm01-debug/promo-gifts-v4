#!/usr/bin/env node
/**
 * Smoke test leve: garante que `cartViewModePrefs.ts` carrega SEM ERRO
 * mesmo em ambiente onde `window`/`localStorage` são inexistentes
 * (SSR, Node, worker) OU onde acesso a `localStorage` lança SecurityError.
 *
 * Roda com `tsx` no gate CI — não usa vitest/jsdom.
 * Sai com código != 0 em qualquer regressão.
 */

/* eslint-disable no-console */

// 1) Ambiente puramente Node — nenhum window.
//    O módulo NÃO deve tocar globals no import.
(async () => {
  try {
    // @ts-expect-error — path relativo do repo, resolvido pelo tsx
    const mod = await import('../../src/pages/products/seller-carts/cartViewModePrefs.ts');

    const {
      CART_VIEW_MODE_DEFAULT,
      detectStorageBackend,
      getSafeStorage,
      loadCartViewMode,
      persistCartViewMode,
    } = mod;

    if (CART_VIEW_MODE_DEFAULT !== 'list') {
      throw new Error(`CART_VIEW_MODE_DEFAULT deveria ser "list", got ${CART_VIEW_MODE_DEFAULT}`);
    }

    // Sem window → detectStorageBackend cai em "memory".
    const backend1 = detectStorageBackend();
    if (backend1 !== 'memory') {
      throw new Error(`Sem window esperado backend "memory", got "${backend1}"`);
    }

    // Ciclo completo em memória — não pode lançar.
    const safe = getSafeStorage();
    const now = new Date(2026, 6, 10, 9, 0, 0);
    const first = loadCartViewMode('smoke-uid', { storage: safe, now });
    if (first.viewMode !== 'list' || first.reset !== true) {
      throw new Error(`Load inicial esperado {list, reset=true}, got ${JSON.stringify(first)}`);
    }
    persistCartViewMode('smoke-uid', 'grid', { storage: safe, now });
    const second = loadCartViewMode('smoke-uid', { storage: safe, now });
    if (second.viewMode !== 'grid' || second.reset !== false) {
      throw new Error(`Load 2 esperado {grid, reset=false}, got ${JSON.stringify(second)}`);
    }

    // 2) Simula window com localStorage que LANÇA no acesso.
    //    O helper deve degradar para memória sem lançar.
    // @ts-expect-error inject
    globalThis.window = {
      get localStorage() {
        throw new Error('SecurityError');
      },
      get sessionStorage() {
        throw new Error('SecurityError');
      },
    };
    const backend2 = detectStorageBackend();
    if (backend2 !== 'memory') {
      throw new Error(`Com storage bloqueado esperado "memory", got "${backend2}"`);
    }
    const safe2 = getSafeStorage();
    persistCartViewMode('u-blocked', 'table', { storage: safe2, now });
    const r = loadCartViewMode('u-blocked', { storage: safe2, now });
    if (r.viewMode !== 'table') {
      throw new Error(`Reload em storage bloqueado esperado "table", got ${r.viewMode}`);
    }

    console.log('[smoke] cartViewModePrefs OK — carrega e opera sem storage disponível.');
    process.exit(0);
  } catch (err) {
    console.error('[smoke] FAIL:', err instanceof Error ? err.stack : err);
    process.exit(1);
  }
})();
