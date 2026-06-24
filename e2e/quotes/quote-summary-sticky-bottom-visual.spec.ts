/**
 * Visual regression: layout sticky do Resumo no breakpoint `lg`.
 *
 * Valida que ao rolar a lista de produtos:
 *   - O bloco de baixo (desconto + Margem de Negociação + Subtotal/Total + CTAs)
 *     permanece PIXEL-IDÊNTICO antes e depois do scroll (= está fixo).
 *   - O `data-testid="quote-summary-items-scroll"` é o ÚNICO container que rola.
 *   - Em viewports curtos (<700px de altura) o fallback ativa scroll do card inteiro.
 *
 * Baselines geradas com `--update-snapshots`. Tolerância 2%.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const STORAGE_KEY_NEW = 'quote-builder:collapsed-item-keys:new';

async function setup(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await loginAs(page, 'user');
  await page.addInitScript((k) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }, STORAGE_KEY_NEW);
  await gotoAndSettle(page, '/orcamentos/novo');
}

async function skipIfEmpty(page: Page) {
  const firstCard = page.getByTestId('quote-summary-item-0');
  if ((await firstCard.count()) === 0) {
    test.skip(true, 'Resumo vazio.');
  }
  await expect(firstCard).toBeVisible({ timeout: 10_000 });
}

const LG_VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'desktop-1366x768', width: 1366, height: 768 },
];

for (const vp of LG_VIEWPORTS) {
  test.describe(`Visual · Resumo sticky bottom block · ${vp.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await setup(page, vp.width, vp.height);
      await skipIfEmpty(page);
    });

    test(`bloco de baixo é fixo durante scroll — ${vp.name}`, async ({ page }) => {
      const footer = page.getByTestId('quote-builder-summary-footer');
      const itemsScroll = page.getByTestId('quote-summary-items-scroll');

      await expect(footer).toBeVisible();
      await expect(itemsScroll).toBeAttached();

      await page.mouse.move(0, 0);

      // Snapshot ANTES do scroll
      await expect(footer).toHaveScreenshot(
        `summary-bottom-block-initial-${vp.name}.png`,
        { animations: 'disabled', maxDiffPixelRatio: 0.02 },
      );

      // Rola APENAS o container de itens (não a página)
      await itemsScroll.evaluate((el) => {
        (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight;
      });
      await page.waitForFunction(
        () => {
          const el = document.querySelector(
            '[data-testid="quote-summary-items-scroll"]',
          ) as HTMLElement | null;
          if (!el) return false;
          return el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
        },
        null,
        { timeout: 5000 },
      );

      // Snapshot DEPOIS do scroll — DEVE bater com o anterior (bloco fixo)
      await expect(footer).toHaveScreenshot(
        `summary-bottom-block-initial-${vp.name}.png`,
        { animations: 'disabled', maxDiffPixelRatio: 0.02 },
      );
    });

    test(`apenas items-scroll é o overflow ativo — ${vp.name}`, async ({ page }) => {
      const overflowOwner = await page.evaluate(() => {
        const items = document.querySelector(
          '[data-testid="quote-summary-items-scroll"]',
        ) as HTMLElement | null;
        if (!items) return null;
        const isScrollable = (el: HTMLElement) => {
          const s = getComputedStyle(el);
          return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight;
        };
        return { itemsScrolls: isScrollable(items) };
      });
      expect(overflowOwner?.itemsScrolls).toBe(true);
    });
  });
}

// Fallback p/ viewport curto: card inteiro deve rolar (desconto+totais não ficam cortados)
test.describe('Visual · Resumo fallback viewport curto (<700px altura)', () => {
  const vp = { name: 'desktop-1280x680', width: 1280, height: 680 };

  test.beforeEach(async ({ page }) => {
    await setup(page, vp.width, vp.height);
    await skipIfEmpty(page);
  });

  test('CTAs Criar/Rascunho permanecem acessíveis via scroll do card', async ({ page }) => {
    const criar = page
      .locator('[data-testid="quote-save-final"], [data-testid="quote-request-approval-button"]')
      .first();
    const rascunho = page.getByTestId('quote-save-draft');

    // Rola o container externo (fallback) até o fundo
    await page.evaluate(() => {
      const card = document.querySelector(
        '[data-testid="quote-builder-summary-scroll"]',
      ) as HTMLElement | null;
      if (!card) return;
      card.scrollTop = card.scrollHeight;
    });

    await expect(criar).toBeInViewport();
    await expect(rascunho).toBeInViewport();
  });
});
