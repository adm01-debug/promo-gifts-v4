/**
 * E2E · Popover "Meus Carrinhos" — input de tiragem NÃO seleciona o valor ao focar.
 *
 * Regressão para a mudança em `SortableCartItem.tsx`: o `onFocus` posiciona o
 * cursor no fim via `requestAnimationFrame` + `setSelectionRange(end, end)`,
 * eliminando o antigo `e.target.select()`.
 *
 * Como `<input type="number">` não expõe `selectionStart`/`selectionEnd` de
 * forma confiável (Chromium lança / retorna null), validamos o comportamento
 * de forma **funcional**: se o valor estivesse selecionado, digitar um dígito
 * o REPLACERIA; sem seleção, o dígito é APPENDADO ao valor existente.
 *
 * Cenários:
 *  1. Foco via clique → digitar "9" no valor "3" resulta em "39".
 *  2. Foco via Tab    → digitar "9" no valor "3" resulta em "39".
 */
import { test, expect, type Page } from '@playwright/test';
import { setupAuthedWithCarts } from '../helpers/cart-setup';
import { gotoAndSettle } from '../helpers/nav';
import type { MockCart } from '../helpers/cart-mock';

function transformCart(cart: MockCart): MockCart {
  cart.company_id = 'co-focus-noselect';
  cart.company_name = 'Empresa Focus NoSelect';
  cart.seller_cart_items[0].id = 'item-focus-1';
  cart.seller_cart_items[0].quantity = 3;
  return cart;
}

/**
 * Silencia PATCHes de quantidade — o blur após digitar dispara commit; queremos
 * evitar timeouts de rede sem afetar o valor exibido pelo update otimista.
 */
async function stubQtyPatch(page: Page): Promise<void> {
  await page.route('**/rest/v1/seller_cart_items**', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    await route.fulfill({ status: 204, body: '', headers: { 'Content-Range': '*/*' } });
  });
}

async function openPopoverWithItem(page: Page) {
  await setupAuthedWithCarts(page, {
    role: 'seller',
    count: 1,
    itemsPerCart: 1,
    gotoUrl: null,
    transform: (c) => transformCart(c),
  });
  await stubQtyPatch(page);
  await gotoAndSettle(page, '/');
  await page.getByTestId('cart-trigger').click();
  await expect(page.getByTestId('cart-drawer')).toBeVisible();
  const qty = page.getByTestId('cart-qty-input').first();
  await expect(qty).toBeVisible();
  await expect(qty).toHaveValue('3');
  return qty;
}

test.describe('Carrinhos · popover — foco no input de tiragem não seleciona o valor', () => {
  test('foco via clique preserva o valor existente (dígito é appendado, não substitui)', async ({
    page,
  }) => {
    const qty = await openPopoverWithItem(page);

    await qty.click();
    // Aguarda o rAF do onFocus aplicar setSelectionRange(end, end) antes de digitar.
    await page.waitForTimeout(50);
    await page.keyboard.type('9');

    // Se o valor estivesse selecionado (comportamento antigo), viraria "9".
    // Sem seleção, o cursor está no fim → resultado "39".
    await expect(qty).toHaveValue('39');
  });

  test('foco via Tab preserva o valor existente (dígito é appendado, não substitui)', async ({
    page,
  }) => {
    const qty = await openPopoverWithItem(page);

    // O decrement fica imediatamente antes do input no DOM — Tab a partir dele
    // leva foco ao input via teclado (caminho onde browsers costumam aplicar
    // seleção implícita em <input type="number">).
    const dec = page.getByTestId('cart-qty-decrement').first();
    await dec.focus();
    await page.keyboard.press('Tab');
    await expect(qty).toBeFocused();

    // Aguarda o rAF do onFocus antes de digitar.
    await page.waitForTimeout(50);
    await page.keyboard.type('9');

    await expect(qty).toHaveValue('39');
  });

  /**
   * A11y · navegação por teclado deve trazer foco ao input com cursor no fim,
   * sem highlight de texto. Combina três invariantes:
   *  a) o input é foco-alvo real do Tab (foco de teclado, não só ponteiro);
   *  b) o indicador visual de foco (:focus-visible → ring) é aplicado — usuários
   *     de teclado precisam ver onde estão;
   *  c) NÃO há texto selecionado dentro do input, verificado tanto pela API
   *     `selectionStart/selectionEnd` (quando o browser expõe em type=number)
   *     quanto por `window.getSelection().toString()`.
   */
  test('a11y · Tab foca o input com cursor no fim, sem seleção de texto e com anel de foco visível', async ({
    page,
  }) => {
    const qty = await openPopoverWithItem(page);

    const dec = page.getByTestId('cart-qty-decrement').first();
    await dec.focus();
    await page.keyboard.press('Tab');
    await expect(qty).toBeFocused();

    // Aguarda o rAF do onFocus reposicionar o cursor.
    await page.waitForTimeout(50);

    // (a+c) Introspecção do input focado.
    const focusState = await qty.evaluate((el: HTMLInputElement) => {
      let start: number | null = null;
      let end: number | null = null;
      try {
        // `selectionStart`/`selectionEnd` lançam em type=number em alguns
        // browsers — o try/catch abaixo preserva a semântica: se não expõe,
        // fica null e caímos no fallback da seleção do documento.
        start = el.selectionStart;
        end = el.selectionEnd;
      } catch {
        /* type=number sem API de seleção — tudo bem */
      }
      const docSelection = window.getSelection()?.toString() ?? '';
      const isFocused = document.activeElement === el;
      return { start, end, valueLength: el.value.length, docSelection, isFocused };
    });

    expect(focusState.isFocused, 'input deve estar focado após Tab').toBe(true);

    // Nada selecionado a nível de documento (cobre também browsers que não
    // expõem selectionStart em type=number).
    expect(
      focusState.docSelection,
      'nenhum texto deve estar selecionado no documento',
    ).toBe('');

    // Quando o browser expõe a API, cursor deve estar colapsado no fim.
    if (focusState.start !== null && focusState.end !== null) {
      expect(
        focusState.start,
        'seleção deve estar colapsada (start === end)',
      ).toBe(focusState.end);
      expect(
        focusState.end,
        'cursor deve estar no fim do valor',
      ).toBe(focusState.valueLength);
    }

    // (b) Indicador de foco visível: a classe do input define
    // `focus:ring-1 focus:ring-primary/20` → box-shadow não-nula quando focado.
    const boxShadow = await qty.evaluate(
      (el) => window.getComputedStyle(el).boxShadow,
    );
    expect(
      boxShadow,
      'anel de foco (:focus) deve ser aplicado para usuários de teclado',
    ).not.toBe('none');
  });
});
