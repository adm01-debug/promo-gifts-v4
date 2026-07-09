/**
 * E2E: em viewport pequeno, o wrapper `overflow-x-auto` da tabela de itens
 * do carrinho ativo habilita scroll horizontal (scrollWidth > clientWidth)
 * SEM estourar o layout do container pai.
 *
 * Contrato:
 *  - Wrapper `[data-testid="cart-table"]` tem `overflow-x-auto`.
 *  - Tabela interna tem `min-w-[720px]` — força scroll em telas < 720px.
 *  - Container pai é `min-w-0` para o overflow funcionar dentro do grid.
 *
 * Skip gracioso: se o carrinho ativo não tem itens no ambiente de CI,
 * o wrapper `cart-table` não é renderizado — o teste é marcado como
 * skipped em vez de falso-negativo.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

test.describe('@carrinhos · responsividade da tabela em mobile @smoke', () => {
  test.beforeEach(async ({ context, page }) => {
    // Isolamento entre casos: nunca herdar cookies/localStorage de outros specs.
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
    });
  });

  test('overflow-x-auto habilita scroll horizontal sem estourar container', async ({
    page,
  }) => {
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
    await loginAs(page, 'user');
    await gotoAndSettle(page, '/carrinhos');
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    // Garante modo "table" (o purge não interfere nesta chave).
    await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter((k) =>
        k.startsWith('cart-view-mode:'),
      );
      keys.forEach((k) => localStorage.setItem(k, 'table'));
    });
    await page.reload();
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    const wrapper = page.getByTestId('cart-table');
    const hasTable = await wrapper.count();
    test.skip(
      hasTable === 0,
      'Carrinho ativo sem itens neste ambiente — nada a validar.',
    );

    await expect(wrapper).toBeVisible();

    // 1. Wrapper aplica overflow-x-auto (via classe Tailwind).
    const overflowX = await wrapper.evaluate((el) => getComputedStyle(el).overflowX);
    expect(overflowX).toBe('auto');

    // 2. Scroll horizontal está ativo: scrollWidth > clientWidth.
    const dims = await wrapper.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(dims.scrollWidth).toBeGreaterThan(dims.clientWidth);

    // 3. Container pai NÃO estoura o viewport (min-w-0 protege o grid).
    const viewport = page.viewportSize()!;
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    // Tolerância de 1px para arredondamentos de subpixel.
    expect(bodyScrollWidth).toBeLessThanOrEqual(viewport.width + 1);
  });
});
