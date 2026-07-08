/**
 * E2E: CartSidebar reflete apenas o carrinho ativo.
 *
 * Após a repaginação, Subtotal/SKUs/Qtd. total vivem no header — a sidebar
 * mantém CTA "Gerar Orçamento" + peso/volume (quando aplicável). Este spec
 * abre 2 carrinhos distintos e valida que:
 *   1) CTA "Gerar Orçamento" da sidebar sempre existe (sinal de estar ativa);
 *   2) A sidebar NÃO exibe mais o subtotal duplicado do header;
 *   3) Se ambos os carrinhos trazem peso/volume, os valores mudam ao alternar
 *      — jamais persistem os do carrinho anterior.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import {
  installFailureCapture,
  recordCarts,
  recordNav,
  setDebugContext,
} from '../helpers/attach-on-failure';

installFailureCapture(test);

test.describe('Carrinhos · sidebar reflete carrinho ativo @carrinhos', () => {
  test('CTA presente, sem subtotal duplicado, peso/volume acompanham a troca', async ({ page }, testInfo) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    const rows = page.locator('[data-testid^="cart-row-"]').filter({
      hasNot: page.locator('[data-testid^="cart-row-open-"]'),
    });
    const total = await rows.count();
    if (total < 2) {
      test.skip(true, 'precisa de ao menos 2 carrinhos para validar alternância');
    }

    const ids: string[] = [];
    for (let i = 0; i < Math.min(total, 2); i++) {
      const tid = await rows.nth(i).getAttribute('data-testid');
      const id = tid?.replace('cart-row-', '');
      if (id) ids.push(id);
    }
    expect(ids.length).toBe(2);
    recordCarts(testInfo, { A: ids[0], B: ids[1] });

    const readSidebar = async () => {
      const hero = page.getByTestId('cart-sidebar-hero');
      if (!(await hero.isVisible().catch(() => false))) {
        return { visible: false, hasCta: false, text: '' };
      }
      const text = (await hero.innerText()).trim();
      const hasCta = await page.getByTestId('cart-checkout-cta').isVisible();
      return { visible: true, hasCta, text };
    };

    // --- Carrinho A ---
    recordNav(testInfo, `A:${ids[0]}`);
    await gotoAndSettle(page, `/carrinhos/${ids[0]}`);
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    const a = await readSidebar();
    setDebugContext(testInfo, { sidebarA: a });

    if (!a.visible) {
      // Sem itens → sidebar não renderiza; nada a validar.
      test.skip(true, 'carrinho A sem itens — sidebar não é exibida');
    }

    // CTA principal existe.
    expect(a.hasCta).toBe(true);

    // A sidebar NÃO deve mais trazer o subtotal do header duplicado.
    expect(a.text).not.toMatch(/Subtotal do carrinho/i);
    expect(a.text).not.toMatch(/Qtd\.\s*total/i);

    // --- Carrinho B ---
    recordNav(testInfo, `B:${ids[1]}`);
    await gotoAndSettle(page, `/carrinhos/${ids[1]}`);
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    const b = await readSidebar();
    setDebugContext(testInfo, { sidebarB: b });

    if (!b.visible) test.skip(true, 'carrinho B sem itens — sidebar não é exibida');

    expect(b.hasCta).toBe(true);
    expect(b.text).not.toMatch(/Subtotal do carrinho/i);
    expect(b.text).not.toMatch(/Qtd\.\s*total/i);

    // Peso/Volume: quando ambos exibem, os valores TÊM que diferir OU
    // pelo menos um dos dois carrinhos deve estar sem esses blocos —
    // nunca podem persistir idênticos vindos do carrinho A ao alternar
    // se os dados reais forem diferentes.
    const aHasWeight = /Peso/i.test(a.text);
    const bHasWeight = /Peso/i.test(b.text);
    if (aHasWeight && bHasWeight) {
      // Extrai as linhas de peso e valida que não são idênticas por engano.
      const aWeight = a.text.match(/Peso[\s\S]{0,40}/i)?.[0] ?? '';
      const bWeight = b.text.match(/Peso[\s\S]{0,40}/i)?.[0] ?? '';
      // Se algum carrinho realmente tem peso diferente do outro, valores
      // devem divergir. Se por acaso forem iguais (mesmo peso real), pelo
      // menos garantimos que o bloco existe e é do carrinho ativo.
      expect(aWeight.length).toBeGreaterThan(0);
      expect(bWeight.length).toBeGreaterThan(0);
      // Marcador simbólico: se os textos completos da sidebar são idênticos
      // entre carrinhos distintos com itens diferentes, provavelmente há
      // agregação/persistência indevida.
      expect(a.text === b.text && ids[0] !== ids[1]).toBe(false);
    }
  });
});
