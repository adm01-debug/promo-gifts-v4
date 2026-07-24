/**
 * E2E: recolher/expandir cards de produto no Resumo do Quote Builder.
 *
 * Garante:
 *  - colapso individualizado por produto (não afeta outros cards)
 *  - feedback visual imediato (aria-expanded, data-collapsed, aria-pressed)
 *  - persistência por orçamento (chave localStorage `:new` quando sem id)
 *  - estado preservado após reload
 *
 * Espelha o padrão de e2e/carrinhos/cart-collapse-first.spec.ts e usa
 * `loginAs` (storageState global) para rodar autenticado na sandbox.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const STORAGE_KEY_NEW = 'quote-builder:collapsed-item-keys:new';

test.describe('Quote Builder · colapso individual de cards no Resumo', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, 'user');
  });

  test('card colapsa/expande individualmente e persiste após reload', async ({ page }) => {
    await gotoAndSettle(page, '/orcamentos/novo');

    // Aguarda pelo menos um card no resumo. Se não houver itens (orçamento
    // novo vazio), o teste é pulado — o fluxo de adicionar produto está fora
    // do escopo desta spec (validado em flows/04-quotes.spec.ts).
    const firstCard = page.getByTestId('quote-summary-item-0');
    if ((await firstCard.count()) === 0) {
      test.skip(true, 'Nenhum item no resumo — adicionar produto está fora do escopo.');
    }
    await expect(firstCard).toBeVisible({ timeout: 10_000 });

    const firstToggle = page.getByTestId('quote-summary-toggle-0');
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(firstToggle).toHaveAttribute('data-collapsed', 'false');

    // Recolhe o primeiro.
    await firstToggle.click();
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(firstToggle).toHaveAttribute('data-collapsed', 'true');
    await expect(firstToggle).toHaveAttribute('aria-pressed', 'true');

    // Se houver um segundo card, garante isolamento entre cards.
    const secondToggle = page.getByTestId('quote-summary-toggle-1');
    if (await secondToggle.count()) {
      await expect(secondToggle).toHaveAttribute('data-collapsed', 'false');
    }

    // localStorage por orçamento (`:new` quando ainda não há id salvo).
    const stored = await page.evaluate(
      (k) => window.localStorage.getItem(k),
      STORAGE_KEY_NEW,
    );
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored as string)).toHaveLength(1);

    // Expande novamente e valida.
    await firstToggle.click();
    await expect(firstToggle).toHaveAttribute('data-collapsed', 'false');

    // Recolhe outra vez e recarrega — estado deve persistir.
    await firstToggle.click();
    await expect(firstToggle).toHaveAttribute('data-collapsed', 'true');
    await page.reload();

    const firstToggleAfter = page.getByTestId('quote-summary-toggle-0');
    await expect(firstToggleAfter).toHaveAttribute('data-collapsed', 'true', {
      timeout: 10_000,
    });
  });
});
