/**
 * Watcher determinístico para dialogs que NUNCA deveriam abrir durante um
 * fluxo E2E (ex.: `cart-selector-dialog`, `cart-company-picker-select`).
 *
 * Objetivo: falhar rápido, com mensagem descritiva, screenshot e HTML anexados
 * ao `test-results` (via `testInfo.attach`) — o próprio Playwright já captura
 * o trace do teste; os anexos deste helper complementam com o instante exato
 * em que o dialog reabriu, o seletor culpado e a URL corrente.
 *
 * Uso:
 *   const watcher = startForbiddenDialogWatcher(page, testInfo, {
 *     selectors: {
 *       "cart-selector-dialog": SEL_SELECTOR_DIALOG,
 *       "cart-company-picker-select": SEL_COMPANY_PICKER,
 *     },
 *     label: "checkout-after-switch",
 *   });
 *   try { ...fluxo... } finally { await watcher.stop(); }
 *   await watcher.assertNoHits(); // falha com msg rica se houver
 */
import type { Page, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";

export interface ForbiddenDialogHit {
  key: string;
  selector: string;
  url: string;
  at: string; // ISO timestamp
  screenshotPath?: string;
}

export interface DialogWatcherOptions {
  /** Mapa <chave humana> → seletor CSS/data-testid. */
  selectors: Record<string, string>;
  /** Rótulo curto usado no nome dos anexos (evita colisão entre watchers). */
  label: string;
  /** Intervalo de polling em ms. Default 100. */
  pollMs?: number;
}

export interface DialogWatcher {
  hits: ForbiddenDialogHit[];
  stop: () => Promise<void>;
  /**
   * Falha o teste com mensagem rica se `hits.length > 0`. Deve ser chamado
   * ao final do fluxo (após `stop()` implícito). Idempotente.
   */
  assertNoHits: () => Promise<void>;
}

export function startForbiddenDialogWatcher(
  page: Page,
  testInfo: TestInfo,
  opts: DialogWatcherOptions,
): DialogWatcher {
  const pollMs = opts.pollMs ?? 100;
  const hits: ForbiddenDialogHit[] = [];
  const seen = new Set<string>(); // dedupe por key — 1 hit por dialog basta

  const timer = setInterval(() => {
    for (const [key, selector] of Object.entries(opts.selectors)) {
      if (seen.has(key)) continue;
      void page
        .locator(selector)
        .first()
        .isVisible()
        .then(async (visible) => {
          if (!visible || seen.has(key)) return;
          seen.add(key);
          const at = new Date().toISOString();
          const url = page.url();
          let screenshotPath: string | undefined;
          try {
            const buf = await page.screenshot({ fullPage: false });
            const name = `forbidden-dialog__${opts.label}__${key}.png`;
            await testInfo.attach(name, { body: buf, contentType: "image/png" });
            screenshotPath = testInfo.outputPath(name);
          } catch {
            /* screenshot best-effort — não afeta o watcher */
          }
          try {
            const html = await page.content();
            await testInfo.attach(
              `forbidden-dialog__${opts.label}__${key}.html`,
              { body: html, contentType: "text/html" },
            );
          } catch {
            /* idem */
          }
          hits.push({ key, selector, url, at, screenshotPath });
        })
        .catch(() => {
          /* locator race — próximo tick tenta de novo */
        });
    }
  }, pollMs);

  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    // Aguarda 1 tick para promises pendentes anexarem seus artefatos.
    await new Promise((r) => setTimeout(r, pollMs + 20));
  };

  const assertNoHits = async () => {
    await stop();
    if (hits.length === 0) return;
    const lines = hits.map(
      (h) =>
        `  • [${h.at}] "${h.key}" (${h.selector}) abriu em ${h.url}` +
        (h.screenshotPath ? `\n    screenshot: ${h.screenshotPath}` : ""),
    );
    const msg =
      `Dialog(s) proibido(s) reabriram durante o fluxo "${opts.label}":\n` +
      lines.join("\n") +
      `\n(veja anexos "forbidden-dialog__${opts.label}__*.png/.html" no relatório Playwright + trace do teste)`;
    // Usa expect para gerar diff-friendly output no reporter.
    expect(hits, msg).toEqual([]);
  };

  return { hits, stop, assertNoHits };
}
