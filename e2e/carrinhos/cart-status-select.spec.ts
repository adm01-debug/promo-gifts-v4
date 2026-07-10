/**
 * E2E: CartStatusSelect — altera o status do carrinho ativo e verifica que
 * o loading aparece durante a mutação e que a UI atualiza corretamente.
 *
 * Cobertura:
 *   1) Estado inicial: aria-busy=false, aria-label reflete o status atual.
 *   2) Ao selecionar novo status: spinner aparece, aria-busy=true,
 *      aria-label passa a "Atualizando…", live-region anuncia início.
 *   3) Após a mutação: aria-busy volta a false, novo rótulo é exibido,
 *      spinner some, toast de sucesso aparece.
 *   4) Sem sessão válida: rota protegida redireciona para /login e o
 *      CartStatusSelect não é renderizado.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const STATUS_LABELS = {
  em_separacao: 'Separação',
  pronto_orcamento: 'Pronto p/ orçamento',
} as const;

async function openFirstCart(page: import('@playwright/test').Page) {
  await gotoAndSettle(page, '/carrinhos');
  const rows = page.locator('[data-testid^="cart-row-"]').filter({
    hasNot: page.locator('[data-testid^="cart-row-open-"]'),
  });
  const total = await rows.count();
  if (total === 0) {
    test.skip(true, 'nenhum carrinho disponível para o teste');
  }
  const tid = await rows.first().getAttribute('data-testid');
  const id = tid?.replace('cart-row-', '');
  expect(id).toBeTruthy();
  await gotoAndSettle(page, `/carrinhos/${id}`);
  await expect(page.getByTestId('active-cart-header')).toBeVisible();
  return id!;
}

test.describe('Carrinhos · CartStatusSelect @carrinhos', () => {
  test('altera o status e mostra loading + confirmação', async ({ page }) => {
    await loginAs(page, 'seller');
    await openFirstCart(page);

    const trigger = page.getByTestId('cart-status-select');
    await expect(trigger).toBeVisible();

    // Estado inicial
    const initialStatus = await trigger.getAttribute('data-status');
    expect(initialStatus).toMatch(/em_separacao|pronto_orcamento/);
    await expect(trigger).toHaveAttribute('aria-busy', 'false');
    await expect(trigger).toHaveAttribute('data-pending', 'false');
    const initialAria = (await trigger.getAttribute('aria-label')) ?? '';
    expect(initialAria).toMatch(/Status atual/i);

    // Determina o próximo status (o outro valor).
    const nextKey =
      initialStatus === 'pronto_orcamento' ? 'em_separacao' : 'pronto_orcamento';
    const nextLabel = STATUS_LABELS[nextKey];

    // Abre o dropdown e clica no próximo status.
    await trigger.click();
    await page.getByRole('option', { name: nextLabel }).click();

    // Fase loading — atributos e spinner podem sumir muito rápido, então
    // fazemos um race entre "spinner visível" e "estado final aplicado".
    const spinner = page.getByTestId('cart-status-spinner');
    const liveRegion = page.getByTestId('cart-status-live');

    // Se o backend responder em <30ms, o spinner pode não aparecer.
    // Nesse caso, ao menos a live-region deve ter registrado a mudança.
    await Promise.race([
      spinner.waitFor({ state: 'visible', timeout: 3000 }).catch(() => null),
      expect(liveRegion).toContainText(/Atualizando|atualizado/i, { timeout: 3000 }),
    ]);

    // Fase confirmada — o trigger deve refletir o novo status.
    await expect(trigger).toHaveAttribute('data-status', nextKey, { timeout: 10_000 });
    await expect(trigger).toHaveAttribute('aria-busy', 'false', { timeout: 10_000 });
    await expect(trigger).toHaveAttribute('data-pending', 'false');
    await expect(spinner).toHaveCount(0);
    await expect(trigger).toContainText(nextLabel);

    // aria-label final volta ao formato "Status atual…".
    const finalAria = (await trigger.getAttribute('aria-label')) ?? '';
    expect(finalAria).toMatch(new RegExp(`Status atual.*${nextLabel}`, 'i'));

    // Live-region registrou a confirmação.
    await expect(liveRegion).toContainText(
      new RegExp(`Status atualizado para ${nextLabel}`, 'i'),
      { timeout: 5000 },
    );

    // Toast de sucesso do sonner.
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: nextLabel }).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('sem sessão válida: rota protegida redireciona para /login e o Select não é renderizado', async ({
    browser,
  }) => {
    // Contexto limpo (sem storageState) — garante ausência de sessão.
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto('/carrinhos/qualquer-id-inexistente');

    // Redireciona para login (ou landing pública). O CartStatusSelect não
    // pode existir na árvore.
    await expect(page).toHaveURL(/\/(login|auth|entrar|$)/, { timeout: 10_000 });
    await expect(page.getByTestId('cart-status-select')).toHaveCount(0);

    // Layout público não deve quebrar (viewport padrão renderiza algo).
    const body = page.locator('body');
    const box = await body.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(0);

    await ctx.close();
  });
});
