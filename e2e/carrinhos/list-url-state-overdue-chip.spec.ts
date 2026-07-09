/**
 * E2E: chip "Vencidos" e seu contador permanecem consistentes com a query
 * string após reload em /carrinhos.
 *
 * Contrato validado:
 *  - Deep-link `?deadline=overdue` marca o chip como `aria-pressed="true"`
 *    imediatamente após hidratação.
 *  - O contador dentro do chip (badge numérico) é invariante ao reload —
 *    reflete o total absoluto de carrinhos vencidos (não depende do filtro).
 *  - Reload preserva o filtro ativo E o mesmo contador visível.
 *  - Um segundo clique no chip remove o filtro e limpa `deadline` da URL.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Carrinhos · chip Vencidos + reload @smoke', () => {
  test('deep-link ?deadline=overdue mantém chip pressionado e contador estável após reload', async ({
    page,
  }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos?deadline=overdue');
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    const chip = page.getByTestId('carts-list-chip-overdue');
    // Se não houver carrinhos vencidos no dataset, o chip não é renderizado —
    // o próprio contrato do componente. Skip curto neste ambiente sem seed.
    const chipVisible = await chip.isVisible().catch(() => false);
    test.skip(!chipVisible, 'sem carrinhos vencidos no ambiente atual');

    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    const badgeBefore = (await chip.textContent())?.match(/\d+/)?.[0] ?? '';
    expect(badgeBefore).not.toBe('');

    await page.reload();
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    await expect(page).toHaveURL(/deadline=overdue/);

    const chipAfter = page.getByTestId('carts-list-chip-overdue');
    await expect(chipAfter).toHaveAttribute('aria-pressed', 'true');
    const badgeAfter = (await chipAfter.textContent())?.match(/\d+/)?.[0] ?? '';
    expect(badgeAfter).toBe(badgeBefore);
  });

  test('segundo clique no chip remove o filtro e limpa deadline da URL', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos?deadline=overdue');
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    const chip = page.getByTestId('carts-list-chip-overdue');
    const chipVisible = await chip.isVisible().catch(() => false);
    test.skip(!chipVisible, 'sem carrinhos vencidos no ambiente atual');

    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await expect
      .poll(() => new URL(page.url()).searchParams.get('deadline'), { timeout: 3_000 })
      .toBeNull();
  });
});
