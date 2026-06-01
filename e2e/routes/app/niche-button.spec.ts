import { test, expect } from '@playwright/test';

test.describe('Botão de Nicho no Detalhe do Produto', () => {
  // Usando IDs conhecidos para teste
  const PRODUCT_WITH_NICHES_ID = '92411869-ad2b-4115-b12f-9bf6a8aebeb6'; 
  const PRODUCT_WITHOUT_NICHES_ID = 'bea8bd6e-14f4-4482-921d-ecc179391166';

  test('deve estar desabilitado e mostrar tooltip quando não houver nichos', async ({ page }) => {
    await page.goto(`/produto/${PRODUCT_WITHOUT_NICHES_ID}`);
    
    const nicheBtn = page.getByRole('button', { name: 'Nicho' });
    await expect(nicheBtn).toBeDisabled();
    
    const title = await nicheBtn.getAttribute('title');
    expect(title).toBe('Sem dados de nicho para este produto');
  });

  test('deve permitir abrir modal e mostrar nichos quando houver dados', async ({ page }) => {
    await page.goto(`/produto/${PRODUCT_WITH_NICHES_ID}`);
    
    const nicheBtn = page.getByRole('button', { name: 'Nicho' });
    await expect(nicheBtn).toBeEnabled();
    
    await nicheBtn.click();
    
    // Verifica se o modal abriu
    await expect(page.getByText('Nichos / Segmentos')).toBeVisible();
    
    // Verifica se os nichos que adicionamos estão lá
    await expect(page.getByText('Tecnologia')).toBeVisible();
    await expect(page.getByText('RH')).toBeVisible();
    await expect(page.getByText('Educação')).toBeVisible();
  });
});
