import { test, expect } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";
import { loginAs } from "./helpers/auth";

test.describe("Future Stock Modal (Estoque Futuro)", () => {
  const productId = "bea8bd6e-14f4-4482-921d-ecc179391166";
  const productName = "Produto Teste E2E";
  const productSku = "SKU-E2E-123";

  test.beforeEach(async ({ page }) => {
    // Mock user login
    await loginAs(page);

    // Mock Product Data
    await page.route(`**/rest/v1/products?id=eq.${productId}*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: productId,
            name: productName,
            sku: productSku,
            price: 10.5,
            stockStatus: "in-stock",
            stock: 100,
            images: ["/placeholder.svg"],
            supplier: { id: "supp-1", name: "Fornecedor Teste" },
            variations: [
              { id: "var-blue-1", color: { name: "Azul", hex: "#0000FF" }, stock: 50, sku: "SKU-BLUE-1" },
              { id: "var-red-1", color: { name: "Vermelho", hex: "#FF0000" }, stock: 20, sku: "SKU-RED-1" }
            ]
          }
        ])
      });
    });

    // Mock External DB (Variant Supplier Sources)
    await page.route("**/functions/v1/external-db", async (route) => {
      const body = route.request().postDataJSON();
      
      if (body?.table === 'product_variants' && body?.filters?.product_id === productId) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            records: [
              {
                id: "var-blue-1",
                product_id: productId,
                sku: "SKU-BLUE-1",
                color_name: "Azul",
                color_hex: "#0000FF",
                stock_quantity: 50,
                variant_supplier_sources: [
                  {
                    // Arrival 2 is SOONER than Arrival 1 in terms of date, should be reordered in UI
                    next_date_1: "2026-12-31", // Arrival 1: Dec 31
                    next_quantity_1: 1000,
                    next_date_2: "2026-06-01", // Arrival 2: June 1 (Should come first)
                    next_quantity_2: 500,
                    next_date_3: "2027-01-15", // Arrival 3: Jan 15
                    next_quantity_3: 2000
                  }
                ]
              },
              {
                id: "var-red-1",
                product_id: productId,
                sku: "SKU-RED-1",
                color_name: "Vermelho",
                color_hex: "#FF0000",
                stock_quantity: 20,
                variant_supplier_sources: [
                  {
                    next_date_1: "2026-07-10",
                    next_quantity_1: 300,
                    next_date_2: null, // Should be ignored
                    next_quantity_2: 500,
                    next_date_3: "2026-08-20",
                    next_quantity_3: 0 // Should be ignored
                  }
                ]
              }
            ]
          })
        });
      } else {
        await route.continue();
      }
    });
  });

  test("deve exibir a timeline com ordenação cronológica e ignorar entradas inválidas", async ({ page }) => {
    await gotoAndSettle(page, `/produto/${productId}`);

    // Abrir modal de estoque futuro
    const openButton = page.getByRole('button', { name: /Estoque Futuro/i });
    await openButton.click();

    // Verificar se o modal abriu
    await expect(page.getByText('Estoque Futuro', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(productName)).toBeVisible();

    // Verificar timeline da variante Azul (deve ter 3 entradas ordenadas)
    // Ordenação esperada: Jun 1, 2026 -> Dec 31, 2026 -> Jan 15, 2027
    const blueSection = page.locator('div').filter({ hasText: /^Azul/ }).first();
    await expect(blueSection).toBeVisible();

    const timelineItems = blueSection.locator('.relative.flex.gap-4');
    await expect(timelineItems).toHaveCount(3);

    // Verificar datas na ordem (assumindo formato DD/MM/YYYY ou similar no UI)
    // A lógica de ordenação cronológica foi implementada no modal
    await expect(timelineItems.nth(0)).toContainText('01/06/2026');
    await expect(timelineItems.nth(0)).toContainText('500');

    await expect(timelineItems.nth(1)).toContainText('31/12/2026');
    await expect(timelineItems.nth(1)).toContainText('1.000');

    await expect(timelineItems.nth(2)).toContainText('15/01/2027');
    await expect(timelineItems.nth(2)).toContainText('2.000');

    // Verificar timeline da variante Vermelha (deve ter apenas 1 entrada válida)
    // Ignorou: null date e zero quantity
    const redSection = page.locator('div').filter({ hasText: /^Vermelho/ }).first();
    await expect(redSection).toBeVisible();
    const redTimelineItems = redSection.locator('.relative.flex.gap-4');
    await expect(redTimelineItems).toHaveCount(1);
    await expect(redTimelineItems).toContainText('10/07/2026');
    await expect(redTimelineItems).toContainText('300');
  });

  test("deve respeitar o comportamento de colapso/expandir por grupo de cor", async ({ page }) => {
    await gotoAndSettle(page, `/produto/${productId}`);
    await page.getByRole('button', { name: /Estoque Futuro/i }).click();

    // Por padrão, grupos podem estar colapsados ou expandidos dependendo da lógica (ex: selectedColor)
    // Vamos testar o toggle manual
    const blueHeader = page.getByRole('button', { name: /^Azul/ });
    const redHeader = page.getByRole('button', { name: /^Vermelho/ });

    // Clicar para colapsar Azul se estiver aberto, ou expandir se fechado
    // Como implementamos o sistema de expandedGroups no modal
    
    // Vamos verificar se o conteúdo está visível
    const blueContent = page.locator('div').filter({ hasText: 'SKU-BLUE-1' }).last();
    const redContent = page.locator('div').filter({ hasText: 'SKU-RED-1' }).last();

    // Inicialmente, ambos devem estar visíveis se expandedGroups começou vazio mas a lógica de fallback ou ordenação os abriu
    // No código: const isExpanded = expandedGroups.includes(colorName) || selectedColor === colorName;
    // Se expandedGroups estiver vazio e selectedColor null, eles podem estar fechados.
    
    // Vamos garantir que clicamos para expandir/colapsar e verificar a mudança
    await blueHeader.click();
    // Se estava fechado, agora SKU-BLUE-1 deve estar visível. Se estava aberto, deve sumir.
    // Vamos forçar um estado conhecido clicando.
    
    // Verificar se ao clicar no grid de cores (filtro), ele expande automaticamente
    const blueFilterButton = page.locator('button[title^="Azul"]');
    await blueFilterButton.click();
    
    await expect(blueContent).toBeVisible();
    
    // O vermelho deve estar colapsado se não for a cor selecionada e não estiver em expandedGroups
    // Mas no modal, se não houver filtro, talvez todos apareçam.
    // O requisito diz "Implementar um colapso/expandir por grupo de cor no modal"
    
    await blueHeader.click(); // Colapsar azul
    await expect(blueContent).not.toBeVisible();
    
    await redHeader.click(); // Expandir vermelho
    await expect(redContent).toBeVisible();
  });
});
