/**
 * E2E: ao alternar de carrinho, o cabeçalho do carrinho ativo troca
 * corretamente o nome da empresa e, quando disponível, o CNPJ mascarado
 * — substitui a asserção antiga sobre ramo de atividade + "Atualizado há…".
 *
 * O cabeçalho antigo (page-title-carrinhos) foi removido; a âncora agora é
 * `active-cart-header` (Card do carrinho ativo).
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

// CNPJ mascarado: 00.000.000/0000-00
const CNPJ_MASK_RE = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

test.describe('Carrinhos · cabeçalho reflete carrinho ativo @carrinhos', () => {
  test('troca nome da empresa (e CNPJ, quando disponível) ao alternar de carrinho', async ({
    page,
  }, testInfo) => {
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

    const readHeader = async () => {
      await expect(page.getByTestId('active-cart-header')).toBeVisible();
      const name = (await page.getByTestId('active-cart-company-name').innerText()).trim();
      // CNPJ é opcional: só renderiza quando o CRM devolve valor válido.
      const cnpjLocator = page.getByTestId('active-cart-cnpj');
      const cnpj = (await cnpjLocator.count()) > 0
        ? (await cnpjLocator.innerText()).trim()
        : null;
      return { name, cnpj };
    };

    // Abre carrinho A
    recordNav(testInfo, `A:${ids[0]}`);
    await gotoAndSettle(page, `/carrinhos/${ids[0]}`);
    await expect(page).toHaveURL(new RegExp(`/carrinhos/${ids[0]}`));
    const a = await readHeader();
    setDebugContext(testInfo, { headerA: a });

    // O cabeçalho NÃO deve mais exibir textos legados (ramo/atualizado há).
    const headerText = (await page.getByTestId('active-cart-header').innerText()).toLowerCase();
    expect(headerText).not.toMatch(/atualizado há/);
    expect(headerText).not.toContain('energia solar');

    if (a.cnpj !== null) expect(a.cnpj).toMatch(CNPJ_MASK_RE);

    // Abre carrinho B
    recordNav(testInfo, `B:${ids[1]}`);
    await gotoAndSettle(page, `/carrinhos/${ids[1]}`);
    await expect(page).toHaveURL(new RegExp(`/carrinhos/${ids[1]}`));
    const b = await readHeader();
    setDebugContext(testInfo, { headerB: b });
    if (b.cnpj !== null) expect(b.cnpj).toMatch(CNPJ_MASK_RE);

    // Nome da empresa OU CNPJ DEVE mudar entre carrinhos distintos.
    expect(a.name !== b.name || a.cnpj !== b.cnpj).toBeTruthy();
  });

  test('listagem exibe CNPJ mascarado quando disponível @carrinhos', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    const cnpjCells = page.locator('[data-testid^="cart-row-cnpj-"]');
    const count = await cnpjCells.count();
    if (count === 0) {
      test.skip(true, 'nenhum carrinho listado com CNPJ do CRM disponível');
    }

    // Toda célula renderizada deve seguir a máscara canônica.
    for (let i = 0; i < Math.min(count, 5); i++) {
      const txt = (await cnpjCells.nth(i).innerText()).trim();
      expect(txt).toMatch(CNPJ_MASK_RE);
    }
  });
});
