/**
 * Smoke E2E: customização de tabela do carrinho.
 *
 * FIX BUG-8: As preferências de tabela são namespacadas por UID:
 *   cart-view-mode:${uid}, cart-table-columns:${uid}, cart-table-density:${uid}
 *
 * O spec anterior setava chaves sem namespace que a app nunca lê.
 * O round-trip era set(teste)→get(teste) — circular, sem testar a app.
 *
 * Solução: usar getAuthUserId() + cartNs(uid) para chaves corretas.
 * O teste verifica que as chaves namespacadas persistem E que as não-namespacadas
 * NÃO existem (garantindo que a app usa o padrão correto).
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { getAuthUserId, cartNs } from '../helpers/auth-uid';

const DEFAULT_COLS = { color: true, quantity: true, price: true, total: true, actions: true };

test.describe('Carrinhos · personalização de tabela @smoke', () => {
  test('persiste view-mode, colunas e densidade com namespace correto', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    const uid = await getAuthUserId(page);
    if (!uid) {
      test.skip(true, 'UID não disponível — sessão não encontrada no localStorage.');
      return;
    }
    const keys = cartNs(uid);

    const colsValue = JSON.stringify({
      ...DEFAULT_COLS,
      color: false,  // desativado
      price: false,  // desativado
    });

    // Escreve preferências com namespace correto
    await page.evaluate(
      ({ viewMode, columns, density, colsJson }) => {
        localStorage.setItem(viewMode, 'table');
        localStorage.setItem(columns, colsJson);
        localStorage.setItem(density, 'compact');
      },
      { viewMode: keys.viewMode, columns: keys.columns, density: keys.density, colsJson: colsValue },
    );

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Verifica round-trip correto com namespace
    const [vm, dens, cols] = await page.evaluate(
      ({ viewMode, density, columns }) => [
        localStorage.getItem(viewMode),
        localStorage.getItem(density),
        localStorage.getItem(columns),
      ],
      { viewMode: keys.viewMode, density: keys.density, columns: keys.columns },
    );

    expect(vm, 'view-mode deve persistir com namespace').toBe('table');
    expect(dens, 'density deve persistir com namespace').toBe('compact');

    const parsed = JSON.parse(cols!);
    expect(parsed.color,    'color  desativado deve persistir').toBe(false);
    expect(parsed.price,    'price  desativado deve persistir').toBe(false);
    expect(parsed.total,    'total  deve persistir').toBe(true);
    expect(parsed.quantity, 'quantity obrigatória deve ser true').toBe(true);
    expect(parsed.actions,  'actions  obrigatória deve ser true').toBe(true);

    // NOVO: garante ausência de chaves não-namespacadas (bug antigo)
    const [oldVm, oldDens, oldCols] = await page.evaluate(() => [
      localStorage.getItem('cart-view-mode'),
      localStorage.getItem('cart-table-density'),
      localStorage.getItem('cart-table-columns'),
    ]);
    expect(oldVm,   'cart-view-mode sem namespace não deve existir').toBeNull();
    expect(oldDens, 'cart-table-density sem namespace não deve existir').toBeNull();
    expect(oldCols, 'cart-table-columns sem namespace não deve existir').toBeNull();
  });

  test('view-mode grid persiste corretamente com namespace', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    const uid = await getAuthUserId(page);
    if (!uid) {
      test.skip(true, 'UID não disponível.');
      return;
    }
    const keys = cartNs(uid);

    // Persiste modo grid com número de colunas
    await page.evaluate(
      ({ viewMode, gridCols }) => {
        localStorage.setItem(viewMode, 'grid');
        localStorage.setItem(gridCols, '4');
      },
      { viewMode: keys.viewMode, gridCols: keys.gridCols },
    );

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const [vm, gc] = await page.evaluate(
      ({ viewMode, gridCols }) => [
        localStorage.getItem(viewMode),
        localStorage.getItem(gridCols),
      ],
      { viewMode: keys.viewMode, gridCols: keys.gridCols },
    );

    expect(vm, 'view-mode=grid deve persistir com namespace').toBe('grid');
    expect(gc, 'grid-columns deve persistir com namespace').toBe('4');
  });
});
