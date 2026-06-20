/**
 * Sweep E2E completo: percorre /produtos, /super-filtro, /novidades e
 * /reposicao em 3 views (grid, list, table) e valida:
 *
 *  1. Clique numa cor → bolinha fica selecionada (aria-checked=true)
 *  2. URL recebe ?cor=…&pid=…
 *  3. Botão "Todos" aparece, limpa seleção e remove os params da URL
 *  4. Reload mantém a cor selecionada (zustand persist)
 *  5. Trocar view (grid↔list↔table) preserva a seleção do mesmo produto
 *
 * Notas de robustez:
 *  - A view é trocada via UI (LayoutPopover) porque as 4 rotas usam estado
 *    interno (`useCatalogState`) com persistência em localStorage — não há
 *    suporte a `?view=` na URL.
 *  - Locator universal `[data-product-id]` cobre Card, ListItem e linha da
 *    Tabela (todos expõem o atributo).
 *
 * Cenário out-of-stock: usa fixture em `e2e/fixtures/color-swatch-mocks.ts`
 * para não depender do seed do banco.
 */
import { test, expect, type Page } from '@playwright/test';
import { requireAuth } from './fixtures/test-base';
import { gotoAndSettle, waitForRouteIdle } from './helpers/nav';
import { installColorStockMock } from './fixtures/color-swatch-mocks';

const ROUTES = ['/produtos', '/super-filtro', '/novidades', '/reposicao'] as const;
const VIEWS = ['grid', 'list', 'table'] as const;
type ViewMode = (typeof VIEWS)[number];

/** Alterna a view abrindo o LayoutPopover e clicando no preset alvo. */
async function switchView(page: Page, mode: ViewMode): Promise<void> {
  const trigger = page.locator('[data-testid="layout-popover-trigger"]');
  if (!(await trigger.isVisible().catch(() => false))) return; // página sem toolbar
  await trigger.click();
  const btn = page.locator(`[data-testid="view-mode-${mode}"]`);
  await btn.click();
  // Fecha o popover clicando fora e aguarda render
  await page.keyboard.press('Escape');
  await waitForRouteIdle(page);
}

/** Locator universal para o "container do produto" em qualquer view. */
function productContainer(page: Page, productId?: string) {
  const selector = productId ? `[data-product-id="${productId}"]` : '[data-product-id]';
  return page.locator(selector).first();
}

for (const route of ROUTES) {
  test.describe(`Sweep cores — ${route}`, () => {
    test.beforeEach(async () => {
      await requireAuth();
    });

    for (const view of VIEWS) {
      test(`${view}: clica cor → URL/aria/Todos/reload coerentes`, async ({ page }) => {
        await gotoAndSettle(page, route);
        await waitForRouteIdle(page);
        await switchView(page, view);

        const container = productContainer(page);
        await expect(container).toBeVisible({ timeout: 10_000 });
        const productId = await container.getAttribute('data-product-id');
        test.skip(!productId, `Sem productId em ${route} (${view})`);

        const swatches = container.locator('[data-testid^="color-swatch-"]');
        const count = await swatches.count();
        test.skip(count < 2, `Produto sem ≥2 variantes em ${route} (${view})`);

        const target = swatches.nth(1);
        const colorName = await target.getAttribute('data-color-name');
        await target.click();

        await expect(target).toHaveAttribute('aria-checked', 'true');
        await expect(page).toHaveURL(new RegExp(`cor=${encodeURIComponent(colorName!)}`));
        await expect(page).toHaveURL(new RegExp(`pid=${productId}`));

        const clearBtn = container.locator('[data-testid="color-swatches-clear"]');
        await expect(clearBtn).toBeVisible();

        await page.reload();
        await waitForRouteIdle(page);
        const after = productContainer(page, productId!);
        await expect(after.locator(`[data-color-name="${colorName}"]`).first()).toHaveAttribute(
          'aria-checked',
          'true',
        );

        await after.locator('[data-testid="color-swatches-clear"]').click();
        await expect(after.locator('[aria-checked="true"]')).toHaveCount(0);
        await expect(page).not.toHaveURL(/[?&]pid=/);
      });
    }

    test(`troca de view preserva seleção do mesmo produto`, async ({ page }) => {
      await gotoAndSettle(page, route);
      await waitForRouteIdle(page);
      await switchView(page, 'grid');

      const first = productContainer(page);
      const productId = await first.getAttribute('data-product-id');
      const swatches = first.locator('[data-testid^="color-swatch-"]');
      test.skip((await swatches.count()) < 2, `Sem variantes em ${route}`);
      const colorName = await swatches.nth(1).getAttribute('data-color-name');
      await swatches.nth(1).click();

      for (const next of ['list', 'table'] as const) {
        await switchView(page, next);
        const ref = productContainer(page, productId!);
        await expect(ref.locator(`[data-color-name="${colorName}"]`).first()).toHaveAttribute(
          'aria-checked',
          'true',
        );
      }
    });
  });
}

test.describe('Cenário out-of-stock determinístico (mock)', () => {
  test.beforeEach(async () => {
    await requireAuth();
  });

  test('cor esgotada mantém layout estável', async ({ page }) => {
    await gotoAndSettle(page, '/produtos');
    await waitForRouteIdle(page);
    const card = productContainer(page);
    const productId = await card.getAttribute('data-product-id');
    test.skip(!productId, 'Sem produto para mock');

    await installColorStockMock(page, { productId: productId! });
    await page.reload();
    await waitForRouteIdle(page);

    const target = productContainer(page, productId!);
    const outSwatch = target.locator('[data-color-name="Preto Mock"]').first();
    if (await outSwatch.isVisible().catch(() => false)) {
      const box = await outSwatch.boundingBox();
      expect(box?.width).toBeGreaterThan(0);
      expect(box?.height).toBeGreaterThan(0);
      await outSwatch.click();
      await expect(target).toBeVisible();
    }
  });
});
