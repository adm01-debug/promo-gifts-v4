/**
 * Visual regression + smoke do posicionamento do toggle
 * "Contar dias | Data fixa" ao lado de "Prazo | Entrega ⓘ".
 *
 * Requer sessão autenticada (storageState) — roda nos projects
 * `chromium-authed` e `mobile-chrome` do playwright.config.ts.
 *
 * Snapshots vivem em ./quote-delivery-toggle.spec.ts-snapshots/
 * (Playwright cria/atualiza com --update-snapshots).
 */
import { test, expect } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

test.describe('QuoteBuilder — toggle Prazo|Entrega', () => {
  test('toggle fica logo após label + tooltip (DOM order)', async ({ page }) => {
    await gotoAndSettle(page, '/orcamentos/novo');

    const row = page.getByTestId('delivery-label-container').first();
    await expect(row).toBeVisible({ timeout: 15_000 });

    const label = row.getByTestId('delivery-label');
    const tooltip = row.getByTestId('delivery-info-tooltip-trigger');
    const toggle = row.getByTestId('delivery-mode-toggle');

    await expect(label).toBeVisible();
    await expect(tooltip).toBeVisible();
    await expect(toggle).toBeVisible();

    // Ordem geométrica: label.x < tooltip.x < toggle.x, todos na mesma linha (Y ~ igual)
    const [b1, b2, b3] = await Promise.all([
      label.boundingBox(),
      tooltip.boundingBox(),
      toggle.boundingBox(),
    ]);
    expect(b1 && b2 && b3).toBeTruthy();
    expect(b1!.x).toBeLessThan(b2!.x);
    expect(b2!.x).toBeLessThan(b3!.x);
    // Toggle NÃO deve estar na extremidade direita do container pai
    const parent = await row.boundingBox();
    const distToRightEdge = parent!.x + parent!.width - (b3!.x + b3!.width);
    expect(distToRightEdge).toBeGreaterThan(20); // colado à esquerda, não flush-right
    // Mesma linha (delta y < 8px)
    expect(Math.abs(b1!.y - b3!.y)).toBeLessThan(8);
  });

  test('visual snapshot do bloco Prazo|Entrega', async ({ page }, testInfo) => {
    await gotoAndSettle(page, '/orcamentos/novo');
    const row = page.getByTestId('delivery-label-container').first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    // Screenshot só do bloco (não da página inteira) — diff estável
    expect(await row.screenshot()).toMatchSnapshot(
      `delivery-row-${testInfo.project.name}.png`,
      { maxDiffPixelRatio: 0.01 },
    );
  });
});
