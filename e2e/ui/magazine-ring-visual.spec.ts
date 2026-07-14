/**
 * Regressão visual pixel-perfect do highlight de teclado (`focus-visible:ring-*`)
 * e do estado base (`ring-primary` / `ring-amber-500`) nos thumbs do
 * `PreviewSidebar` — fecha o gap M5 da auditoria (variantes de ring que só
 * existem em CSS real e não em jsdom).
 *
 * Matriz: 4 breakpoints × 3 estados =  12 baselines PNG.
 *   Breakpoints: 375 (mobile) · 640 (sm) · 768 (md) · 1280 (xl)
 *   Estados:
 *     - default    : nenhum thumb ativo/destacado/focado
 *     - active     : thumb #1 com `ring-2 ring-primary` (aria-current)
 *     - focus-tab  : foco por teclado em thumb #2 (`focus-visible:ring-primary`)
 *
 * Estratégia:
 *   1. Abre o harness `/__test/magazine-ring` com params determinísticos.
 *   2. Injeta CSS para desligar animações/transições/caret.
 *   3. Para o estado `focus-tab`, dispara Tabs REAIS do teclado até chegar
 *      no thumb alvo — isso ativa `:focus-visible` (o polyfill programático
 *      `focus()` não dispara essa pseudo-classe em Chromium).
 *   4. Snapshot com clip no container `magazine-ring-thumbs`.
 *
 * Como atualizar baselines:
 *   npm run e2e:magazine-ring:update
 */
import { test, expect, type Page } from '@playwright/test';

const BREAKPOINTS = [
  { name: 'mobile', width: 375 },
  { name: 'sm', width: 640 },
  { name: 'md', width: 768 },
  { name: 'xl', width: 1280 },
] as const;

// Deriva do ARIA landmark em vez de contar Tabs — resiliente à mudança de
// ordem tabulável de elementos externos ao container de thumbs.
async function focusThumbByKeyboard(page: Page, thumbIdx: number): Promise<void> {
  // Foca o primeiro thumb via seu vizinho anterior (body) + Tab até bater.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  // No máximo 40 Tabs (safety-net contra loop infinito em regressão de a11y).
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const isTarget = await page.evaluate((idx) => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && el.getAttribute('data-testid') === `thumb-${idx}`;
    }, thumbIdx);
    if (isTarget) return;
  }
  throw new Error(`focusThumbByKeyboard: não chegou em thumb-${thumbIdx} após 40 Tabs`);
}

async function openHarness(
  page: Page,
  query: Record<string, string | number>,
): Promise<void> {
  const qs = new URLSearchParams(
    Object.entries(query).map(([k, v]) => [k, String(v)]),
  ).toString();
  await page.goto(`/__test/magazine-ring?${qs}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="harness-ready"]');
  // Desliga animações/transições/caret para snapshot 100% determinístico.
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
    `,
  });
}

for (const bp of BREAKPOINTS) {
  test.describe(`Magazine PreviewSidebar rings — ${bp.name} (${bp.width}px)`, () => {
    test.use({ viewport: { width: bp.width, height: 720 } });

    test(`baseline default (${bp.name})`, async ({ page }) => {
      await openHarness(page, { count: 6, active: -1, highlight: -1, focus: -1 });
      const container = page.getByTestId('magazine-ring-thumbs');
      await expect(container).toBeVisible();
      await expect(container).toHaveScreenshot(
        `magazine-ring-${bp.name}-default.png`,
        { maxDiffPixelRatio: 0.02, animations: 'disabled' },
      );
    });

    test(`baseline active + highlighted (${bp.name})`, async ({ page }) => {
      // active=1 (ring-primary) e highlight=3 (ring-amber-500) — valida que
      // as duas variantes coexistem em thumbs distintos sem colidir.
      await openHarness(page, { count: 6, active: 1, highlight: 3, focus: -1 });
      const container = page.getByTestId('magazine-ring-thumbs');
      await expect(container).toBeVisible();
      await expect(container).toHaveScreenshot(
        `magazine-ring-${bp.name}-active-highlighted.png`,
        { maxDiffPixelRatio: 0.02, animations: 'disabled' },
      );
    });

    test(`focus-visible via Tab (${bp.name})`, async ({ page }) => {
      // Sem active/highlight — isolamos o efeito de `:focus-visible`.
      await openHarness(page, { count: 6, active: -1, highlight: -1, focus: -1 });
      await focusThumbByKeyboard(page, 2);
      const container = page.getByTestId('magazine-ring-thumbs');
      await expect(container).toBeVisible();
      // Confirma o pseudo-estado antes de tirar o snapshot.
      const focusMatches = await page
        .getByTestId('thumb-2')
        .evaluate((el) => el.matches(':focus-visible'));
      expect(focusMatches, 'thumb-2 deve estar em :focus-visible após Tab').toBe(true);
      await expect(container).toHaveScreenshot(
        `magazine-ring-${bp.name}-focus-visible.png`,
        { maxDiffPixelRatio: 0.02, animations: 'disabled' },
      );
    });
  });
}
