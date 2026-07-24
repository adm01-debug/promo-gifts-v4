import { test, expect } from '@playwright/test';

test.describe('Botão de Indicação no Detalhe do Produto', () => {
  const PRODUCT_WITH_TAGS_ID = '92411869-ad2b-4115-b12f-9bf6a8aebeb6';
  const PRODUCT_WITHOUT_TAGS_ID = 'bea8bd6e-14f4-4482-921d-ecc179391166';

  test('deve estar desabilitado quando não houver tags', async ({ page }) => {
    await page.goto(`/produto/${PRODUCT_WITHOUT_TAGS_ID}`);
    const indBtn = page.getByRole('button', { name: 'Indicação' });
    await expect(indBtn).toBeDisabled();
  });

  test('deve abrir modal e mostrar categorias quando houver tags', async ({ page }) => {
    await page.goto(`/produto/${PRODUCT_WITH_TAGS_ID}`);
    const indBtn = page.getByRole('button', { name: 'Indicação' });
    await expect(indBtn).toBeEnabled();
    
    await indBtn.click();
    
    await expect(page.getByText('Indicado para')).toBeVisible();
    await expect(page.getByText('Datas Comemorativas')).toBeVisible();
    await expect(page.getByText('Natal')).toBeVisible();
  });
});
