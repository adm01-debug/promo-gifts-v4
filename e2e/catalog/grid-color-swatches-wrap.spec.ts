/**
 * E2E — Grid color swatches em modo `wrap` (Catálogo, Super Filtro, Novidades, Reposição).
 *
 * Garante que nos cards de grid:
 *   1. O chip de overflow `+N` NÃO aparece (data-testid="color-swatches-overflow").
 *   2. O container das cores usa `flex-wrap` (sem clipping de borda).
 *   3. A quantidade de bolinhas renderizadas (role="radio" dentro do
 *      `[data-testid="product-colors-container"]`) é igual à contagem real
 *      de cores anunciada no aria-label do container.
 *
 * Skipa graciosamente quando a rota não tem dados (sem auth = sem cards).
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

const COLORS_CONTAINER = '[data-testid="product-colors-container"]';
const OVERFLOW_CHIP    = '[data-testid="color-swatches-overflow"]';

test.describe('Grid · ProductColorSwatches modo wrap', () => {
  test.beforeEach(() => requireAuth());

  for (const route of ROUTES) {
    test(`[${route.label}] grid renderiza TODAS as cores sem chip "+N"`, async ({ page }) => {
      await gotoAndSettle(page, route.path);

      // Garante grid view (idempotente — se já estiver em grid, no-op).
      const toggle = page.locator('[data-testid="view-mode-grid"]').first();
      if (await toggle.count()) await toggle.click().catch(() => undefined);

      const containers = page.locator(COLORS_CONTAINER);
      const count = await containers.count();
      test.skip(count === 0, `Sem cards em ${route.path} (auth/data ausente).`);

      // 1) Nenhum chip "+N" em nenhum card do grid.
      await expect(page.locator(OVERFLOW_CHIP)).toHaveCount(0);

      // 2 + 3) Para até 8 cards: container usa flex-wrap e nº de bolinhas == aria-label.
      const sample = Math.min(count, 8);
      for (let i = 0; i < sample; i++) {
        const c = containers.nth(i);
        const cls = (await c.getAttribute('class')) ?? '';
        expect(cls).toContain('flex-wrap');
        expect(cls).not.toContain('overflow-hidden');

        const label = (await c.getAttribute('aria-label')) ?? '';
        const match = label.match(/^(\d+)\s+cor/i);
        if (!match) continue; // sem cores → nada a comparar
        const expected = Number(match[1]);
        const rendered = await c.locator('[role="radio"]').count();
        expect(rendered, `card #${i} em ${route.path}`).toBe(expected);
      }
    });
  }
});
