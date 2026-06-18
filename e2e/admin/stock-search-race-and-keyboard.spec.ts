/**
 * E2E — Cancelamento de busca em andamento via Reset rápido.
 *
 * Cobre o race condition Busca → Reset: ao clicar em "Busca" e
 * imediatamente em "Reset" (X global), o botão NÃO pode ficar travado
 * em aria-busy="true" / "Buscando…".
 *
 * Também valida cobertura completa de teclado (Tab + Enter) após
 * alternar filtros e usar Reset, em desktop e mobile.
 */
import { test, expect, type Page } from '../fixtures/test-base';
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
}

for (const vp of VIEWPORTS) {
  test.describe(`Stock — race Busca→Reset & teclado (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('Reset rápido cancela isSearching sem travar o botão', async ({ page }) => {
      await setup(page);
      const input = page.getByPlaceholder(/Buscar no Estoque/i);
      const btn = page.getByTestId('stock-search-button');

      await input.fill('zzz_corrida_promo');
      await btn.click();

      // Imediatamente clica no X global de reset (aparece quando há
      // filtros ativos) OU no X que limpa o input — o que aparecer
      // primeiro. Ambos devem encerrar isSearching.
      const resetX = page
        .getByRole('button', { name: /Limpar busca|Limpar filtros|Reset/i })
        .first();
      await resetX.click();

      // aria-busy precisa voltar a "false" rapidamente (sem esperar 600ms).
      await expect(btn).toHaveAttribute('aria-busy', 'false', { timeout: 1500 });
      await expect(btn).not.toContainText(/Buscando/i);
    });

    test('teclado: Tab navega input→Busca, Enter aplica após alternar filtros', async ({
      page,
    }) => {
      await setup(page);
      const input = page.getByPlaceholder(/Buscar no Estoque/i);
      const btn = page.getByTestId('stock-search-button');

      // 1) Digita, Tab para o botão Busca, Enter aplica.
      await input.focus();
      await input.fill('aaa_inexistente_teclado');
      // input → (possível X de limpar) → botão Busca. Tab até alcançar o botão.
      for (let i = 0; i < 5; i += 1) {
        await page.keyboard.press('Tab');
        if (await btn.evaluate((el) => el === document.activeElement).catch(() => false)) break;
      }
      await expect(btn).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByText(/Nenhum produto encontrado/i)).toBeVisible({ timeout: 15_000 });

      // 2) Reset via teclado: foca o X global e Enter.
      const resetX = page
        .getByRole('button', { name: /Limpar busca|Limpar filtros|Reset/i })
        .first();
      await resetX.focus();
      await page.keyboard.press('Enter');

      // 3) Após Reset, input volta vazio e botão fica desabilitado.
      await expect(input).toHaveValue('');
      await expect(btn).toBeDisabled();
      await expect(btn).toHaveAttribute('aria-busy', 'false');

      // 4) Nova busca via teclado funciona normalmente após Reset.
      await input.focus();
      await input.fill('bbb_inexistente_pos_reset');
      await input.press('Enter');
      await expect(page.getByText(/Nenhum produto encontrado/i)).toBeVisible({ timeout: 15_000 });
    });
  });
}
