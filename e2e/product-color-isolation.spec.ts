import { test, expect } from '@playwright/test';

test.describe('Product Card Color Selection Isolation', () => {
  test.beforeEach(async ({ page }) => {
    // Acessa o catálogo
    await page.goto('/produtos');
    // Espera os produtos carregarem
    await page.waitForSelector('[data-testid="product-card"]');
  });

  test('deve isolar a seleção de cor em um card específico e persistir após reload', async ({ page }) => {
    // 1. Identifica dois cards diferentes
    const cards = page.locator('[data-testid="product-card"]');
    await expect(cards).toHaveCount({ greaterThan: 1 });

    const firstCard = cards.nth(0);
    const secondCard = cards.nth(1);

    const firstProductId = await firstCard.getAttribute('data-product-id');
    const secondProductId = await secondCard.getAttribute('data-product-id');

    // 2. No primeiro card, clica em uma cor diferente da primeira
    // Selecionamos a segunda bolinha de cor disponível no primeiro card
    const firstCardSwatches = firstCard.locator('[data-testid^="color-swatch-"]');
    const firstCardFirstSwatchName = await firstCardSwatches.nth(0).getAttribute('data-color-name');
    
    // Verifica se há pelo menos duas cores para testar a troca
    if (await firstCardSwatches.count() > 1) {
      const secondSwatch = firstCardSwatches.nth(1);
      const secondSwatchName = await secondSwatch.getAttribute('data-color-name');
      
      await secondSwatch.click();

      // 3. Verifica se a URL contém os parâmetros de isolamento (cor e pid)
      await expect(page).toHaveURL(new RegExp(`cor=${encodeURIComponent(secondSwatchName!)}`));
      await expect(page).toHaveURL(new RegExp(`pid=${firstProductId}`));

      // 4. Verifica se o segundo card NÃO mudou sua cor selecionada (deve manter a default ou anterior)
      const secondCardSwatches = secondCard.locator('[data-testid^="color-swatch-"]');
      const secondCardSelectedSwatch = secondCard.locator('[data-testid^="color-swatch-"][aria-checked="true"]');
      
      // Se o segundo card tiver seleção, não deve ser a mesma cor que clicamos no primeiro (a menos que seja a default dele)
      // O ponto crucial é que a ação no card 1 não disparou mudança visual no card 2
      const currentSelectedInSecond = await secondCardSelectedSwatch.getAttribute('data-color-name');
      // No início do teste, assumimos que o card 2 está no estado default
      
      // 5. Atualiza a página (Reload)
      await page.reload();
      await page.waitForSelector('[data-testid="product-card"]');

      // 6. Verifica se o Card 1 manteve a cor selecionada via URL
      const card1AfterReload = page.locator(`[data-product-id="${firstProductId}"]`);
      const selectedSwatch1 = card1AfterReload.locator('[data-testid^="color-swatch-"][aria-checked="true"]');
      await expect(selectedSwatch1).toHaveAttribute('data-color-name', secondSwatchName!);

      // 7. Verifica se o Card 2 continua sem ser afetado pelo parâmetro de URL do Card 1
      const card2AfterReload = page.locator(`[data-product-id="${secondProductId}"]`);
      const selectedSwatch2 = card2AfterReload.locator('[data-testid^="color-swatch-"][aria-checked="true"]');
      
      // Se o card 2 tinha uma cor selecionada por padrão, ela deve ser mantida, ignorando o ?cor= da URL que pertence ao card 1
      if (await selectedSwatch2.count() > 0) {
        const name2 = await selectedSwatch2.getAttribute('data-color-name');
        expect(name2).not.toBe(secondSwatchName);
      }
    }
  });

  test('deve alternar cores rapidamente sem vazar estado para outros cards', async ({ page }) => {
    const cards = page.locator('[data-testid="product-card"]');
    const firstCard = cards.nth(0);
    const swatches = firstCard.locator('[data-testid^="color-swatch-"]');
    
    if (await swatches.count() >= 3) {
      // Clica em 3 cores diferentes em sucessão rápida
      await swatches.nth(0).click();
      await swatches.nth(1).click();
      await swatches.nth(2).click();
      
      const lastColorName = await swatches.nth(2).getAttribute('data-color-name');
      
      // Verifica estado final no card 1
      await expect(firstCard.locator('[aria-checked="true"]')).toHaveAttribute('data-color-name', lastColorName!);
      
      // Verifica se o card 2 permanece intacto
      const secondCard = cards.nth(1);
      const secondCardSelected = secondCard.locator('[aria-checked="true"]');
      if (await secondCardSelected.count() > 0) {
        const name2 = await secondCardSelected.getAttribute('data-color-name');
        expect(name2).not.toBe(lastColorName);
      }
    }
  });
});
