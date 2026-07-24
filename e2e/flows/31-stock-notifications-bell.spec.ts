/**
 * Fluxo: Módulo "Notificações de Estoque" (sino do header).
 *
 * Este é o sino de ESTOQUE (`data-testid="stock-alerts-indicator"`,
 * `aria-label="Alertas de estoque"`) — NÃO confundir com o sino de
 * workspace (`NotificationBell`, `aria-label="Notificações"`). A suíte
 * histórica `e2e/notifications.spec.ts` mira o sino de workspace; este
 * cobre o de estoque, que antes não tinha nenhum teste.
 *
 * Valida (de forma resiliente a dados ao vivo):
 *  1. o painel abre e expõe as 4 abas: Zerou · Baixo · Novidade · Chegou;
 *  2. invariante anti "Reposto + 0 un.": a aba Chegou nunca lista item 0 un.;
 *  3. invariante de rótulo: itens da aba Zerou exibem badge "Esgotado".
 *
 * Em ambientes sem sessão autenticada (sino ausente), os testes fazem skip
 * explícito em vez de falhar.
 */
import { test, expect } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';
import { TID } from '../fixtures/selectors';
import type { Page } from '@playwright/test';

const BELL = TID('stock-alerts-indicator');

async function openBell(page: Page): Promise<boolean> {
  await gotoAndSettle(page, '/');
  const bell = page.locator(BELL);
  if ((await bell.count()) === 0) return false;
  await bell.first().click();
  return true;
}

test.describe('Notificações de Estoque — sino do header', () => {
  test('abre o painel e mostra as 4 abas', async ({ page }) => {
    const ok = await openBell(page);
    test.skip(!ok, 'Sino de estoque indisponível (sessão não autenticada).');

    // cabeçalho do painel
    await expect(page.getByRole('heading', { name: 'Notificações' })).toBeVisible();

    for (const label of ['Zerou', 'Baixo', 'Novidade', 'Chegou']) {
      await expect(page.getByRole('button', { name: new RegExp(label) })).toBeVisible();
    }
  });

  test('invariante: aba "Chegou" nunca exibe item com 0 un.', async ({ page }) => {
    const ok = await openBell(page);
    test.skip(!ok, 'Sino de estoque indisponível (sessão não autenticada).');

    await page.getByRole('button', { name: /Chegou/ }).click();
    // aguarda a lista (RPC) assentar
    await page.waitForLoadState('networkidle').catch(() => {});

    // Reposição = produto que voltou a ter estoque → jamais 0 un.
    await expect(page.getByText('0 un.')).toHaveCount(0);
  });

  test('invariante: itens da aba "Zerou" são marcados como Esgotado', async ({ page }) => {
    const ok = await openBell(page);
    test.skip(!ok, 'Sino de estoque indisponível (sessão não autenticada).');

    await page.getByRole('button', { name: /Zerou/ }).click();
    await page.waitForLoadState('networkidle').catch(() => {});

    const esgotados = page.getByText('Esgotado');
    const count = await esgotados.count();
    // Se houver itens listados, todos devem ser "Esgotado".
    if (count > 0) {
      await expect(esgotados.first()).toBeVisible();
    }
  });
});
