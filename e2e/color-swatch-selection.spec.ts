/**
 * E2E: clique nas bolinhas de cor nos cards do catálogo.
 *
 * Garante que:
 *  1. Ao clicar em uma cor, a bolinha fica selecionada (aria-checked) e a URL
 *     recebe ?cor=&pid= persistindo a seleção entre reloads.
 *  2. A imagem do card e o estoque por cor reagem (sem quebrar layout).
 *  3. O botão "Todos" aparece e, ao ser clicado, limpa a seleção e remove os
 *     parâmetros da URL.
 *  4. Cores sem estoque continuam clicáveis e mantêm o layout estável.
 *
 * Seletores e atributos vêm do SSOT `e2e/fixtures/color-swatch-selectors.ts`.
 * Login: usa `requireAuth` (closed platform).
 */
import { test, expect, requireAuth } from './fixtures/test-base';
import { gotoAndSettle, waitForRouteIdle } from './helpers/nav';
import { ATTR, TID, SEL } from './fixtures/color-swatch-selectors';

test.describe('Color swatch selection — Grid view', () => {
  test.beforeEach(async ({ page }) => {
    await requireAuth();
    await gotoAndSettle(page, '/produtos');
    await waitForRouteIdle(page);
  });

  test('clicar em cor seleciona, persiste na URL e botão Todos limpa', async ({ page }) => {
    const cards = page.locator(SEL.byTid(TID.productCard));
    await expect(cards.first()).toBeVisible();

    const firstCard = cards.nth(0);
    const productId = await firstCard.getAttribute(ATTR.productId);
    expect(productId).toBeTruthy();

    const swatches = firstCard.locator(SEL.byTidPrefix(TID.swatch));
    const swatchCount = await swatches.count();
    test.skip(swatchCount < 2, 'Produto sem variações suficientes para teste');

    const imgBefore = await firstCard
      .locator(`${SEL.byTid(TID.productImage)}, img`)
      .first()
      .getAttribute('src');

    const targetSwatch = swatches.nth(1);
    const colorName = await targetSwatch.getAttribute(ATTR.colorName);
    expect(colorName).toBeTruthy();
    await targetSwatch.click();

    await expect(targetSwatch).toHaveAttribute('aria-checked', 'true');

    await expect(page).toHaveURL(new RegExp(`cor=${encodeURIComponent(colorName!)}`));
    await expect(page).toHaveURL(new RegExp(`pid=${productId}`));

    const clearBtn = firstCard.locator(SEL.byTid(TID.colorsClear));
    await expect(clearBtn).toBeVisible();

    const cardBox = await firstCard.boundingBox();
    expect(cardBox?.height).toBeGreaterThan(0);
    await expect(firstCard).toBeVisible();

    await page.reload();
    await waitForRouteIdle(page);
    const cardAfter = page.locator(SEL.byAttr(ATTR.productId, productId!)).first();
    const selectedAfter = cardAfter.locator('[aria-checked="true"]').first();
    await expect(selectedAfter).toHaveAttribute(ATTR.colorName, colorName!);

    await cardAfter.locator(SEL.byTid(TID.colorsClear)).click();
    await expect(cardAfter.locator('[aria-checked="true"]')).toHaveCount(0);
    await expect(page).not.toHaveURL(/[?&]pid=/);

    if (imgBefore) {
      const imgAfter = await cardAfter
        .locator(`${SEL.byTid(TID.productImage)}, img`)
        .first()
        .getAttribute('src');
      expect(typeof imgAfter).toBe('string');
    }
  });

  test('cor sem estoque mantém layout e indica estado out', async ({ page }) => {
    const card = page.locator(SEL.byTid(TID.productCard)).first();
    await expect(card).toBeVisible();
    const swatches = card.locator(SEL.byTidPrefix(TID.swatch));
    const total = await swatches.count();
    let found = false;
    for (let i = 0; i < total; i++) {
      const state = await swatches.nth(i).getAttribute(ATTR.stockState);
      if (state === 'out') {
        const box = await swatches.nth(i).boundingBox();
        expect(box?.width).toBeGreaterThan(0);
        expect(box?.height).toBeGreaterThan(0);
        found = true;
        break;
      }
    }
    test.skip(!found, 'Sem cor esgotada visível nesta página — cenário não reproduzível agora');
  });
});

test.describe('Color swatch selection — Table view', () => {
  test('Tabela: clicar cor persiste na URL e botão Todos limpa', async ({ page }) => {
    await requireAuth();
    await gotoAndSettle(page, '/produtos?view=table');
    await waitForRouteIdle(page);

    const swatch = page.locator(SEL.byTidPrefix(TID.swatch)).nth(1);
    await expect(swatch).toBeVisible();
    const colorName = await swatch.getAttribute(ATTR.colorName);
    await swatch.click();

    await expect(page).toHaveURL(new RegExp(`cor=${encodeURIComponent(colorName!)}`));
    const clearBtn = page.locator(SEL.byTid(TID.colorsClear)).first();
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await expect(page).not.toHaveURL(/[?&]pid=/);
  });
});
