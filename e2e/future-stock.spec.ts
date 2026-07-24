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
              { id: "var-red-1", color: { name: "Vermelho", hex: "#FF0000" }, stock: 20, sku: "SKU-RED-1" },
              { id: "var-green-1", color: { name: "Verde", hex: "#00FF00" }, stock: 10, sku: "SKU-GREEN-1" }
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
                    // Arrival 2 (June) is SOONER than Arrival 1 (Dec), should be reordered in UI
                    next_date_1: "2026-12-31", 
                    next_quantity_1: 1000,
                    next_date_2: "2026-06-01", 
                    next_quantity_2: 500,
                    next_date_3: "2027-01-15", 
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
              },
              {
                id: "var-green-1",
                product_id: productId,
                sku: "SKU-GREEN-1",
                color_name: "Verde",
                color_hex: "#00FF00",
                stock_quantity: 10,
                variant_supplier_sources: [
                  {
                    // Partial combination: only next_date_2 is set
                    next_date_1: null,
                    next_quantity_1: null,
                    next_date_2: "2026-05-15",
                    next_quantity_2: 450,
                    next_date_3: null,
                    next_quantity_3: 0
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

    const openButton = page.getByRole('button', { name: /Estoque Futuro/i });
    await openButton.click();

    await expect(page.getByText('Estoque Futuro', { exact: true }).first()).toBeVisible();

    const blueHeader = page.getByRole('button', { name: /^Azul/ });
    await blueHeader.click();

    const blueSection = page.locator('.rounded-2xl').filter({ hasText: /^Azul/ });
    const timelineItems = blueSection.locator('.relative.flex.gap-4');
    await expect(timelineItems).toHaveCount(3);

    // Verificar ordem cronológica (Junho < Dezembro < Janeiro)
    // O UI usa formato "dd de MMM" (ex: 01 de jun)
    await expect(timelineItems.nth(0)).toContainText(/01 de jun/i);
    await expect(timelineItems.nth(1)).toContainText(/31 de dez/i);
    await expect(timelineItems.nth(2)).toContainText(/15 de jan/i);

    // Verificar que pares inválidos no Vermelho foram ignorados (apenas 1 válido)
    const redHeader = page.getByRole('button', { name: /^Vermelho/ });
    await redHeader.click(); 
    const redSection = page.locator('.rounded-2xl').filter({ hasText: /^Vermelho/ });
    const redTimelineItems = redSection.locator('.relative.flex.gap-4');
    await expect(redTimelineItems).toHaveCount(1);
    await expect(redTimelineItems).toContainText(/10 de jul/i);
    await expect(redTimelineItems).toContainText('300');
  });

  test("deve validar combinações parciais de campos (apenas next_date_2/3)", async ({ page }) => {
    await gotoAndSettle(page, `/produto/${productId}`);
    await page.getByRole('button', { name: /Estoque Futuro/i }).click();

    const greenHeader = page.getByRole('button', { name: /^Verde/ });
    await greenHeader.click();
    
    const greenSection = page.locator('.rounded-2xl').filter({ hasText: /^Verde/ });
    const greenTimelineItems = greenSection.locator('.relative.flex.gap-4');
    
    // Deve mostrar 1 entrada mesmo sendo do "index 2"
    await expect(greenTimelineItems).toHaveCount(1);
    await expect(greenTimelineItems).toContainText(/15 de mai/i);
    await expect(greenTimelineItems).toContainText('450');
  });

  test("deve alternar colapso/expansão ao clicar nos headers", async ({ page }) => {
    await gotoAndSettle(page, `/produto/${productId}`);
    await page.getByRole('button', { name: /Estoque Futuro/i }).click();

    const blueHeader = page.getByRole('button', { name: /^Azul/ });
    const blueContent = page.getByText('SKU-BLUE-1').first();

    // Expandir
    await blueHeader.click();
    await expect(blueContent).toBeVisible();

    // Colapsar
    await blueHeader.click();
    await expect(blueContent).not.toBeVisible();
  });
});
