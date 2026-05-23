/**
 * Helpers de espera retryáveis — anti-flake (10/10).
 *
 * Política:
 *  - Sempre que possível, espere por `data-testid` (SSOT em `e2e/fixtures/selectors.ts`).
 *  - Não use `waitForTimeout` arbitrário — prefira `waitForTestIdVisible`,
 *    `waitForTestIdHidden`, `waitForTestIdCount` ou `pollUntil`.
 *  - Toda função aqui é idempotente, com timeout configurável e mensagem
 *    de erro descritiva (inclui o testid/seletor) para diagnóstico rápido.
 *
 * Uso:
 *   import { waitForTestIdVisible, waitForTestIdHidden } from "../helpers/waits";
 *   await waitForTestIdVisible(page, "login-form");
 *   await waitForTestIdHidden(page, "global-spinner");
 */
import { expect, type Locator, type Page } from "@playwright/test";

import { TID, TID_PREFIX } from "../fixtures/selectors";

// CI dobra o timeout para alinhar com `expect.timeout`/`actionTimeout` do
// playwright.config.ts (45s/30s no CI), que absorvem a hidratação SPA pesada
// (~10s de parse/eval JS no primeiro acesso). Local mantém 10s para detectar
// regressões reais cedo. Fonte: REDEPLOY-T14-E2E-FIX (2026-05-22).
const DEFAULT_TIMEOUT = process.env.CI ? 30_000 : 10_000;
const DEFAULT_POLL_INTERVAL = 200;

export interface WaitOpts {
  /** Timeout total em ms. Default: 10_000 (local) / 30_000 (CI). */
  timeout?: number;
  /** Mensagem extra para diagnóstico no erro. */
  message?: string;
}

/**
 * Aguarda um elemento por `data-testid` ficar visível.
 * Retorna o `Locator` (já restrito a `.first()`) para encadear ações.
 */
export async function waitForTestIdVisible(
  page: Page,
  testId: string,
  opts: WaitOpts = {},
): Promise<Locator> {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  const loc = page.locator(TID(testId)).first();
  try {
    await loc.waitFor({ state: "visible", timeout });
  } catch (err) {
    throw new Error(
      `[waitForTestIdVisible] testid="${testId}" não ficou visível em ${timeout}ms` +
        (opts.message ? ` — ${opts.message}` : "") +
        `\n  causa: ${(err as Error).message}`,
    );
  }
  return loc;
}

/**
 * Aguarda um elemento por `data-testid` desaparecer (detached ou hidden).
 */
export async function waitForTestIdHidden(
  page: Page,
  testId: string,
  opts: WaitOpts = {},
): Promise<void> {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  const loc = page.locator(TID(testId)).first();
  try {
    await loc.waitFor({ state: "hidden", timeout });
  } catch (err) {
    throw new Error(
      `[waitForTestIdHidden] testid="${testId}" ainda visível após ${timeout}ms` +
        (opts.message ? ` — ${opts.message}` : "") +
        `\n  causa: ${(err as Error).message}`,
    );
  }
}

/**
 * Aguarda contagem específica de elementos com o mesmo `data-testid`.
 * Útil para listas e grids reagindo a mutações.
 */
export async function waitForTestIdCount(
  page: Page,
  testId: string,
  expected: number,
  opts: WaitOpts = {},
): Promise<void> {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  const locator = page.locator(TID(testId));
  await expect
    .poll(() => locator.count(), {
      timeout,
      intervals: [100, 200, 400, 800],
      message:
        `[waitForTestIdCount] testid="${testId}" esperado=${expected}` +
        (opts.message ? ` — ${opts.message}` : ""),
    })
    .toBe(expected);
}

/**
 * Aguarda contagem mínima de elementos por prefixo de `data-testid`.
 * Ex.: `waitForTestIdPrefixAtLeast(page, "quote-item-", 1)`.
 */
export async function waitForTestIdPrefixAtLeast(
  page: Page,
  testIdPrefix: string,
  min: number,
  opts: WaitOpts = {},
): Promise<Locator> {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  const locator = page.locator(TID_PREFIX(testIdPrefix));
  await expect
    .poll(() => locator.count(), {
      timeout,
      intervals: [100, 200, 400, 800],
      message:
        `[waitForTestIdPrefixAtLeast] prefix="${testIdPrefix}" min=${min}` +
        (opts.message ? ` — ${opts.message}` : ""),
    })
    .toBeGreaterThanOrEqual(min);
  return locator;
}

/**
 * Polling genérico até `predicate()` retornar truthy. Use só quando
 * a verificação não couber em um locator (ex.: estado de localStorage).
 */
export async function pollUntil<T>(
  predicate: () => Promise<T> | T,
  opts: WaitOpts & { intervalMs?: number } = {},
): Promise<T> {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  const interval = opts.intervalMs ?? DEFAULT_POLL_INTERVAL;
  const deadline = Date.now() + timeout;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const v = await predicate();
      if (v) return v;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(
    `[pollUntil] condição não satisfeita em ${timeout}ms` +
      (opts.message ? ` — ${opts.message}` : "") +
      (lastErr ? `\n  último erro: ${(lastErr as Error).message ?? lastErr}` : ""),
  );
}

/**
 * Re-tenta uma ação que pode falhar transitoriamente (ex.: clique que
 * dispara navegação concorrente). Falhas suaves entre tentativas.
 */
export async function retry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: { attempts?: number; intervalMs?: number; message?: string } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const interval = opts.intervalMs ?? 300;
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn(i);
    } catch (err) {
      lastErr = err;
      if (i < attempts) await new Promise((r) => setTimeout(r, interval));
    }
  }
  throw new Error(
    `[retry] falhou após ${attempts} tentativas` +
      (opts.message ? ` — ${opts.message}` : "") +
      `\n  último erro: ${(lastErr as Error)?.message ?? lastErr}`,
  );
}

/**
 * Clica em um elemento por testid com espera de visibilidade prévia
 * e retry automático para suavizar race-conditions de hidratação.
 */
export async function clickTestId(
  page: Page,
  testId: string,
  opts: WaitOpts & { attempts?: number } = {},
): Promise<void> {
  await retry(
    async () => {
      const loc = await waitForTestIdVisible(page, testId, opts);
      await loc.click({ timeout: opts.timeout ?? DEFAULT_TIMEOUT });
    },
    { attempts: opts.attempts ?? 2, message: `clickTestId(${testId})` },
  );
}

/**
 * Wrapper de `expect(...).toBeVisible()` com mensagem descritiva e timeout
 * padrão. Use sempre que o teste estiver "asserting" presença visual.
 */
export async function expectVisibleByTestId(
  page: Page,
  testId: string,
  opts: WaitOpts = {},
): Promise<void> {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  const loc = page.locator(TID(testId)).first();
  await expect(loc, opts.message ?? `testid="${testId}" deveria estar visível`)
    .toBeVisible({ timeout });
}

/* ============================================================
 * Helpers de navegação anti-flake (smoke / CI)
 * ============================================================ */

/** Erros transitórios que JUSTIFICAM um retry de navegação. */
const TRANSIENT_NAV_ERRORS =
  /(net::ERR_|chunk|loading css chunk|loading dynamic import|Failed to fetch|Navigation timeout|interrupted|aborted)/i;

export interface GotoRetryOpts {
  /** Tentativas totais. Default: 2 (1ª + 1 retry). */
  attempts?: number;
  /** Timeout por tentativa (passado ao `page.goto`). Default: 25_000. */
  perAttemptTimeout?: number;
  /** Estado de load aguardado pelo `goto`. Default: "domcontentloaded". */
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  /** Espera entre tentativas (ms). Default: 500. */
  intervalMs?: number;
}

/**
 * `page.goto` com retry automático em erros transitórios típicos do CI
 * (chunks 502/503/504, navigation timeout, ERR_NETWORK_CHANGED, etc).
 *
 * Erros NÃO transitórios (assertion, sintaxe) propagam imediatamente para
 * preservar diagnóstico. NÃO retenta status HTTP — use mocks/fixtures.
 */
export async function gotoWithRetry(
  page: Page,
  url: string,
  opts: GotoRetryOpts = {},
): Promise<void> {
  const attempts = opts.attempts ?? 2;
  const timeout = opts.perAttemptTimeout ?? 25_000;
  const waitUntil = opts.waitUntil ?? "domcontentloaded";
  const interval = opts.intervalMs ?? 500;

  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      await page.goto(url, { waitUntil, timeout });
      return;
    } catch (err) {
      lastErr = err;
      const msg = (err as Error)?.message ?? String(err);
      const transient = TRANSIENT_NAV_ERRORS.test(msg);
      if (!transient || i === attempts) {
        throw new Error(
          `[gotoWithRetry] falhou ao navegar para "${url}" após ${i} tentativa(s) — ${msg}`,
        );
      }
      await new Promise((r) => setTimeout(r, interval));
    }
  }
  throw lastErr ?? new Error(`[gotoWithRetry] estado inválido em ${url}`);
}

export interface PageReadyOpts {
  /** Timeout total da fase de readiness. Default: 20_000. */
  timeout?: number;
  /**
   * `data-testid` que indica conteúdo significativo renderizado.
   * Quando informado, é o gate principal de "pronto".
   */
  readyTestId?: string;
  /**
   * Slug de página esperado (`page-title-<slug>`) — atalho conveniente para
   * rotas com título canônico no SSOT de selectors.
   */
  pageSlug?: string;
  /** Aguardar `networkidle` adicional após o ready. Default: false. */
  networkIdle?: boolean;
}

/**
 * **Espera robusta de "página pronta"** — combinação de:
 *  1. `domcontentloaded` (idempotente).
 *  2. `readyTestId` ou `page-title-<slug>` visível (conteúdo real).
 *  3. Ausência de loaders pendurados (`[data-state="loading"]`).
 *  4. Opcional: `networkidle`.
 *
 * Use sempre no smoke/CI em vez de `waitForLoadState("domcontentloaded")` solto.
 */
export async function waitForPageReady(
  page: Page,
  opts: PageReadyOpts = {},
): Promise<void> {
  const timeout = opts.timeout ?? 20_000;
  const deadline = Date.now() + timeout;
  const remaining = () => Math.max(500, deadline - Date.now());

  // 1. domcontentloaded (idempotente).
  await page.waitForLoadState("domcontentloaded", { timeout: remaining() });

  // 2. Conteúdo significativo: prioridade readyTestId → pageSlug → heurística.
  if (opts.readyTestId) {
    await waitForTestIdVisible(page, opts.readyTestId, {
      timeout: remaining(),
      message: `waitForPageReady aguardando readyTestId`,
    });
  } else if (opts.pageSlug) {
    await waitForTestIdVisible(page, `page-title-${opts.pageSlug}`, {
      timeout: remaining(),
      message: `waitForPageReady aguardando page-title-${opts.pageSlug}`,
    });
  } else {
    // Heurística: qualquer `page-title-*` OU body com altura > 0.
    await page
      .waitForFunction(
        () => {
          const hasTitle = !!document.querySelector('[data-testid^="page-title-"]');
          const bodyOk = (document.body?.scrollHeight ?? 0) > 0;
          return hasTitle || bodyOk;
        },
        undefined,
        { timeout: remaining() },
      )
      .catch(() => {
        /* fallback silencioso */
      });
  }

  // 3. Sem loaders pendurados (best-effort, cap em 5s).
  await page
    .waitForFunction(
      () => !document.querySelector('[data-state="loading"]:not([data-allow-loading])'),
      undefined,
      { timeout: Math.min(5_000, remaining()) },
    )
    .catch(() => {});

  // 4. networkidle opcional.
  if (opts.networkIdle) {
    await page.waitForLoadState("networkidle", { timeout: remaining() }).catch(() => {});
  }
}

/**
 * **Atalho preferido para smoke**: navega com retry + espera readiness completa.
 * Combina `gotoWithRetry` + `waitForPageReady` em chamada determinística.
 */
export async function gotoAndWaitReady(
  page: Page,
  url: string,
  opts: GotoRetryOpts & PageReadyOpts = {},
): Promise<void> {
  await gotoWithRetry(page, url, opts);
  await waitForPageReady(page, opts);
}
