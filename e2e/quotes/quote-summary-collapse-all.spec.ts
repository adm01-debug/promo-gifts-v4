/**
 * E2E: botão global "Recolher / Expandir" no header do Resumo.
 *
 * Cobre:
 *  - tooltip dinâmico com contagem ("N produtos abertos")
 *  - aria-expanded / aria-pressed / aria-label coerentes
 *  - recolher todos com um clique
 *  - expandir todos com um clique (toggle automático)
 *  - persistência via localStorage e estado após reload
 *  - coexistência com o botão "Agrupar" (sem quebrar layout)
 *
 * Padrão alinhado a quote-summary-card-collapse.spec.ts.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const STORAGE_KEY_NEW = 'quote-builder:collapsed-item-keys:new';

test.describe('Quote Builder · botão global Recolher / Expandir', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, 'user');
    // Limpa estado prévio de colapso para começar previsível.
    await page.addInitScript((k) => {
      try {
        window.localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    }, STORAGE_KEY_NEW);
  });

  test('recolhe todos, alterna para expandir e persiste após reload', async ({ page }) => {
    await gotoAndSettle(page, '/orcamentos/novo');

    const firstCard = page.getByTestId('quote-summary-item-0');
    if ((await firstCard.count()) === 0) {
      test.skip(true, 'Resumo vazio — adicionar produto está fora do escopo desta spec.');
    }
    await expect(firstCard).toBeVisible({ timeout: 10_000 });

    const collapseAll = page.getByTestId('quote-summary-collapse-all');
    await expect(collapseAll).toBeVisible();

    // Estado inicial: pelo menos 1 aberto → label deve dizer "Recolher".
    await expect(collapseAll).toHaveText(/Recolher/);
    await expect(collapseAll).toHaveAttribute('aria-pressed', 'false');
    await expect(collapseAll).toHaveAttribute('aria-expanded', 'true');

    // data-open-count espelha quantos cards estão abertos.
    const openCountAttr = await collapseAll.getAttribute('data-open-count');
    const openCount = Number(openCountAttr);
    expect(openCount).toBeGreaterThanOrEqual(1);

    // aria-label deve conter a contagem em PT-BR.
    const ariaLabel = (await collapseAll.getAttribute('aria-label')) ?? '';
    expect(ariaLabel).toMatch(/Recolher \d+ ite/);

    // Tooltip: hover → texto inclui "produto(s) aberto(s)".
    await collapseAll.hover();
    const tooltip = page.locator('[role="tooltip"]').first();
    await expect(tooltip).toBeVisible({ timeout: 2000 });
    await expect(tooltip).toHaveText(/produto/);

    // Clica: recolhe todos.
    await collapseAll.click();
    await expect(collapseAll).toHaveText(/Expandir/);
    await expect(collapseAll).toHaveAttribute('aria-pressed', 'true');
    await expect(collapseAll).toHaveAttribute('aria-expanded', 'false');
    await expect(collapseAll).toHaveAttribute('data-open-count', '0');

    // Todos os toggles individuais ficam colapsados.
    const allToggles = page.locator('[data-testid^="quote-summary-toggle-"]');
    const togglesCount = await allToggles.count();
    for (let i = 0; i < togglesCount; i++) {
      await expect(allToggles.nth(i)).toHaveAttribute('data-collapsed', 'true');
    }

    // Persistência: storage tem todas as chaves.
    const stored = await page.evaluate((k) => window.localStorage.getItem(k), STORAGE_KEY_NEW);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored as string)).toHaveLength(togglesCount);

    // Reload mantém o estado.
    await page.reload();
    await gotoAndSettle(page, '/orcamentos/novo');
    const collapseAllAfter = page.getByTestId('quote-summary-collapse-all');
    await expect(collapseAllAfter).toHaveText(/Expandir/);
    await expect(collapseAllAfter).toHaveAttribute('data-open-count', '0');

    // Toggle de volta: expande todos.
    await collapseAllAfter.click();
    await expect(collapseAllAfter).toHaveText(/Recolher/);
    await expect(collapseAllAfter).toHaveAttribute('data-open-count', String(togglesCount));
  });

  test('coexiste com botão Agrupar sem quebrar layout', async ({ page }) => {
    await gotoAndSettle(page, '/orcamentos/novo');

    const firstCard = page.getByTestId('quote-summary-item-0');
    if ((await firstCard.count()) === 0) {
      test.skip(true, 'Resumo vazio.');
    }

    const collapseAll = page.getByTestId('quote-summary-collapse-all');
    const group = page.getByTestId('quote-summary-group-trigger');

    // Ambos visíveis quando há ≥2 itens.
    const itemsCount = await page.locator('[data-testid^="quote-summary-item-"]').count();
    if (itemsCount >= 2) {
      await expect(group).toBeVisible();
      await expect(collapseAll).toBeVisible();

      // Mesma linha horizontal (mesmo container flex `ml-auto`).
      const collapseBox = await collapseAll.boundingBox();
      const groupBox = await group.boundingBox();
      expect(collapseBox).not.toBeNull();
      expect(groupBox).not.toBeNull();
      // Tolerância: ±4px de alinhamento vertical.
      expect(Math.abs((collapseBox!.y) - (groupBox!.y))).toBeLessThanOrEqual(4);
    }
  });
});
