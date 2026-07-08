/**
 * Helper: captura automática de artefatos de depuração quando um invariant
 * do carrinho falha em CI.
 *
 * O `playwright.config.ts` já ativa trace/screenshot/video `retain-on-failure`,
 * mas isso NÃO captura o HTML renderizado no exato instante da falha (útil
 * para diffs de hidratação / estado inconsistente).
 *
 * `installFailureCapture(test)` adiciona um `afterEach` que anexa:
 *   1) page.content() como HTML — snapshot exato do DOM na falha.
 *   2) console log agregado — se um teste opt-in coletou console messages.
 *   3) URL final + viewport — contexto rápido para triagem.
 *
 * Uso: nos specs que queremos priorizar debug, chamar
 *   installFailureCapture(test);
 * no topo do describe. Trace/video/screenshot vêm do config global.
 */
import type { TestType } from '@playwright/test';

type AnyTest = TestType<any, any>;

export function installFailureCapture(test: AnyTest): void {
  test.afterEach(async ({ page }, testInfo) => {
    const failed = testInfo.status !== testInfo.expectedStatus;
    if (!failed) return;

    // 1) HTML completo — inclui DOM hidratado, estado de erro, skeleton etc.
    try {
      const html = await page.content();
      await testInfo.attach('page-html', {
        body: html,
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
      };
      await testInfo.attach('page-context.json', {
        body: JSON.stringify(meta, null, 2),
        contentType: 'application/json',
      });
    } catch {
      /* noop */
    }

    // 3) Screenshot full-page adicional (o config já anexa 1× — aqui garantimos
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
