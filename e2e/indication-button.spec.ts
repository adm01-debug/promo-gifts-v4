import { test, expect } from '@playwright/test';

test.describe('Botão Indicação - Produto com Tags', () => {
  const PRODUCT_WITH_TAGS_ID = '92411869-ad2b-4115-b12f-9bf6a8aebeb6';

  test('deve abrir o modal e exibir tags agrupadas corretamente', async ({ page }) => {
    // Acessa a página do produto
    await page.goto(`/produto/${PRODUCT_WITH_TAGS_ID}?bypass_auth=true`);

    // Verifica se o botão está habilitado
    const indicationButton = page.getByRole('button', { name: 'Indicação' });
    await expect(indicationButton).toBeEnabled();

    // Clica no botão
    await indicationButton.click();

    // Valida o modal
    await expect(page.getByText('Indicado para')).toBeVisible();
    await expect(page.getByText('Público-alvo e ocasiões recomendadas')).toBeVisible();

    // Valida o agrupamento das tags
    await expect(page.getByText('Público-Alvo', { exact: true })).toBeVisible();
    await expect(page.getByText('Executivos')).toBeVisible();
    await expect(page.getByText('Jovens')).toBeVisible();

    await expect(page.getByText('Datas Comemorativas', { exact: true })).toBeVisible();
    await expect(page.getByText('Natal')).toBeVisible();
    await expect(page.getByText('Dia das Mães')).toBeVisible();

    await expect(page.getByText('Endomarketing', { exact: true })).toBeVisible();
    await expect(page.getByText('Premiação')).toBeVisible();
  });
});

test.describe('Botão Indicação - Produto sem Tags', () => {
  const PRODUCT_WITHOUT_TAGS_ID = 'a1b2c3d4-e5f6-4a5b-b6c7-d8e9f0a1b2c3';

  test('deve estar desabilitado e exibir tooltip correto', async ({ page }) => {
    // Acessa a página do produto
    await page.goto(`/produto/${PRODUCT_WITHOUT_TAGS_ID}?bypass_auth=true`);

    // Verifica se o botão está desabilitado
    const indicationButton = page.getByRole('button', { name: 'Indicação' });
    await expect(indicationButton).toBeDisabled();

    // Verifica o tooltip (title attribute)
    const title = await indicationButton.getAttribute('title');
    expect(title).toBe('Sem dados de indicação para este produto');
  });
});
