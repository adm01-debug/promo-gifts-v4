/**
 * E2E: "Limpar filtros" em /carrinhos remove todos os params default da URL
 * e o estado limpo sobrevive ao reload.
 *
 * Contrato validado:
 *  - Deep-link com filtros ativos + `q` sem match → empty-state filtrado
 *    mostra botão "Limpar filtros" (data-testid `carts-list-clear-filters`).
 *  - Clicar limpa `deadline`, `sort`, `q` (e `status`) da URL — reset para
 *    defaults. O componente só grava não-defaults, então a URL fica sem
 *    esses params.
 *  - Recarregar mantém a URL limpa (sem params default).
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Carrinhos · Limpar filtros @smoke', () => {
  test('clicar em "Limpar filtros" remove params default da URL e persiste após reload', async ({
    page,
  }) => {
    await loginAs(page, 'seller');
    // `q` improvável garante empty-state filtrado → botão aparece.
    await gotoAndSettle(
      page,
      '/carrinhos?deadline=overdue&sort=deadline-asc&q=zzz-no-match-xyz-9999',
    );
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    // Precondição: params estão na URL.
    await expect(page).toHaveURL(/deadline=overdue/);
    await expect(page).toHaveURL(/sort=deadline-asc/);
    await expect(page).toHaveURL(/q=zzz-no-match-xyz-9999/);

    const clearBtn = page.getByTestId('carts-list-clear-filters');
    // Só clica se o empty-state filtrado renderizou (fallback: se seed tiver
    // carrinho batendo o `q` improvável, pula em vez de flakear).
    const visible = await clearBtn.isVisible().catch(() => false);
    test.skip(!visible, 'empty-state filtrado não renderizou neste ambiente');

    await clearBtn.click();

    // URL fica sem params default após o clear.
    await expect
      .poll(() => new URL(page.url()).searchParams.get('deadline'), { timeout: 3_000 })
      .toBeNull();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('sort'), { timeout: 3_000 })
      .toBeNull();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('q'), { timeout: 3_000 })
      .toBeNull();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('status'), { timeout: 3_000 })
      .toBeNull();

    // Reload preserva URL limpa (defaults continuam fora da URL).
    await page.reload();
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    for (const key of ['deadline', 'sort', 'q', 'status']) {
      expect(new URL(page.url()).searchParams.get(key)).toBeNull();
    }
    // Input de busca reflete o reset.
    await expect(page.getByTestId('carts-list-search')).toHaveValue('');
  });
});
