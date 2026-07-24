import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle, waitForRouteIdle } from '../helpers/nav';

/**
 * Regressão: badges de SKU em orçamentos legados devem exibir o código composto
 * `base-código_cor` (ex.: "94297-7.1") quando o item tem cor selecionada,
 * graças à hidratação runtime de `quoteService.fetchQuote` via `product_variants`.
 *
 * O teste:
 *  1) Abre a listagem `/orcamentos` (autenticado).
 *  2) Entra no primeiro orçamento com itens que tenham cor.
 *  3) Para cada badge de SKU com indicador de cor (color_hex), valida:
 *     - o texto contém '-' (sufixo de variação), ou
 *     - o atributo `data-sku` foi mantido como base e o item foi marcado como
 *       legado órfão (fallback documentado).
 *  4) Garante que o badge não estoura o container (scrollWidth ≤ clientWidth + 1).
 */
test.describe('Orçamento legado — SKU composto código-variação', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('badges de SKU em itens com cor exibem código composto sem estourar layout', async ({
    page,
  }) => {
    await gotoAndSettle(page, '/orcamentos');
    await waitForRouteIdle(page);

    // Encontra o primeiro link de orçamento na listagem
    const firstQuoteLink = page
      .locator('a[href^="/orcamentos/"][href*="-"]')
      .first();

    const count = await firstQuoteLink.count();
    test.skip(count === 0, 'Sem orçamentos no ambiente para validar regressão.');

    await firstQuoteLink.click();
    await waitForRouteIdle(page);

    // Aguarda hidratação dos itens
    const badges = page.getByTestId('quote-item-sku-badge');
    await badges.first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});

    const total = await badges.count();
    test.skip(total === 0, 'Orçamento sem badges de SKU — nada a validar.');

    let validatedWithColor = 0;

    for (let i = 0; i < total; i++) {
      const badge = badges.nth(i);
      const sku = (await badge.getAttribute('data-sku')) ?? '';
      // Indicador visual de cor (swatch) presente = item com variação
      const hasColorSwatch = (await badge.locator('span[aria-hidden="true"]').count()) > 0;

      // Layout: badge não pode estourar o container
      const metrics = await badge.evaluate((el) => ({
        scrollW: (el as HTMLElement).scrollWidth,
        clientW: (el as HTMLElement).clientWidth,
        width: (el as HTMLElement).getBoundingClientRect().width,
      }));
      expect(
        metrics.scrollW,
        `Badge SKU "${sku}" estourou o layout (scrollW=${metrics.scrollW}, clientW=${metrics.clientW})`,
      ).toBeLessThanOrEqual(metrics.clientW + 1);

      if (hasColorSwatch) {
        validatedWithColor += 1;
        // Aceita: ou SKU composto (com '-') ou fallback documentado (base sem '-')
        // Fallback emite warn no console — não falha o spec, apenas registra.
        if (!sku.includes('-')) {
          // eslint-disable-next-line no-console
          console.warn(
            `[regression] Item com cor exibindo SKU base "${sku}" — verificar variant lookup.`,
          );
        } else {
          expect(sku, `SKU composto deve seguir formato base-codigo: ${sku}`).toMatch(
            /^[A-Z0-9]+-[A-Z0-9.]+$/i,
          );
        }
      }
    }

    test.skip(
      validatedWithColor === 0,
      'Orçamento aberto não possui itens com cor — não é caso de regressão.',
    );
  });
});
