/**
 * Helpers de diagnóstico para specs Playwright.
 *
 * Objetivo: reduzir flakiness capturando artefatos ricos (screenshot,
 * HTML, snapshot do toast, console logs, page errors, requests recentes)
 * SOMENTE em caso de falha. Anexa tudo ao relatório Playwright via
 * `testInfo.attach()`, ficando disponível em `playwright-report/`.
 *
 * Uso típico:
 *
 *   const diag = attachDiagnosticsRecorder(page);
 *   test.afterEach(async ({ page }, testInfo) => {
 *     await dumpDiagnosticsIfFailed(page, testInfo, diag, "undo-toast");
 *   });
 */
import type { Page, TestInfo, ConsoleMessage, Request } from "@playwright/test";

export interface DiagnosticsRecorder {
  consoleLogs: string[];
  pageErrors: string[];
  recentRequests: Array<{ method: string; url: string; ts: number }>;
}

const MAX_REQUESTS = 200;
const MAX_CONSOLE = 500;

/**
 * Instala listeners na Page para gravar console/pageerror/requests.
 * Chame no início do teste (ou em beforeEach) — os arrays retornados
 * são preenchidos ao longo da execução.
 */
export function attachDiagnosticsRecorder(page: Page): DiagnosticsRecorder {
  const rec: DiagnosticsRecorder = {
    consoleLogs: [],
    pageErrors: [],
    recentRequests: [],
  };

  page.on("console", (msg: ConsoleMessage) => {
    if (rec.consoleLogs.length >= MAX_CONSOLE) return;
    try {
      rec.consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    } catch {
      /* noop */
    }
  });

  page.on("pageerror", (err: Error) => {
    rec.pageErrors.push(`${err.name}: ${err.message}\n${err.stack ?? ""}`);
  });

  page.on("request", (req: Request) => {
    if (rec.recentRequests.length >= MAX_REQUESTS) {
      rec.recentRequests.shift();
    }
    rec.recentRequests.push({
      method: req.method(),
      url: req.url(),
      ts: Date.now(),
    });
  });

  return rec;
}

/**
 * Coleta snapshot do estado atual do toast de "Desfazer" (se presente).
 * Retorna null se o toast não está no DOM.
 */
async function snapshotUndoToast(page: Page): Promise<Record<string, unknown> | null> {
  try {
    return await page.evaluate(() => {
      const toast = document.querySelector('[data-testid="undo-toast"]');
      if (!toast) return null;
      const btn = document.querySelector('[data-testid="undo-toast-button"]') as
        | HTMLButtonElement
        | null;
      const countdown = document.querySelector('[data-testid="undo-toast-countdown"]');
      return {
        toastHtml: toast.outerHTML,
        buttonDisabled: btn?.disabled ?? null,
        buttonAriaDisabled: btn?.getAttribute("aria-disabled") ?? null,
        buttonDataExpired: btn?.getAttribute("data-expired") ?? null,
        buttonDataRemainingSec: btn?.getAttribute("data-remaining-sec") ?? null,
        buttonDataRemainingMs: btn?.getAttribute("data-remaining-ms") ?? null,
        countdownText: countdown?.textContent ?? null,
        countdownRemainingSec: countdown?.getAttribute("data-remaining-sec") ?? null,
      };
    });
  } catch {
    return null;
  }
}

/**
 * Anexa artefatos de diagnóstico ao testInfo APENAS se o teste falhou.
 * - screenshot (PNG)
 * - HTML completo da página
 * - snapshot serializado do toast de Desfazer
 * - console logs (últimos 500)
 * - page errors
 * - requests recentes (últimos 200)
 * - URL atual + viewport
 */
export async function dumpDiagnosticsIfFailed(
  page: Page,
  testInfo: TestInfo,
  rec: DiagnosticsRecorder,
  label = "diag",
): Promise<void> {
  if (testInfo.status === testInfo.expectedStatus) return;

  const safeLabel = label.replace(/[^a-z0-9_-]/gi, "_");

  // 1) Screenshot (best-effort — não deve quebrar teardown se page fechou).
  try {
    const buf = await page.screenshot({ fullPage: false });
    await testInfo.attach(`${safeLabel}-screenshot.png`, {
      body: buf,
      contentType: "image/png",
    });
  } catch (err) {
    await testInfo.attach(`${safeLabel}-screenshot-error.txt`, {
      body: Buffer.from(String(err)),
      contentType: "text/plain",
    });
  }

  // 2) HTML completo (útil para inspecionar árvore quando testid some).
  try {
    const html = await page.content();
    await testInfo.attach(`${safeLabel}-page.html`, {
      body: Buffer.from(html),
      contentType: "text/html",
    });
  } catch (err) {
    await testInfo.attach(`${safeLabel}-page-html-error.txt`, {
      body: Buffer.from(String(err)),
      contentType: "text/plain",
    });
  }

  // 3) Snapshot do toast de Desfazer (foco desta suíte).
  const toastSnap = await snapshotUndoToast(page);
  await testInfo.attach(`${safeLabel}-undo-toast-snapshot.json`, {
    body: Buffer.from(JSON.stringify(toastSnap, null, 2)),
    contentType: "application/json",
  });

  // 4) URL + viewport + storage keys principais.
  try {
    const meta = await page.evaluate(() => ({
      url: window.location.href,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      docReadyState: document.readyState,
      undoToastPresent: !!document.querySelector('[data-testid="undo-toast"]'),
      undoButtonPresent: !!document.querySelector('[data-testid="undo-toast-button"]'),
    }));
    await testInfo.attach(`${safeLabel}-page-meta.json`, {
      body: Buffer.from(JSON.stringify(meta, null, 2)),
      contentType: "application/json",
    });
  } catch {
    /* noop */
  }

  // 5) Console + pageerror.
  await testInfo.attach(`${safeLabel}-console.log`, {
    body: Buffer.from(rec.consoleLogs.join("\n")),
    contentType: "text/plain",
  });
  if (rec.pageErrors.length > 0) {
    await testInfo.attach(`${safeLabel}-page-errors.log`, {
      body: Buffer.from(rec.pageErrors.join("\n---\n")),
      contentType: "text/plain",
    });
  }

  // 6) Requests recentes (últimos 200) — foco em /rest/v1/quotes e RPC.
  const requestsDump = rec.recentRequests
    .map((r) => `${new Date(r.ts).toISOString()} ${r.method} ${r.url}`)
    .join("\n");
  await testInfo.attach(`${safeLabel}-requests.log`, {
    body: Buffer.from(requestsDump),
    contentType: "text/plain",
  });
}
