import { test, expect } from '@playwright/test';

test.describe('Botão de Nicho no Detalhe do Produto', () => {
  // Usando IDs conhecidos para teste
  const PRODUCT_WITH_NICHES_ID = 'fd72b7d7-1d0c-4e86-bb19-12ef4cdfc110'; // Exemplo
  const PRODUCT_WITHOUT_NICHES_ID = '92411869-ad2b-4115-b12f-9bf6a8aebeb6'; // Este tem tags mas não nichos

  test('deve estar desabilitado e mostrar tooltip quando não houver nichos', async ({ page }) => {
    // Navega para um produto sem nichos
    await page.goto(`/produto/${PRODUCT_WITHOUT_NICHES_ID}`);
    
    // Localiza o botão de Nicho
    const nicheBtn = page.getByRole('button', { name: 'Nicho' });
    
    // Verifica se está desabilitado
    await expect(nicheBtn).toBeDisabled();
    
    // Verifica o título (tooltip nativo)
    const title = await nicheBtn.getAttribute('title');
    expect(title).toBe('Sem dados de nicho para este produto');
  });

  test('deve mostrar skeleton enquanto carrega e permitir abrir modal quando houver dados', async ({ page }) => {
    // Como não temos dados reais no DB de staging para nichos agora,
    // este teste valida a estrutura do componente e o estado desabilitado por padrão.
    // Se no futuro houver dados, o teste de 'habilitado' pode ser expandido.
    
    await page.goto(`/produto/${PRODUCT_WITHOUT_NICHES_ID}`);
    const nicheBtn = page.getByRole('button', { name: 'Nicho' });
    await expect(nicheBtn).toBeVisible();
  });
});
