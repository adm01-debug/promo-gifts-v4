/**
 * E2E — Matriz QuickView: 4 módulos × 3 visualizações × ordem canônica dos 6 botões.
 *
 * Garante que `ProductQuickView` renderiza SEMPRE, em qualquer rota/visualização:
 *   🛒 carrinho → 📄 orçamento → 📁 coleção → ❤️ favorito → 📊 comparar → 🔗 compartilhar
 *
 * Falha no primeiro indício de regressão (ordem, ausência, testid duplicado).
 *
 * Skipa graciosamente quando a rota não tem dados (sem auth = sem cards).
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

const ROUTES = [
  { path: '/produtos',   label: 'catalogo'      },
  { path: '/filtros',    label: 'super-filtro'  },
  { path: '/novidades',  label: 'novidades'     },
  { path: '/reposicao',  label: 'reposicao'     },
] as const;

const VIEW_MODES = [
  { id: 'grid',  toggleTid: 'view-mode-grid'  },
  { id: 'list',  toggleTid: 'view-mode-list'  },
  { id: 'table', toggleTid: 'view-mode-table' },
] as const;

/** Ordem canônica imutável (espelha ProductQuickView.tsx). */
const EXPECTED_BUTTONS = [
  'product-quickview-cart',
  'product-quickview-quote',
  'product-quickview-collection',
  'product-quickview-favorite',
  'product-quickview-compare',
  'product-quickview-share',
] as const;

test.describe('QuickView · matriz 4 módulos × 3 visualizações × ordem dos botões', () => {
  test.beforeEach(async () => {
    requireAuth();
  });

  for (const route of ROUTES) {
    for (const view of VIEW_MODES) {
      test(`[${route.label}] ${view.id}: 6 botões na ordem canônica`, async ({ page }) => {
        await gotoAndSettle(page, route.path);

        // Tenta alternar para o modo de visualização. Se o toggle não existir
        // na rota (ex.: novidades sem table), o teste cai para o modo default.
        const toggle = page.locator(`[data-testid="${view.toggleTid}"]`).first();
        if (await toggle.count()) {
          await toggle.click().catch(() => { /* já ativo */ });
        }

        // Localiza qualquer trigger de imagem que abra o QuickView.
        const triggers = page.locator([
          '[data-testid="product-card-image-quickview"]',
          '[data-testid="novelty-grid-card-thumb"]',
          '[data-testid="product-list-item-image-quickview"]',
          '[data-testid="product-table-row-image-quickview"]',
        ].join(', '));

        const count = await triggers.count();
        test.skip(count === 0, `Sem produtos visíveis em ${route.path} (${view.id})`);

        await triggers.first().click();

        // Aguarda o painel de ações renderizar.
        const actions = page.locator('[data-testid="product-quickview-actions"]');
        await expect(actions).toBeVisible({ timeout: 10_000 });

        // 1) Cada botão da ordem canônica precisa existir exatamente 1x.
        for (const tid of EXPECTED_BUTTONS) {
          await expect(
            actions.locator(`[data-testid="${tid}"]`),
            `Botão ${tid} deve existir 1x em ${route.label}/${view.id}`,
          ).toHaveCount(1);
        }

        // 2) A ordem DOM deve ser exatamente a canônica.
        const allButtons = actions.locator(
          EXPECTED_BUTTONS.map((t) => `[data-testid="${t}"]`).join(', '),
        );
        const actualOrder = await allButtons.evaluateAll((els) =>
          els.map((el) => (el as HTMLElement).dataset.testid).filter(Boolean),
        );
        expect(
          actualOrder,
          `Ordem dos botões divergente em ${route.label}/${view.id}`,
        ).toEqual([...EXPECTED_BUTTONS]);
      });
    }
  }
});
