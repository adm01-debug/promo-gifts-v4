/**
 * QuoteItemsList — layout responsivo em 320 / 375 / 768.
 *
 * Valida:
 *  1. Linha Qtd / Preço / Subtotal renderiza em UMA única linha
 *     (mesmo Y do label e do input/valor) em todos os viewports críticos.
 *  2. Sem overflow horizontal — nem na página, nem no card do item,
 *     nem na própria linha de inputs — mesmo com textos longos.
 *  3. Snapshot visual da linha de inputs por viewport (regressão de
 *     espaçamento / quebra / corte de componentes).
 *
 * Rota: `/__visual/quote-items-list-mobile` (dev-only harness, sem auth).
 */
import { test, expect } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-items-list-mobile';
const VIEWPORTS = [
  { name: '320', width: 320, height: 720 },
  { name: '375', width: 375, height: 800 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 900 },
  { name: '1440', width: 1440, height: 1000 },
] as const;


for (const vp of VIEWPORTS) {
  test.describe(`QuoteItemsList @ ${vp.name}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, ROUTE);
      await expect(page.getByTestId('quote-items-list-mobile-harness')).toBeVisible();
    });

    test('Qtd / Preço / Subtotal na mesma linha (sem overflow)', async ({ page }) => {
      // Item com textos longos é o índice 1 (pior caso).
      const row = page.getByTestId('quote-item-1').getByTestId('quote-item-inputs-row');
      await expect(row).toBeVisible();

      const qty = page.getByTestId('quote-item-1').getByTestId('quote-item-qty-input');
      const price = page.getByTestId('quote-item-1').getByTestId('quote-item-price-display');
      const subtotal = page.getByTestId('quote-item-1').getByTestId('quote-item-subtotal');

      const [rowBox, qtyBox, priceBox, subBox] = await Promise.all([
        row.boundingBox(),
        qty.boundingBox(),
        price.boundingBox(),
        subtotal.boundingBox(),
      ]);
      expect(rowBox && qtyBox && priceBox && subBox).toBeTruthy();
      if (!rowBox || !qtyBox || !priceBox || !subBox) return;

      // Mesma linha = centros verticais dentro de ±4px.
      const cy = (b: { y: number; height: number }) => b.y + b.height / 2;
      const baseY = cy(qtyBox);
      expect(Math.abs(cy(priceBox) - baseY)).toBeLessThanOrEqual(4);
      expect(Math.abs(cy(subBox) - baseY)).toBeLessThanOrEqual(4);

      // Sem overflow horizontal: linha cabe dentro do viewport.
      expect(rowBox.x + rowBox.width).toBeLessThanOrEqual(vp.width + 1);

      // Subtotal não corta nem invade a área do preço.
      expect(subBox.x).toBeGreaterThanOrEqual(priceBox.x + priceBox.width - 1);
      expect(subBox.x + subBox.width).toBeLessThanOrEqual(vp.width + 1);

      // Página sem scroll horizontal.
      const { scrollW, clientW } = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      expect(scrollW).toBeLessThanOrEqual(clientW + 1);
    });

    test('snapshot visual da linha de inputs (regressão de espaçamento)', async ({
      page,
    }) => {
      const row = page.getByTestId('quote-item-1').getByTestId('quote-item-inputs-row');
      await expect(row).toBeVisible();
      // Threshold pequeno para flagrar mudanças sutis de padding/margem.
      expect(await row.screenshot()).toMatchSnapshot(
        `quote-items-list-inputs-row-${vp.name}.png`,
        { maxDiffPixelRatio: 0.02 },
      );
    });

    test('Preço é read-only (sem input editável) e expõe a11y de somente leitura', async ({
      page,
    }) => {
      const row = page.getByTestId('quote-item-1');
      const display = row.getByTestId('quote-item-price-display');

      // Existe display read-only e NÃO existe input editável.
      await expect(display).toBeVisible();
      await expect(row.getByTestId('quote-item-price-input')).toHaveCount(0);

      // Não é um <input>/<textarea>/contenteditable — usuário não consegue digitar.
      const editable = await display.evaluate((el) => {
        const tag = el.tagName.toLowerCase();
        return (
          tag === 'input' ||
          tag === 'textarea' ||
          (el as HTMLElement).isContentEditable === true
        );
      });
      expect(editable, 'preço NÃO pode ser editável').toBe(false);

      // a11y: aria-label e title comunicam "somente leitura / não editável".
      const aria = await display.getAttribute('aria-label');
      expect(aria, 'aria-label deve marcar como somente leitura').toMatch(
        /somente leitura|read[- ]?only|n[ãa]o edit/i,
      );
      const title = await display.getAttribute('title');
      expect(title, 'title deve explicar que o preço não é editável').toMatch(
        /n[ãa]o edit|cat[áa]logo|read[- ]?only/i,
      );

      // Tentar focar+digitar não deve alterar o texto exibido.
      const before = (await display.textContent())?.trim() ?? '';
      await display.click({ force: true }).catch(() => {});
      await page.keyboard.type('9999');
      const after = (await display.textContent())?.trim() ?? '';
      expect(after).toBe(before);
    });
  });
}

