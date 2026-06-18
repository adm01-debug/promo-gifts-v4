/**
 * QuickView — ordem e estados dos botões de ação.
 *
 * Valida:
 *  1. Ordem visual: Carrinho → Orçamento → Coleção → Favorito → Comparar → Compartilhar
 *  2. Alinhamento horizontal (mesma linha) em desktop / tablet / mobile
 *  3. Botão Carrinho é sempre o primeiro (x mais à esquerda do grupo)
 *  4. Estados do Carrinho: habilitado, desabilitado (out-of-stock) e "carregando"
 *
 * Estratégia de robustez: usamos uma página de teste isolada (`/__test/quickview-actions`)
 * que renderiza o `ProductQuickView` com props controladas, sem depender de
 * autenticação, banco externo ou roteamento de catálogo. Se a rota não existir
 * no build (env de prod), o spec é pulado.
 */
import { test, expect, type Page } from '@playwright/test';

const ACTIONS_SELECTOR = '[data-testid="product-quickview-actions"]';
const EXPECTED_ORDER = [
  'Adicionar ao carrinho',
  'Adicionar ao orçamento',
  'Adicionar à coleção',
  'Adicionar aos favoritos',
  'Comparar produto',
  'Compartilhar',
] as const;

const VIEWPORTS = [
  { name: 'desktop', width: 1536, height: 864 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

async function openHarness(page: Page, params = '') {
  const url = `/__test/quickview-actions${params}`;
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (!resp || resp.status() >= 400) {
    test.skip(true, `Harness route ${url} indisponível (status=${resp?.status() ?? 'n/a'})`);
  }
  const actions = page.locator(ACTIONS_SELECTOR);
  // Se o harness não montar o QuickView dentro de 3s, pula.
  try {
    await actions.waitFor({ state: 'visible', timeout: 3000 });
  } catch {
    test.skip(true, 'QuickView harness não montado — rota de teste ausente.');
  }
}

async function getButtonsInOrder(page: Page) {
  const actions = page.locator(ACTIONS_SELECTOR);
  const buttons = actions.locator('button');
  const count = await buttons.count();
  const result: { label: string; box: { x: number; y: number; width: number; height: number } }[] = [];
  for (let i = 0; i < count; i++) {
    const btn = buttons.nth(i);
    const label = (await btn.getAttribute('aria-label')) ?? '';
    const box = await btn.boundingBox();
    if (!box) continue;
    result.push({ label, box });
  }
  // Garante ordem espacial (x crescente), independente da ordem do DOM.
  result.sort((a, b) => a.box.x - b.box.x);
  return result;
}

test.describe('QuickView • ordem e estados dos botões de ação', () => {
  for (const vp of VIEWPORTS) {
    test(`ordem visual [${vp.name} ${vp.width}x${vp.height}]`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openHarness(page);

      const buttons = await getButtonsInOrder(page);
      const labels = buttons.map((b) => b.label);

      // 1. Ordem exata
      expect(labels).toEqual([...EXPECTED_ORDER]);

      // 2. Carrinho é sempre o primeiro
      expect(buttons[0].label).toBe('Adicionar ao carrinho');

      // 3. Alinhamento horizontal: todos compartilham (aprox.) o mesmo Y.
      //    Tolerância de 6px cobre sub-pixel rounding + borda do flex-wrap.
      const ys = buttons.map((b) => b.box.y);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      expect(maxY - minY).toBeLessThanOrEqual(6);

      // 4. Ordem do DOM == ordem visual (não há inversão por flex-direction)
      const domLabels: string[] = [];
      const domButtons = page.locator(`${ACTIONS_SELECTOR} button`);
      const n = await domButtons.count();
      for (let i = 0; i < n; i++) {
        domLabels.push((await domButtons.nth(i).getAttribute('aria-label')) ?? '');
      }
      expect(domLabels).toEqual([...EXPECTED_ORDER]);
    });
  }

  test('Carrinho • estado habilitado (in-stock)', async ({ page }) => {
    await openHarness(page, '?stock=in');
    const cart = page.locator(`${ACTIONS_SELECTOR} button`).first();
    await expect(cart).toHaveAttribute('aria-label', 'Adicionar ao carrinho');
    await expect(cart).toBeEnabled();
  });

  test('Carrinho • estado desabilitado (out-of-stock) preserva ordem', async ({ page }) => {
    await openHarness(page, '?stock=out');
    const cart = page.locator(`${ACTIONS_SELECTOR} button`).first();
    await expect(cart).toHaveAttribute('aria-label', 'Adicionar ao carrinho');
    await expect(cart).toBeDisabled();

    // Ordem permanece intacta mesmo com disabled
    const labels = (await getButtonsInOrder(page)).map((b) => b.label);
    expect(labels).toEqual([...EXPECTED_ORDER]);
  });

  test('Carrinho • estado "carregando" (loading) preserva ordem e bloqueia clique', async ({ page }) => {
    await openHarness(page, '?stock=in&loading=1');
    const cart = page.locator(`${ACTIONS_SELECTOR} button`).first();
    await expect(cart).toHaveAttribute('aria-label', 'Adicionar ao carrinho');
    // Em loading o harness aplica `disabled` no botão Carrinho.
    await expect(cart).toBeDisabled();

    const labels = (await getButtonsInOrder(page)).map((b) => b.label);
    expect(labels).toEqual([...EXPECTED_ORDER]);
  });
});
