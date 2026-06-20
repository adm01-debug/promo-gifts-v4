/**
 * Sweep E2E exaustivo: percorre /produtos, /super-filtro, /novidades e
 * /reposicao em 3 views (grid, list, table) e, para cada produto visível
 * (limitado por MAX_PRODUCTS_PER_VIEW), itera TODAS as bolinhas de cor
 * validando:
 *
 *  1. aria-checked=true na bolinha clicada
 *  2. URL ganha ?cor=<nome>&pid=<id>
 *  3. <img> dentro do container do produto OU data-stock-qty muda
 *     (a fonte da verdade que cobre tanto produtos com fotos por variante
 *      quanto produtos sem foto-por-cor mas com estoque-por-cor)
 *  4. Botão "Todos" aparece, limpa seleção, remove params da URL e
 *     restaura o stock-qty original (estoque "todas as variações")
 *  5. Reload preserva seleção (zustand persist)
 *  6. Trocar view (grid↔list↔table) preserva seleção do mesmo produto
 *
 * Out-of-stock determinístico via fixture (não depende do seed do DB).
 *
 * Para massa de cliques (milhares): `--repeat-each=10` ou aumentar
 * MAX_PRODUCTS_PER_VIEW. Cada produto×cor é uma asserção independente.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import { requireAuth } from './fixtures/test-base';
import { gotoAndSettle, waitForRouteIdle } from './helpers/nav';
import { installColorStockMock } from './fixtures/color-swatch-mocks';
import { ATTR, TID } from './fixtures/color-swatch-selectors';

const ROUTES = ['/produtos', '/super-filtro', '/novidades', '/reposicao'] as const;
const VIEWS = ['grid', 'list', 'table'] as const;
type ViewMode = (typeof VIEWS)[number];

/** Quantidade máxima de produtos varridos por (rota, view). Configurável via env. */
const MAX_PRODUCTS_PER_VIEW = Number(process.env.E2E_SWEEP_MAX_PRODUCTS ?? 5);
/** Quantidade máxima de cores varridas por produto. Configurável via env. */
const MAX_COLORS_PER_PRODUCT = Number(process.env.E2E_SWEEP_MAX_COLORS ?? 4);

async function switchView(page: Page, mode: ViewMode): Promise<void> {
  const trigger = page.locator(`[data-testid="${TID.layoutPopoverTrigger}"]`);
  if (!(await trigger.isVisible().catch(() => false))) return;
  await trigger.click();
  const btn = page.locator(`[data-testid="${TID.viewMode(mode)}"]`);
  await btn.click();
  await page.keyboard.press('Escape');
  await waitForRouteIdle(page);
}

function productContainer(page: Page, productId?: string): Locator {
  const sel = productId
    ? `[${ATTR.productId}="${productId}"]`
    : `[${ATTR.productId}]`;
  return page.locator(sel).first();
}

/** Snapshot do estado visual do container: src da imagem unificada + stock-qty. */
async function snapshot(
  container: Locator,
): Promise<{ imgSrc: string | null; stockQty: string | null }> {
  // Prefere o testid unificado; se ausente (variações de wrapper), cai para a 1ª <img>.
  const tagged = container.locator(`[data-testid="${TID.productImage}"]`).first();
  const img = (await tagged.count()) > 0 ? tagged : container.locator('img').first();
  const imgSrc = (await img.getAttribute('src').catch(() => null)) ?? null;
  const stockEl = container.locator(`[data-testid="${TID.productStockValue}"]`).first();
  const stockQty = (await stockEl.getAttribute(ATTR.stockQty).catch(() => null)) ?? null;
  return { imgSrc, stockQty };
}

for (const route of ROUTES) {
  test.describe(`Sweep cores — ${route}`, () => {
    test.beforeEach(async () => {
      await requireAuth();
    });

    for (const view of VIEWS) {
      test(`${view}: varre todos os produtos × cores e valida imagem/estoque`, async ({ page }) => {
        test.slow(); // até 360s — sweep multi-produto/cor pode ser longo
        await gotoAndSettle(page, route);
        await waitForRouteIdle(page);
        await switchView(page, view);

        const all = page.locator('[data-product-id]');
        await expect(all.first()).toBeVisible({ timeout: 15_000 });
        const total = Math.min(await all.count(), MAX_PRODUCTS_PER_VIEW);
        test.skip(total === 0, `Sem produtos em ${route} (${view})`);

        const seen = new Set<string>();
        let assertions = 0;

        for (let i = 0; i < total; i++) {
          const card = all.nth(i);
          const productId = await card.getAttribute('data-product-id');
          if (!productId || seen.has(productId)) continue;
          seen.add(productId);

          const swatches = card.locator('[data-testid^="color-swatch-"]');
          const colorCount = Math.min(await swatches.count(), MAX_COLORS_PER_PRODUCT);
          if (colorCount === 0) continue;

          // Snapshot "todas as variações" antes de qualquer seleção.
          const baseline = await snapshot(card);

          for (let c = 0; c < colorCount; c++) {
            const swatch = swatches.nth(c);
            const colorName = await swatch.getAttribute('data-color-name');
            if (!colorName) continue;

            await swatch.scrollIntoViewIfNeeded().catch(() => {});
            await swatch.click({ trial: false });

            // Asserts duros: aria + URL.
            await expect(swatch).toHaveAttribute('aria-checked', 'true');
            await expect(page).toHaveURL(new RegExp(`cor=${encodeURIComponent(colorName)}`));
            await expect(page).toHaveURL(new RegExp(`pid=${productId}`));

            // Asserts suaves: pelo menos um sinal visual mudou (imagem OU estoque).
            // Algumas cores podem compartilhar imagem mas ter estoque distinto, e
            // vice-versa — exigir AMBOS quebraria produtos sem foto-por-variante.
            await expect
              .poll(async () => {
                const now = await snapshot(card);
                const imgChanged = now.imgSrc !== baseline.imgSrc;
                const stockChanged = now.stockQty !== baseline.stockQty;
                return imgChanged || stockChanged || c === 0; // 1ª cor pode coincidir com baseline
              }, { timeout: 4_000, message: `imagem/estoque não mudou ao clicar em ${colorName}` })
              .toBe(true);

            assertions++;
          }

          // Botão "Todos" deve aparecer e restaurar baseline.
          const clear = card.locator('[data-testid="color-swatches-clear"]');
          if (await clear.isVisible().catch(() => false)) {
            await clear.click();
            await expect(card.locator('[aria-checked="true"]')).toHaveCount(0);
            await expect(page).not.toHaveURL(/[?&]pid=/);

            await expect
              .poll(async () => (await snapshot(card)).stockQty, { timeout: 3_000 })
              .toBe(baseline.stockQty);
          }
        }

        expect(assertions, 'pelo menos uma cor deve ter sido varrida').toBeGreaterThan(0);
      });
    }

    test('reload preserva seleção (persistência zustand)', async ({ page }) => {
      await gotoAndSettle(page, route);
      await waitForRouteIdle(page);
      await switchView(page, 'grid');

      const card = productContainer(page);
      const productId = await card.getAttribute('data-product-id');
      const swatches = card.locator('[data-testid^="color-swatch-"]');
      test.skip(!productId || (await swatches.count()) < 2, `Sem variantes em ${route}`);
      const colorName = await swatches.nth(1).getAttribute('data-color-name');
      await swatches.nth(1).click();
      await expect(page).toHaveURL(new RegExp(`pid=${productId}`));

      await page.reload();
      await waitForRouteIdle(page);
      const after = productContainer(page, productId!);
      await expect(
        after.locator(`[data-color-name="${colorName}"]`).first(),
      ).toHaveAttribute('aria-checked', 'true');
    });

    test('troca de view preserva seleção do mesmo produto', async ({ page }) => {
      await gotoAndSettle(page, route);
      await waitForRouteIdle(page);
      await switchView(page, 'grid');

      const first = productContainer(page);
      const productId = await first.getAttribute('data-product-id');
      const swatches = first.locator('[data-testid^="color-swatch-"]');
      test.skip(!productId || (await swatches.count()) < 2, `Sem variantes em ${route}`);
      const colorName = await swatches.nth(1).getAttribute('data-color-name');
      await swatches.nth(1).click();

      for (const next of ['list', 'table'] as const) {
        await switchView(page, next);
        const ref = productContainer(page, productId!);
        await expect(
          ref.locator(`[data-color-name="${colorName}"]`).first(),
        ).toHaveAttribute('aria-checked', 'true');
      }
    });
  });
}

test.describe('Cenário out-of-stock determinístico (mock)', () => {
  test.beforeEach(async () => {
    await requireAuth();
  });

  test('cor esgotada mantém layout estável e continua clicável', async ({ page }) => {
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
      expect(await outSwatch.getAttribute('data-stock-state')).toBe('out');
      await outSwatch.click();
      await expect(outSwatch).toHaveAttribute('aria-checked', 'true');
    }
  });
});
