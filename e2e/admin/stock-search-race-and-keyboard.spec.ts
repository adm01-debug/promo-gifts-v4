/**
 * E2E — Cancelamento de busca em andamento via Reset rápido + teclado.
 *
 * Cobre:
 *  1. Race Busca→Reset: aria-busy precisa voltar a "false" imediatamente.
 *  2. Fluxo completo de teclado (Tab + Enter) após alternar filtros e Reset.
 *  3. Enter com foco direto no botão "Busca" dispara a busca.
 *  4. Reset disparado ANTES da conclusão cancela/ignora o spinner.
 *
 * Estratégia anti-flake:
 *  - Polling explícito via `expect.poll` em vez de timeouts fixos.
 *  - waitFor curto após `fill()` para garantir que React processou o input.
 *  - Sempre aguardar `aria-busy` voltar a "false" antes da próxima ação.
 */
import { test, expect, type Page, type Locator } from '../fixtures/test-base';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

async function setup(page: Page) {
  await loginAs(page);
  await gotoAndSettle(page, '/estoque');
  const syncing = page.getByText(/Sincronizando estoque/i);
  if (await syncing.isVisible().catch(() => false)) {
    await expect(syncing).not.toBeVisible({ timeout: 60_000 });
  }
  // Garante que o toolbar terminou de hidratar antes de qualquer ação.
  await expect(page.getByTestId('stock-search-button')).toBeVisible();
}

async function expectAriaBusy(btn: Locator, value: 'true' | 'false') {
  await expect
    .poll(async () => btn.getAttribute('aria-busy'), {
      timeout: 2_000,
      message: `aria-busy deveria virar "${value}"`,
    })
    .toBe(value);
}

async function tabUntilFocused(page: Page, target: Locator, maxHops = 8) {
  for (let i = 0; i < maxHops; i += 1) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

for (const vp of VIEWPORTS) {
  test.describe(`Stock — race Busca→Reset & teclado (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('Reset rápido cancela isSearching sem travar o botão', async ({ page }) => {
      await setup(page);
      const input = page.getByPlaceholder(/Buscar no Estoque/i);
      const btn = page.getByTestId('stock-search-button');

      await expectAriaBusy(btn, 'false');
      await input.fill('zzz_corrida_promo');
      await expect(btn).toBeEnabled();

      await btn.click();

      // Reset IMEDIATO via X que limpa a busca (o que estiver visível primeiro).
      const resetX = page
        .getByRole('button', { name: /Limpar busca|Limpar filtros|Reset/i })
        .first();
      await expect(resetX).toBeVisible();
      await resetX.click();

      // Polling: aria-busy precisa voltar rapidamente, sem depender de fallback.
      await expectAriaBusy(btn, 'false');
      await expect(btn).not.toContainText(/Buscando/i);
    });

    test('Enter com foco no botão Busca dispara a busca', async ({ page }) => {
      await setup(page);
      const input = page.getByPlaceholder(/Buscar no Estoque/i);
      const btn = page.getByTestId('stock-search-button');

      await input.fill('xxx_enter_no_botao_promo');
      await tabUntilFocused(page, btn);
      await page.keyboard.press('Enter');

      // Aceita qualquer estado terminal (busy ou idle) — mas a UI precisa
      // refletir o resultado da busca.
      await expect(page.getByText(/Nenhum produto encontrado/i)).toBeVisible({
        timeout: 15_000,
      });
      await expectAriaBusy(btn, 'false');
    });

    test('Reset antes da conclusão é ignorado (botão volta a idle)', async ({ page }) => {
      await setup(page);
      const input = page.getByPlaceholder(/Buscar no Estoque/i);
      const btn = page.getByTestId('stock-search-button');

      await input.fill('yyy_cancela_antes_da_conclusao');
      await btn.click();

      // Race window: clica em Reset enquanto aria-busy=true (best-effort —
      // se já estabilizou, o teste ainda valida o estado terminal correto).
      const resetX = page
        .getByRole('button', { name: /Limpar busca|Limpar filtros|Reset/i })
        .first();
      await resetX.click();

      // Estado terminal: input vazio, aria-busy=false, sem spinner.
      await expect(input).toHaveValue('');
      await expectAriaBusy(btn, 'false');
      await expect(btn).toBeDisabled();
    });

    test('teclado: Tab→Enter aplica busca; Reset; nova busca via Enter no input', async ({
      page,
    }) => {
      await setup(page);
      const input = page.getByPlaceholder(/Buscar no Estoque/i);
      const btn = page.getByTestId('stock-search-button');

      // 1) Digita, Tab até o botão, Enter aplica.
      await input.focus();
      await input.fill('aaa_inexistente_teclado');
      await tabUntilFocused(page, btn);
      await page.keyboard.press('Enter');
      await expect(page.getByText(/Nenhum produto encontrado/i)).toBeVisible({ timeout: 15_000 });
      await expectAriaBusy(btn, 'false');

      // 2) Reset via teclado.
      const resetX = page
        .getByRole('button', { name: /Limpar busca|Limpar filtros|Reset/i })
        .first();
      await resetX.focus();
      await page.keyboard.press('Enter');

      await expect(input).toHaveValue('');
      await expect(btn).toBeDisabled();
      await expectAriaBusy(btn, 'false');

      // 3) Nova busca via Enter no input após Reset.
      await input.focus();
      await input.fill('bbb_inexistente_pos_reset');
      await input.press('Enter');
      await expect(page.getByText(/Nenhum produto encontrado/i)).toBeVisible({ timeout: 15_000 });
      await expectAriaBusy(btn, 'false');
    });
  });
}
