/**
 * E2E — Modo Lista: ProductListItem com colunas "Estoque · Cores · A partir de".
 *
 * Garante nas 4 rotas (Catálogo, Super Filtro, Novidades, Reposição) que:
 *   1. Não existe chip "+N" (overflow) — `wrap` está ativo.
 *   2. Container de cores usa `flex-wrap` (sem `overflow-hidden`/`max-h` cortando).
 *   3. Cabeçalhos semânticos "ESTOQUE", "CORES", "A PARTIR DE" aparecem (md+).
 *   4. Cada coluna é um `role="group"` com `aria-labelledby` válido.
 *
 * Skipa graciosamente quando a rota não retorna cards (auth/data ausentes).
 */
import { test, expect } from '../fixtures/test-base';
import { requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

const ROUTES = [
  { path: '/produtos',  label: 'catalogo'     },
  { path: '/filtros',   label: 'super-filtro' },
  { path: '/novidades', label: 'novidades'    },
  { path: '/reposicao', label: 'reposicao'    },
] as const;

const LIST_ITEM_THUMB  = '[data-testid="product-list-item-thumb"]';
const COLORS_CONTAINER = '[data-testid="product-colors-container"]';
const OVERFLOW_CHIP    = '[data-testid="color-swatches-overflow"]';

test.describe('Lista · ProductListItem com colunas rotuladas', () => {
  test.beforeEach(() => requireAuth());

  for (const route of ROUTES) {
    test(`[${route.label}] lista renderiza colunas e cores sem clipping`, async ({ page }) => {
      await page.setViewportSize({ width: 1366, height: 768 });
      await gotoAndSettle(page, route.path);

      // Alterna para lista (idempotente).
      const listToggle = page.locator('[data-testid="view-mode-list"]').first();
      if (await listToggle.count()) await listToggle.click().catch(() => undefined);

      const thumbs = page.locator(LIST_ITEM_THUMB);
      const count = await thumbs.count();
      test.skip(count === 0, `Sem itens em ${route.path} (auth/data ausente).`);

      // 1) Sem chip "+N" em nenhum item da lista.
      await expect(page.locator(OVERFLOW_CHIP)).toHaveCount(0);

      // 2) Container de cores usa flex-wrap em todos os itens visíveis.
      const sample = Math.min(count, 8);
      for (let i = 0; i < sample; i++) {
        const c = page.locator(COLORS_CONTAINER).nth(i);
        if (!(await c.count())) continue;
        const cls = (await c.getAttribute('class')) ?? '';
        expect(cls, `item ${i} sem flex-wrap`).toContain('flex-wrap');
        expect(cls, `item ${i} com overflow-hidden`).not.toContain('overflow-hidden');
      }

      // 3) Cabeçalhos das colunas presentes (md+).
      await expect(page.getByText('Estoque', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Cores', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('A partir de', { exact: true }).first()).toBeVisible();

      // 4) role="group" com aria-labelledby resolvendo para o label correto.
      const stockGroup = page.locator('[role="group"][aria-labelledby^="stock-label-"]').first();
      const labelId = await stockGroup.getAttribute('aria-labelledby');
      expect(labelId).toBeTruthy();
      if (labelId) {
        await expect(page.locator(`#${CSS.escape(labelId)}`)).toHaveText(/estoque/i);
      }
    });
  }

  test('[mobile 320px] estoque inline aparece (fallback md:hidden)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await gotoAndSettle(page, '/produtos');

    const listToggle = page.locator('[data-testid="view-mode-list"]').first();
    if (await listToggle.count()) await listToggle.click().catch(() => undefined);

    const thumbs = page.locator(LIST_ITEM_THUMB);
    const count = await thumbs.count();
    test.skip(count === 0, 'Sem itens em /produtos (auth/data ausente).');

    // O <span aria-label="Estoque: ..."> inline deve existir no DOM.
    const inlineStock = page.locator('[aria-label^="Estoque:"]').first();
    await expect(inlineStock).toBeVisible();
  });
});
