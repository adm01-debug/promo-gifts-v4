import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { TID } from "../fixtures/selectors";

test.describe("Regressão Visual: Bolinhas de Cores (Swatches)", () => {
  test.beforeEach(() => requireAuth());

  test("valida que as bolinhas não ficam recortadas em diferentes estados", async ({ page }) => {
    // 1. Navega para o catálogo onde os swatches são visíveis nos cards
    await gotoAndSettle(page, "/produtos");

    // 2. Localiza o primeiro container de swatches
    const swatchContainer = page.locator(TID("product-colors-container")).first();
    await expect(swatchContainer).toBeVisible();

    // 3. Pega a primeira bolinha (swatch)
    const firstSwatch = swatchContainer.locator('button[type="button"]').first();
    await expect(firstSwatch).toBeVisible();

    // 4. Verifica estado INICIAL (Normal)
    // Garantimos que o container tem padding/overflow suficiente para não cortar o zoom
    // O container deve ter overflow: visible (ou pelo menos permitir que o zoom de 112% apareça)
    // No nosso caso usamos overflow: hidden no container mas com py-1.5 para dar margem
    const containerBox = await swatchContainer.boundingBox();
    const swatchBox = await firstSwatch.boundingBox();
    
    if (containerBox && swatchBox) {
      // A bolinha deve estar contida verticalmente com folga para o zoom
      expect(swatchBox.y).toBeGreaterThan(containerBox.y);
      expect(swatchBox.y + swatchBox.height).toBeLessThan(containerBox.y + containerBox.height);
    }

    // 5. Verifica estado HOVER (Zoom)
    await firstSwatch.hover();
    // Aguarda a transição de scale (300ms)
    await page.waitForTimeout(400);
    
    const hoverBox = await firstSwatch.boundingBox();
    if (containerBox && hoverBox) {
      // Mesmo com zoom (scale-112), a bolinha não deve ultrapassar os limites visíveis do container que agora tem padding
      // (Ou pelo menos não ser "recortada" abruptamente se o container tiver overflow: hidden)
      // Como adicionamos py-1.5 e min-h, o bounding box do swatch expandido deve estar dentro do container
      expect(hoverBox.y).toBeGreaterThanOrEqual(containerBox.y);
      expect(hoverBox.y + hoverBox.height).toBeLessThanOrEqual(containerBox.y + containerBox.height);
    }

    // 6. Verifica estado SELECIONADO (Ring + Zoom)
    await firstSwatch.click();
    // No nosso componente, o estado selecionado aplica scale-110 (agora var(--swatch-scale-hover)) e z-10
    await expect(firstSwatch).toHaveClass(/scale-/);
    
    const selectedBox = await firstSwatch.boundingBox();
    if (containerBox && selectedBox) {
      expect(selectedBox.y).toBeGreaterThanOrEqual(containerBox.y);
      expect(selectedBox.y + selectedBox.height).toBeLessThanOrEqual(containerBox.y + containerBox.height);
    }
    
    // 7. Snapshot visual (opcional se configurado, mas aqui validamos via bounding boxes por ser mais resiliente no CI)
    // await expect(swatchContainer).toHaveScreenshot('color-swatches-states.png');
  });

  test("valida que o container permite quebra de linha (flex-wrap) em telas estreitas", async ({ page }) => {
    // Configura viewport móvel estreito
    await page.setViewportSize({ width: 320, height: 600 });
    await gotoAndSettle(page, "/produtos");

    const swatchContainer = page.locator(TID("product-colors-container")).first();
    await expect(swatchContainer).toBeVisible();

    // Verifica se o container tem flex-wrap
    await expect(swatchContainer).toHaveCSS('flex-wrap', 'wrap');
    
    // Se houver muitas cores, elas devem ocupar mais de uma linha se necessário
    // (Isso evita que o container suma ou as bolinhas fiquem minúsculas)
    const containerHeight = await swatchContainer.evaluate(el => el.clientHeight);
    const swatchHeight = await swatchContainer.locator('button').first().evaluate(el => el.clientHeight);
    
    // Se wrap estiver funcionando e houver cores suficientes, a altura do container pode crescer
    // mas o padding py-1.5 (aprox 12px total) deve proteger o topo e a base
    expect(containerHeight).toBeGreaterThanOrEqual(swatchHeight);
  });
});
