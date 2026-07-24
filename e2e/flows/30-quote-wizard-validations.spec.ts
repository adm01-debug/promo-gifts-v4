import { test, expect } from "@playwright/test";

test.describe("Novo Orçamento — Validações e Tooltips", () => {
  test.beforeEach(async ({ page }) => {
    // Garantir que estamos logados e na página correta
    await page.goto("/orcamentos/novo");
    await page.waitForLoadState("networkidle");
  });

  test("deve exibir lista de erros de validação quando o formulário está incompleto", async ({ page }) => {
    // 1. Verificar se o resumo mostra que campos estão pendentes
    const validationBox = page.locator("text=Campos obrigatórios pendentes");
    await expect(validationBox).toBeVisible();

    // 2. Verificar itens específicos na lista de erros
    await expect(page.locator("li:has-text('Empresa')")).toBeVisible();
    await expect(page.locator("li:has-text('Contato')")).toBeVisible();
    await expect(page.locator("li:has-text('Forma de Pagamento')")).toBeVisible();
  });

  test("deve exibir tooltip informativo no prazo de entrega", async ({ page }) => {
    // O trigger do tooltip tem o data-testid='delivery-info-tooltip-trigger'
    const tooltipTrigger = page.getByTestId('delivery-info-tooltip-trigger');
    await expect(tooltipTrigger).toBeVisible();

    // Hover para ativar o tooltip
    await tooltipTrigger.hover();

    // Verificar se o conteúdo do tooltip aparece
    const tooltipContent = page.getByTestId('delivery-info-tooltip-content');
    await expect(tooltipContent).toBeVisible();
    await expect(tooltipContent).toContainText("Antes de assumir o compromisso com seu Cliente");
  });

  test("deve validar valor do frete quando modalidade é FOB Pré-negociado", async ({ page }) => {
    // 1. Selecionar Frete FOB Pré-negociado
    const shippingSelect = page.getByTestId('shipping-type-select');
    await shippingSelect.click();
    await page.getByRole('option', { name: /FOB | Valor pré negociado/i }).click();

    // 2. Verificar se o erro "Valor do Frete" aparece na lista de resumo
    await expect(page.locator("li:has-text('Valor do Frete')")).toBeVisible();

    // 3. Preencher o valor e verificar se o erro some
    const shippingInput = page.getByTestId('shipping-cost-input');
    await shippingInput.fill("150,00");
    
    await expect(page.locator("li:has-text('Valor do Frete')")).not.toBeVisible();
  });
});
