import { test, expect } from '@playwright/test';

/**
 * Esse teste verifica se a seção de personalização expande automaticamente
 * ao adicionar um produto, eliminando cliques desnecessários conforme solicitado.
 */
test.describe('Quote Personalization Auto-Expand', () => {
  test('should auto-expand personalization when adding a product', async ({ page }) => {
    // 1. Ir para a página de novo orçamento
    await page.goto('/orcamentos/novo');
    
    // 2. Simular preenchimento do cliente para liberar o wizard se necessário
    // (Em muitos casos o passo de itens está bloqueado até o cliente ser selecionado)
    // Se o app já estiver no passo de itens por rascunho, prossegue.
    
    // Abrir busca de produtos
    const addProductBtn = page.locator('button:has-text("Produto")');
    if (await addProductBtn.isVisible()) {
      await addProductBtn.click();
    } else {
      // Tentar selecionar cliente primeiro se o botão não aparecer
      await page.locator('input[placeholder*="empresa"]').first().fill('Empresa Teste');
      await page.locator('text=Empresa Teste').first().click();
      await page.locator('button:has-text("Próximo")').click(); // Condições
      await page.locator('button:has-text("Próximo")').click(); // Itens
    }
    
    // 3. Pesquisar e adicionar produto
    await page.fill('input[placeholder*="Pesquisar"]', 'Caneta');
    const addButton = page.locator('button:has-text("Adicionar")').first();
    await addButton.click();
    
    // 4. VERIFICAÇÃO CRÍTICA: O botão "Personalização" deve estar com ChevronUp (expandido)
    const personalizationBtn = page.locator('button:has-text("Personalização")');
    await expect(personalizationBtn).toBeVisible();
    
    // Se estiver expandido, o ChevronDown desaparece e o ChevronUp aparece
    const chevronUp = personalizationBtn.locator('svg.lucide-chevron-up');
    await expect(chevronUp).toBeVisible();

    // 5. Verificar se o conteúdo da personalização está visível
    // (Abas de locais: Lado A, Lado B, etc)
    await expect(page.locator('button:has-text("LADO A")').or(page.locator('button:has-text("CIRCULAR")'))).toBeVisible();
  });
});

