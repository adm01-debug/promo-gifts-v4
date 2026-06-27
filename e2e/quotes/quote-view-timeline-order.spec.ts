/**
 * Garante a nova disposição do QuoteViewPage:
 *   1. <QuoteStatusTimeline> renderiza ANTES do cabeçalho (h1 + botões).
 *   2. O cabeçalho fica fora do container do conteúdo (Card do orçamento).
 *   3. Em mobile (375px) timeline e header não sobrepõem o container ao rolar.
 *
 * Roda em light e dark — alterna via `localStorage.theme` antes de navegar.
 *
 * Estratégia: navega para `/orcamentos`, abre o primeiro orçamento da lista.
 * Se a lista estiver vazia (ambiente sem seed), o teste é pulado com mensagem
 * clara — evita falso negativo em CIs sem dados.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

async function openFirstQuote(page: Page): Promise<boolean> {
  await gotoAndSettle(page, '/orcamentos');
  const row = page.locator('a[href^="/orcamentos/"]').first();
  if ((await row.count()) === 0) return false;
  await row.click();
  await page.waitForURL(/\/orcamentos\/[a-f0-9-]{36}/, { timeout: 10_000 });
  await expect(page.getByTestId('page-title-quote-view')).toBeVisible();
  return true;
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`QuoteViewPage · disposição (${theme})`, () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, 'user');
      await page.addInitScript((t) => {
        try {
          window.localStorage.setItem('theme', t);
          document.documentElement.classList.toggle('dark', t === 'dark');
        } catch {
          /* ignore */
        }
      }, theme);
    });

    test(`timeline renderiza antes do header e botões ficam acima do container — ${theme}`, async ({ page }) => {
      const opened = await openFirstQuote(page);
      test.skip(!opened, 'Sem orçamentos no ambiente — seed necessário.');

      const timeline = page.getByTestId('quote-status-timeline');
      const title = page.getByTestId('page-title-quote-view');
      await expect(timeline).toBeVisible();
      await expect(title).toBeVisible();

      // 1. Ordem no DOM: timeline precede h1 do header.
      const order = await page.evaluate(() => {
        const tl = document.querySelector('[data-testid="quote-status-timeline"]');
        const h1 = document.querySelector('[data-testid="page-title-quote-view"]');
        if (!tl || !h1) return null;
        const pos = tl.compareDocumentPosition(h1);
        // 0x04 = DOCUMENT_POSITION_FOLLOWING → h1 segue a timeline.
        return Boolean(pos & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      expect(order, 'QuoteStatusTimeline deve preceder o h1 do header').toBe(true);

      // 2. Header não é descendente do Card de conteúdo (fica acima do container).
      const headerOutside = await page.evaluate(() => {
        const h1 = document.querySelector('[data-testid="page-title-quote-view"]');
        const card = h1?.closest('.print\\:hidden');
        // h1 não pode estar dentro do CardContent — busca o ancestral mais próximo
        // com class "space-y-4" (CardContent) e garante que não exista.
        const cc = h1?.closest('[class*="CardContent"], .space-y-4');
        return Boolean(h1) && !cc?.contains(h1!) ? true : !cc;
      });
      expect(headerOutside, 'Header deve estar fora do CardContent do orçamento').toBe(true);

      // 3. Box geométrico: bottom da timeline ≤ top do header.
      const boxes = await page.evaluate(() => {
        const tl = document.querySelector('[data-testid="quote-status-timeline"]')!.getBoundingClientRect();
        const h1 = document.querySelector('[data-testid="page-title-quote-view"]')!.getBoundingClientRect();
        return { tlBottom: tl.bottom, h1Top: h1.top };
      });
      expect(boxes.tlBottom).toBeLessThanOrEqual(boxes.h1Top + 1);
    });

    test(`mobile 375 — timeline e header não sobrepõem o container ao rolar — ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 720 });
      const opened = await openFirstQuote(page);
      test.skip(!opened, 'Sem orçamentos no ambiente — seed necessário.');

      const timeline = page.getByTestId('quote-status-timeline');
      const title = page.getByTestId('page-title-quote-view');
      await expect(timeline).toBeVisible();
      await expect(title).toBeVisible();

      // Rola até o fim e confirma que não há sobreposição visual entre header
      // (não-sticky) e o conteúdo do orçamento.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(150);

      const overlap = await page.evaluate(() => {
        const h1 = document.querySelector('[data-testid="page-title-quote-view"]') as HTMLElement | null;
        const content = document.querySelector('[class*="CardContent"], .space-y-4') as HTMLElement | null;
        if (!h1 || !content) return false;
        const a = h1.getBoundingClientRect();
        const b = content.getBoundingClientRect();
        const horizontalOverlap = a.left < b.right && a.right > b.left;
        const verticalOverlap = a.top < b.bottom && a.bottom > b.top;
        return horizontalOverlap && verticalOverlap;
      });
      expect(overlap, 'Header não deve sobrepor o container do orçamento').toBe(false);
    });
  });
}
