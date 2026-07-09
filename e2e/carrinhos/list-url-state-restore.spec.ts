/**
 * E2E: /carrinhos restaura filtros e ordenação da query string após reload.
 *
 * Cenários:
 *  - Deep-link `?deadline=overdue&sort=deadline-asc` reflete nos controles.
 *  - Recarregar (F5) preserva os valores.
 *  - Query textual `?q=teste` restaura o input de busca.
 *  - Valor default (`?sort=recent`, `?deadline=all`) é limpo da URL após
 *    hidratação (contrato do CartsListPage — só grava não-default).
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Carrinhos · restauração de filtros via URL @smoke', () => {
  test('deep-link com deadline=overdue e sort=deadline-asc restaura selects', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos?deadline=overdue&sort=deadline-asc');

    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    const deadlineTrigger = page.getByTestId('carts-list-deadline-filter');
    const sortTrigger = page.getByTestId('carts-list-sort');
    await expect(deadlineTrigger).toBeVisible();
    await expect(sortTrigger).toBeVisible();

    // O Radix Select injeta o texto da opção selecionada dentro do trigger.
    await expect(deadlineTrigger).toContainText(/Vencidos/i);
    await expect(sortTrigger).toContainText(/Prazo: mais próximo/i);

    // O chip "Vencidos" fica marcado como aplicado (aria-pressed=true).
    const overdueChip = page.getByTestId('carts-list-chip-overdue');
    if (await overdueChip.count()) {
      await expect(overdueChip).toHaveAttribute('aria-pressed', 'true');
    }
  });

  test('reload preserva filtros e ordenação', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos?deadline=soon&sort=deadline-desc&q=abc');
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    // Estado antes do reload
    await expect(page.getByTestId('carts-list-deadline-filter')).toContainText(/Próximos 3 dias/i);
    await expect(page.getByTestId('carts-list-sort')).toContainText(/Prazo: mais distante/i);
    await expect(page.getByTestId('carts-list-search')).toHaveValue('abc');

    await page.reload();
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    // Estado depois do reload — mesma URL, mesmos valores
    await expect(page).toHaveURL(/deadline=soon/);
    await expect(page).toHaveURL(/sort=deadline-desc/);
    await expect(page).toHaveURL(/q=abc/);
    await expect(page.getByTestId('carts-list-deadline-filter')).toContainText(/Próximos 3 dias/i);
    await expect(page.getByTestId('carts-list-sort')).toContainText(/Prazo: mais distante/i);
    await expect(page.getByTestId('carts-list-search')).toHaveValue('abc');
  });

  test('valores default não poluem a URL após hidratação', async ({ page }) => {
    await loginAs(page, 'seller');
    // Entrar com defaults explícitos — o componente deve limpar da query string.
    await gotoAndSettle(page, '/carrinhos?deadline=all&sort=recent&q=');
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    await expect
      .poll(() => new URL(page.url()).searchParams.get('deadline'), { timeout: 3_000 })
      .toBeNull();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('sort'), { timeout: 3_000 })
      .toBeNull();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('q'), { timeout: 3_000 })
      .toBeNull();
  });
});
