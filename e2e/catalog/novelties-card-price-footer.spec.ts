/**
 * E2E — footer de preço/estoque no card de Novidades.
 *
 * Valida:
 *  - "A partir de" aparece acima do preço
 *  - container do preço/estoque tem `mt-auto` (ancorado ao rodapé do card)
 *  - bottom do footer fica próximo do bottom do card (≤ 24px de gap)
 */
import { test, expect } from '../fixtures/test-base';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Novidades — card grid: preço + estoque no rodapé', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await gotoAndSettle(page, '/novidades');
  });

  test('"A partir de" aparece acima do preço e footer fica no final do card', async ({
    page,
  }) => {
    const card = page.locator('[data-testid="novelty-grid-card"]').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    const footer = card.locator('[data-testid="novelty-card-footer"]');
    await expect(footer).toBeVisible();

    const priceBlock = footer.locator('[data-testid="novelty-card-price"]');
    const unavailable = footer.locator('[data-testid="novelty-card-price-unavailable"]');

    if ((await priceBlock.count()) > 0) {
      const prefix = priceBlock.locator('[data-testid="novelty-card-price-prefix"]');
      await expect(prefix).toHaveText(/A partir de/i);

      // "A partir de" precisa estar geometricamente acima do preço.
      const prefixBox = await prefix.boundingBox();
      const priceBox = await priceBlock.boundingBox();
      if (prefixBox && priceBox) {
        expect(prefixBox.y).toBeLessThan(priceBox.y + priceBox.height);
      }
    } else {
      // fallback de preço inválido — não pode quebrar o layout
      await expect(unavailable).toHaveText(/Sob consulta/i);
    }

    // footer ancorado ao rodapé: distância do bottom do footer ao bottom do card ≤ 24px
    const cardBox = await card.boundingBox();
    const footerBox = await footer.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(footerBox).not.toBeNull();
    if (cardBox && footerBox) {
      const gap = cardBox.y + cardBox.height - (footerBox.y + footerBox.height);
      expect(gap).toBeLessThanOrEqual(24);
    }

    // classe `mt-auto` precisa estar presente para garantir comportamento responsivo
    const className = await footer.getAttribute('class');
    expect(className ?? '').toContain('mt-auto');
  });

  test('layout do footer não quebra em viewport mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndSettle(page, '/novidades');

    const card = page.locator('[data-testid="novelty-grid-card"]').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    const footer = card.locator('[data-testid="novelty-card-footer"]');
    const cardBox = await card.boundingBox();
    const footerBox = await footer.boundingBox();
    if (cardBox && footerBox) {
      // footer continua dentro dos limites horizontais do card
      expect(footerBox.x).toBeGreaterThanOrEqual(cardBox.x - 1);
      expect(footerBox.x + footerBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
      // e ainda colado no rodapé
      const gap = cardBox.y + cardBox.height - (footerBox.y + footerBox.height);
      expect(gap).toBeLessThanOrEqual(24);
    }
  });
});
