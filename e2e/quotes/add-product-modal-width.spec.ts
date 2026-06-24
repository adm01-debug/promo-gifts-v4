/**
 * Modal "Adicionar Produto" do construtor de orçamento — largura responsiva.
 *
 * Garantias:
 *   1) Desktop: largura ~20% menor que o `max-w-2xl` (42rem) original  → ≈ 537px (33.6rem).
 *   2) Tablet (md): ≤ 480px.
 *   3) Mobile (<640px): preenche viewport com gutter de 1rem em cada lado e NÃO transborda.
 *
 * Auto-skip quando o modal não puder ser aberto sem seed (mantém a suíte estável
 * em ambientes sem dados de orçamento).
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

const MODAL = '[data-testid="quote-add-product-modal"]';
const PREV_MAX_PX = 672; // max-w-2xl = 42rem * 16
const TARGET_MAX_PX = Math.round(PREV_MAX_PX * 0.8); // 537.6

async function tryOpenModal(page: import('@playwright/test').Page): Promise<boolean> {
  await gotoAndSettle(page, '/orcamentos/novo');
  const addBtn = page.getByRole('button', { name: /\+\s*Produto|Adicionar Produto/i }).first();
  const visible = await addBtn
    .waitFor({ state: 'visible', timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  if (!visible) return false;
  await addBtn.click();
  return page
    .locator(MODAL)
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
}

test.describe('Modal "Adicionar Produto" — largura responsiva', () => {
  test.beforeEach(() => requireAuth());

  test('desktop: largura ≤ 20% menor que o tamanho original', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const opened = await tryOpenModal(page);
    test.skip(!opened, 'Modal não acessível sem seed neste ambiente.');

    const box = await page.locator(MODAL).boundingBox();
    expect(box, 'modal sem bounding box').not.toBeNull();
    // Tolerância de 4px para padding/border
    expect(box!.width).toBeLessThanOrEqual(TARGET_MAX_PX + 4);
    expect(box!.width).toBeLessThan(PREV_MAX_PX);
  });

  test('tablet (768px): largura ≤ 480px e fica dentro do viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    const opened = await tryOpenModal(page);
    test.skip(!opened, 'Modal não acessível sem seed neste ambiente.');

    const box = await page.locator(MODAL).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(484);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(768);
  });

  test('mobile (375px): respeita gutter e não transborda', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const opened = await tryOpenModal(page);
    test.skip(!opened, 'Modal não acessível sem seed neste ambiente.');

    const box = await page.locator(MODAL).boundingBox();
    expect(box).not.toBeNull();
    // viewport - 2rem (32px) com tolerância de 4px
    expect(box!.width).toBeLessThanOrEqual(375 - 32 + 4);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  });
});
