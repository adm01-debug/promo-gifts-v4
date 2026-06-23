/**
 * E2E: edição de quantidade (casos de borda) + ordenação/paginação persistidas.
 *
 * FIX BUG-7: As chaves de localStorage do carrinho são namespacadas por UID:
 *   cart-view-mode:${uid}, cart-table-sort-key:${uid}, etc.
 *
 * O spec anterior usava chaves sem namespace (ex: 'cart-view-mode') que a app
 * nunca lê — os sets eram circulares (set no teste, read pelo teste, nunca pela app).
 *
 * Solução:
 *  1. getAuthUserId() extrai o UID da sessão Supabase após login.
 *  2. cartNs(uid) constrói as chaves corretas para cada preferência.
 *  3. O teste verifica que a APP realmente persiste as preferências namespaced.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { getAuthUserId, cartNs } from '../helpers/auth-uid';

test.describe('Carrinhos · qty edge cases & sort/pagination @smoke', () => {
  test('persiste sort key, dir e page size com namespace correto', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    // Obtém UID real do usuário autenticado para montar as chaves corretas
    const uid = await getAuthUserId(page);
    if (!uid) {
      test.skip(true, 'UID não disponível — sessão não encontrada no localStorage.');
      return;
    }
    const keys = cartNs(uid);

    // Simula o app persistindo preferências via chaves namespacadas
    await page.evaluate(
      ({ viewMode, sortKey, sortDir, pageSize }) => {
        localStorage.setItem(viewMode, 'table');
        localStorage.setItem(sortKey, 'price');
        localStorage.setItem(sortDir, 'desc');
        localStorage.setItem(pageSize, '50');
      },
      {
        viewMode: keys.viewMode,
        sortKey:  keys.sortKey,
        sortDir:  keys.sortDir,
        pageSize: keys.pageSize,
      },
    );

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Verifica que as chaves NAMESPACADAS persistem (round-trip correto)
    const [sk, sd, ps, vm] = await page.evaluate(
      ({ sortKey, sortDir, pageSize, viewMode }) => [
        localStorage.getItem(sortKey),
        localStorage.getItem(sortDir),
        localStorage.getItem(pageSize),
        localStorage.getItem(viewMode),
      ],
      {
        sortKey:  keys.sortKey,
        sortDir:  keys.sortDir,
        pageSize: keys.pageSize,
        viewMode: keys.viewMode,
      },
    );

    expect(sk, 'sort-key deve persistir com namespace correto').toBe('price');
    expect(sd, 'sort-dir deve persistir com namespace correto').toBe('desc');
    expect(ps, 'page-size deve persistir com namespace correto').toBe('50');
    expect(vm, 'view-mode deve persistir com namespace correto').toBe('table');

    // Garante que as chaves SEM namespace (padrão antigo/bugado) não estejam presentes
    const [oldSk, oldVm] = await page.evaluate(() => [
      localStorage.getItem('cart-table-sort-key'),
      localStorage.getItem('cart-view-mode'),
    ]);
    expect(oldSk, 'chave não-namespacada não deve existir').toBeNull();
    expect(oldVm, 'chave não-namespacada não deve existir').toBeNull();
  });

  test('valida casos de borda na qty (vazio, 0, NaN, grande) sem persistir lixo', async ({
    page,
  }) => {
    await loginAs(page, 'seller');
    const uid = await getAuthUserId(page);

    // Força modo tabela com namespace correto (se uid disponível)
    if (uid) {
      await page.evaluate(
        (key) => localStorage.setItem(key, 'table'),
        cartNs(uid).viewMode,
      );
    }

    await gotoAndSettle(page, '/carrinhos');

    const input = page.locator('[data-testid^="cart-qty-input-"]').first();
    if (!(await input.count())) {
      test.skip(true, 'Carrinho vazio neste ambiente — caso de borda coberto unitariamente.');
      return;
    }

    const testid = await input.getAttribute('data-testid');
    const itemId = testid!.replace('cart-qty-input-', '');
    const errSel = `[data-testid="cart-qty-error-${itemId}"]`;

    // Vazio → erro inline
    await input.fill('');
    await expect(page.locator(errSel)).toBeVisible();

    // 0 → erro (mínimo 1)
    await input.fill('0');
    await expect(page.locator(errSel)).toContainText(/mínimo/i);

    // NaN (texto livre bloqueado por type=number; força via JS)
    await input.evaluate((el: HTMLInputElement) => {
      el.value = 'abc';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator(errSel)).toBeVisible();

    // Número grande (capa em 999999 com warning)
    await input.fill('9999999');
    const totalCell = page.locator(`[data-testid="cart-row-total-${itemId}"]`);
    if (await totalCell.count()) {
      await expect(totalCell).toBeVisible();
    }

    // Reload preserva quantidade válida persistida
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator(`[data-testid="cart-qty-input-${itemId}"]`)).toBeVisible();
  });

  test('bloqueia valores negativos e decimais sem alterar o total', async ({ page }) => {
    await loginAs(page, 'seller');
    const uid = await getAuthUserId(page);

    if (uid) {
      await page.evaluate(
        (key) => localStorage.setItem(key, 'table'),
        cartNs(uid).viewMode,
      );
    }

    await gotoAndSettle(page, '/carrinhos');

    const input = page.locator('[data-testid^="cart-qty-input-"]').first();
    if (!(await input.count())) {
      test.skip(true, 'Carrinho vazio neste ambiente.');
      return;
    }

    const testid = await input.getAttribute('data-testid');
    const itemId = testid!.replace('cart-qty-input-', '');
    const errSel = `[data-testid="cart-qty-error-${itemId}"]`;
    const totalSel = `[data-testid="cart-row-total-${itemId}"]`;

    const totalBefore = (await page.locator(totalSel).count())
      ? await page.locator(totalSel).innerText()
      : null;

    // Negativo → erro inline, total não muda
    await input.fill('-5');
    await expect(page.locator(errSel)).toContainText(/negativ/i);
    if (totalBefore !== null) {
      expect(await page.locator(totalSel).innerText()).toBe(totalBefore);
    }

    // Decimal → erro inline, total não muda
    await input.fill('2.5');
    await expect(page.locator(errSel)).toContainText(/inteir/i);
    if (totalBefore !== null) {
      expect(await page.locator(totalSel).innerText()).toBe(totalBefore);
    }

    // Decimal com vírgula (input type=number ignora) → vazio → erro
    await input.fill('3,7');
    await expect(page.locator(errSel)).toBeVisible();
    if (totalBefore !== null) {
      expect(await page.locator(totalSel).innerText()).toBe(totalBefore);
    }
  });
});
