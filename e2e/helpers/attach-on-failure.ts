/**
 * Helper: captura automática de artefatos de depuração quando um invariant
 * do carrinho falha em CI.
 *
 * O `playwright.config.ts` já ativa trace/screenshot/video `retain-on-failure`,
 * mas isso NÃO captura:
 *   - o HTML renderizado no exato instante da falha
 *   - o contexto de domínio (quais cart IDs A/B/C, item IDs, sequência de
 *     mutações, viewport, etc.)
 *
 * `installFailureCapture(test)` adiciona um `afterEach` que anexa:
 *   1) `page-html`             — snapshot exato do DOM na falha, com um
 *      banner `<!-- DEBUG_CONTEXT: {...} -->` no topo.
 *   2) `page-context.json`     — URL, viewport, UA, title, timestamp.
 *   3) `debug-context.json`    — dados de domínio setados via helpers
 *      (`recordCarts`, `recordItems`, `recordMutation`, `recordNav`) ou
 *      diretamente com `setDebugContext`.
 *   4) `failure-screenshot.png`— screenshot full-page.
 *
 * Uso nos specs:
 *   installFailureCapture(test);
 *   // dentro do teste:
 *   recordCarts(testInfo, { A, B, C });
 *   recordItems(testInfo, 'A', itemIdsA);
 *   recordMutation(testInfo, { method: 'DELETE', cart: 'A', itemId });
 *   recordNav(testInfo, cartId);
 */
import type { TestType, TestInfo } from '@playwright/test';

type AnyTest = TestType<any, any>;

/**
 * Payload de contexto de domínio para depuração pós-falha.
 * Campos "canônicos" (carts/items/mutations/navSequence) são mesclados de
 * forma inteligente pelos helpers; qualquer outra chave é apenas overwrite.
 */
export interface DebugContext {
  carts?: Record<string, string>; // { A: '<uuid>', B: '<uuid>', ... }
  items?: Record<string, string[]>; // { A: ['<uuid>', ...], B: [...] }
  mutations?: MutationLog[];
  navSequence?: string[];
  viewport?: string;
  viewportSize?: { width: number; height: number };
  finalHeader?: { title: string; meta: string };
  [key: string]: unknown;
}

export interface MutationLog {
  ts: string;
  method: string;
  cart?: string; // rótulo lógico ('A'|'B'|'C') OU cart id
  itemId?: string;
  url?: string;
  note?: string;
}

// Registry por TestInfo — evita vazamento entre testes paralelos.
const DEBUG_BY_TEST = new WeakMap<TestInfo, DebugContext>();

function getOrInit(testInfo: TestInfo): DebugContext {
  let ctx = DEBUG_BY_TEST.get(testInfo);
  if (!ctx) {
    ctx = {};
    DEBUG_BY_TEST.set(testInfo, ctx);
  }
  return ctx;
}

/**
 * Registra/mescla contexto de depuração para o teste corrente. Chamável
 * várias vezes; entradas subsequentes fazem shallow-merge sobre as anteriores.
 * Para acumular listas (mutations/navSequence), use os helpers dedicados
 * (`recordMutation`, `recordNav`) — eles fazem append, não overwrite.
 */
export function setDebugContext(testInfo: TestInfo, data: DebugContext): void {
  const prev = getOrInit(testInfo);
  Object.assign(prev, data);
}

/** Registra o mapeamento de rótulos lógicos → cart IDs (A/B/C/...). */
export function recordCarts(
  testInfo: TestInfo,
  carts: Record<string, string>,
): void {
  const ctx = getOrInit(testInfo);
  ctx.carts = { ...(ctx.carts ?? {}), ...carts };
}

/** Registra IDs de itens observados para um cart (rótulo ou id). */
export function recordItems(
  testInfo: TestInfo,
  cartLabel: string,
  itemIds: string[],
): void {
  const ctx = getOrInit(testInfo);
  ctx.items = { ...(ctx.items ?? {}), [cartLabel]: [...itemIds] };
}

/** Anexa uma linha ao log de mutações (append). */
export function recordMutation(
  testInfo: TestInfo,
  entry: Omit<MutationLog, 'ts'> & { ts?: string },
): void {
  const ctx = getOrInit(testInfo);
  const list = ctx.mutations ?? [];
  list.push({ ts: entry.ts ?? new Date().toISOString(), ...entry });
  ctx.mutations = list;
}

/** Anexa uma navegação à sequência (append). */
export function recordNav(testInfo: TestInfo, cartIdOrLabel: string): void {
  const ctx = getOrInit(testInfo);
  const seq = ctx.navSequence ?? [];
  seq.push(cartIdOrLabel);
  ctx.navSequence = seq;
}

/** Getter para uso interno/inspeção nos specs (imutável — cópia rasa). */
export function getDebugContext(testInfo: TestInfo): DebugContext {
  return { ...(DEBUG_BY_TEST.get(testInfo) ?? {}) };
}

export function installFailureCapture(test: AnyTest): void {
  test.afterEach(async ({ page }, testInfo) => {
    const failed = testInfo.status !== testInfo.expectedStatus;
    if (!failed) return;

    const debug = DEBUG_BY_TEST.get(testInfo) ?? {};
    const debugJson = JSON.stringify(debug, null, 2);

    // 1) HTML completo — com banner de contexto no topo.
    try {
      const html = await page.content();
      const banner =
        `<!-- DEBUG_CONTEXT: ${JSON.stringify(debug)} -->\n` +
        `<!-- TEST: ${testInfo.title} · project=${testInfo.project.name} · ` +
        `viewport=${JSON.stringify(page.viewportSize())} -->\n`;
      await testInfo.attach('page-html', {
        body: banner + html,
        contentType: 'text/html; charset=utf-8',
      });
    } catch {
      /* page pode estar fechada; ignora. */
    }

    // 2) URL + viewport + user agent — contexto de reprodução.
    try {
      const meta = {
        url: page.url(),
        viewport: page.viewportSize(),
        userAgent: await page.evaluate(() => navigator.userAgent),
        title: await page.title().catch(() => null),
        timestamp: new Date().toISOString(),
        project: testInfo.project.name,
        testTitle: testInfo.title,
      };
      await testInfo.attach('page-context.json', {
        body: JSON.stringify(meta, null, 2),
        contentType: 'application/json',
      });
    } catch {
      /* noop */
    }

    // 3) debug-context.json — sempre presente (mesmo que vazio).
    try {
      await testInfo.attach('debug-context.json', {
        body: debugJson,
        contentType: 'application/json',
      });
    } catch {
      /* noop */
    }

    // 4) Screenshot full-page adicional.
    try {
      await testInfo.attach('failure-screenshot.png', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    } catch {
      /* noop */
    }
  });
}
