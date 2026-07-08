/**
 * Helper: captura automática de artefatos de depuração quando um invariant
 * do carrinho falha em CI.
 *
 * O `playwright.config.ts` já ativa trace/screenshot/video `retain-on-failure`,
 * mas isso NÃO captura:
 *   - o HTML renderizado no exato instante da falha
 *   - o contexto de domínio (quais cart IDs A/B/C, item IDs, viewport, etc.)
 *
 * `installFailureCapture(test)` adiciona um `afterEach` que anexa:
 *   1) `page-html`             — snapshot exato do DOM na falha.
 *   2) `page-context.json`     — URL, viewport, UA, title, timestamp.
 *   3) `failure-screenshot.png`— screenshot full-page.
 *   4) `debug-context.json`    — dados de domínio setados via `setDebugContext`
 *      (ex.: `{ cartA, cartB, cartC, itemIds }`). Injetado no HTML como
 *      comentário `<!-- DEBUG_CONTEXT: {...} -->` no topo, para leitura
 *      imediata ao baixar o artifact.
 *
 * Uso nos specs:
 *   installFailureCapture(test);
 *   // dentro do teste, quando conhecer os IDs:
 *   setDebugContext(testInfo, { cartA, cartB, cartC, itemIds });
 */
import type { TestType, TestInfo } from '@playwright/test';

type AnyTest = TestType<any, any>;

/**
 * Payload de contexto de domínio para depuração pós-falha.
 * Aberto de propósito — cada spec anota o que for útil (IDs, viewport, etc.).
 */
export type DebugContext = Record<string, unknown>;

// Registry por TestInfo — evita vazamento entre testes paralelos.
const DEBUG_BY_TEST = new WeakMap<TestInfo, DebugContext>();

/**
 * Registra/mescla contexto de depuração para o teste corrente. Chamável
 * várias vezes; entradas subsequentes são mescladas (Object.assign).
 */
export function setDebugContext(testInfo: TestInfo, data: DebugContext): void {
  const prev = DEBUG_BY_TEST.get(testInfo) ?? {};
  DEBUG_BY_TEST.set(testInfo, { ...prev, ...data });
}

export function installFailureCapture(test: AnyTest): void {
  test.afterEach(async ({ page }, testInfo) => {
    const failed = testInfo.status !== testInfo.expectedStatus;
    if (!failed) return;

    const debug = DEBUG_BY_TEST.get(testInfo) ?? {};
    const debugJson = JSON.stringify(debug, null, 2);

    // 1) HTML completo — com header contendo o debug-context inline,
    //    para depurador ler direto ao abrir o arquivo (sem precisar de JSON).
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
      // page pode estar fechada; ignora.
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

    // 3) debug-context.json — cart IDs, item IDs, sequência de navegação, etc.
    //    Fica sempre presente (mesmo que vazio) para consistência de artifacts.
    try {
      await testInfo.attach('debug-context.json', {
        body: debugJson,
        contentType: 'application/json',
      });
    } catch {
      /* noop */
    }

    // 4) Screenshot full-page adicional (config já anexa 1× — aqui garantimos
    //    presença mesmo se o retain-on-failure falhar por corrida).
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
