/**
 * E2E: SellerCartsPage limpa chaves órfãs do antigo popover
 * "Colunas / Densidade" (removido em 2026-07) no localStorage ao carregar,
 * e o próprio trigger do popover não aparece mais na toolbar.
 *
 * Contrato: `purgeOrphanCartPrefs` roda dentro do useEffect de load em
 * `SellerCartsPage.tsx` assim que o uid do usuário fica disponível.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

test.describe('@carrinhos · purge de chaves órfãs (columns/density) @smoke', () => {
  test.beforeEach(async ({ context, page }) => {
    // Isolamento entre casos: nunca herdar cookies/localStorage de outros
    // specs. Limpar ANTES do login para não invalidar a sessão criada aqui.
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
    });
  });

  test('remove cart-table-columns* e cart-table-density* ao carregar /carrinhos', async ({
    page,
  }) => {
    await loginAs(page, 'user');

    // Pré-popula ANTES da navegação que dispara o purge.
    await gotoAndSettle(page, '/');
    await page.evaluate(() => {
      localStorage.setItem('cart-table-columns:legacy-uid', '["name","price"]');
      localStorage.setItem('cart-table-density:legacy-uid', 'compact');
      localStorage.setItem('cart-table-columns', 'legado-sem-namespace');
      localStorage.setItem('cart-table-density', 'legado-sem-namespace');
      // Sentinelas que DEVEM sobreviver ao purge.
      localStorage.setItem('cart-view-mode:legacy-uid', 'table');
      localStorage.setItem('cart-table-sort-key:legacy-uid', 'price');
    });

    await gotoAndSettle(page, '/carrinhos');
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    // O useEffect de load é assíncrono (depende do uid) — poll até 5s.
    await expect
      .poll(
        () =>
          page.evaluate(() => ({
            ns_cols: localStorage.getItem('cart-table-columns:legacy-uid'),
            ns_dens: localStorage.getItem('cart-table-density:legacy-uid'),
            legacy_cols: localStorage.getItem('cart-table-columns'),
            legacy_dens: localStorage.getItem('cart-table-density'),
          })),
        { timeout: 5_000 },
      )
      .toEqual({ ns_cols: null, ns_dens: null, legacy_cols: null, legacy_dens: null });

    // Chaves NÃO órfãs continuam presentes.
    const survivors = await page.evaluate(() => ({
      view: localStorage.getItem('cart-view-mode:legacy-uid'),
      sort: localStorage.getItem('cart-table-sort-key:legacy-uid'),
    }));
    expect(survivors.view).toBe('table');
    expect(survivors.sort).toBe('price');
  });

  test('trigger do popover Colunas/Densidade não aparece mais na toolbar', async ({
    page,
  }) => {
    await loginAs(page, 'user');
    await gotoAndSettle(page, '/carrinhos');
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    // Testid canônico do trigger removido (visto no commit 5ed2e1f79).
    await expect(page.getByTestId('cart-table-prefs-trigger')).toHaveCount(0);

    // Guarda extra: nenhum botão com o rótulo antigo permanece renderizado.
    await expect(
      page.getByRole('button', { name: /Colunas.*Densidade|Densidade.*Colunas/i }),
    ).toHaveCount(0);
  });
});
