import { test, expect } from '@playwright/test';

test.describe('Company Search Dropdown - History & Prioritization', () => {
  test.beforeEach(async ({ page }) => {
    // Clear local storage to start fresh
    await page.goto('/orcamentos/novo');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.getByTestId('page-title-orcamento-novo')).toBeVisible();
  });

  test('should add companies to history and prioritize them in search', async ({ page }) => {
    const searchInput = page.getByTestId('company-search-input');
    
    // 1. Search and select first company
    await searchInput.fill('Promo');
    const company1 = page.locator('[data-testid^="company-option-"]').first();
    await company1.waitFor({ state: 'visible' });
    const company1Name = await company1.locator('span.font-medium').innerText();
    const company1Id = (await company1.getAttribute('data-testid'))?.replace('company-option-', '');
    await company1.click();

    // 2. Clear and search second company
    await page.locator('.cursor-pointer.group').click(); // Click to clear/reopen
    await searchInput.waitFor({ state: 'visible' });
    await searchInput.fill('Log');
    const company2 = page.locator('[data-testid^="company-option-"]').first();
    await company2.waitFor({ state: 'visible' });
    const company2Name = await company2.locator('span.font-medium').innerText();
    const company2Id = (await company2.getAttribute('data-testid'))?.replace('company-option-', '');
    await company2.click();

    // 3. Verify history section is visible when opening empty search
    await page.locator('.cursor-pointer.group').click();
    await searchInput.waitFor({ state: 'visible' });
    await expect(page.getByTestId('search-history-section')).toBeVisible();
    
    // Check if both companies are in history
    await expect(page.getByTestId(`history-item-${company1Id}`)).toBeVisible();
    await expect(page.getByTestId(`history-item-${company2Id}`)).toBeVisible();

    // 4. Test prioritization: search for a term that matches history
    // We'll search for 'Promo' which should be in history
    await searchInput.fill('Promo');
    
    // History items should be filtered and shown (prioritized in the list)
    // In our implementation, we merge history matches at the top
    const firstResult = page.locator('[data-testid^="company-option-"], [data-testid^="history-item-"]').first();
    await expect(firstResult).toContainText('Promo');
  });

  test('should prioritize history when searching by CNPJ', async ({ page }) => {
    const searchInput = page.getByTestId('company-search-input');
    
    // 1. Search and select a company with a specific CNPJ
    await searchInput.fill('Promo');
    const company = page.locator('[data-testid^="company-option-"]').first();
    await company.waitFor({ state: 'visible' });
    const cnpj = await company.locator('span.font-mono').innerText();
    const companyId = (await company.getAttribute('data-testid'))?.replace('company-option-', '');
    await company.click();

    // 2. Re-open and search only by CNPJ
    await page.locator('.cursor-pointer.group').click();
    await searchInput.waitFor({ state: 'visible' });
    await searchInput.fill(cnpj);
    
    // 3. Verify history item is visible and prioritized
    const historyItem = page.getByTestId(`history-item-${companyId}`);
    await expect(historyItem).toBeVisible();
    await expect(historyItem).toContainText(cnpj);
    
    // Check it's the first result after "Sem empresa"
    const firstResult = page.locator('[data-testid="no-company-option"] + div, [data-testid^="history-item-"]').first();
    await expect(firstResult).toContainText(cnpj);
  });

  test('should maintain highlighted state when clearing search or re-opening', async ({ page }) => {
    const searchInput = page.getByTestId('company-search-input');

    // 1. Select a company
    await searchInput.fill('Promo');
    const company1 = page.locator('[data-testid^="company-option-"]').first();
    await company1.waitFor({ state: 'visible' });
    const company1Id = (await company1.getAttribute('data-testid'))?.replace('company-option-', '');
    await company1.click();

    // 2. Re-open and check highlight
    await page.locator('.cursor-pointer.group').click();
    await searchInput.waitFor({ state: 'visible' });
    
    // The selected company should be highlighted in the history section (if it's there)
    const historyItem = page.getByTestId(`history-item-${company1Id}`);
    await expect(historyItem).toHaveClass(/bg-primary\/10/);
    await expect(historyItem).toHaveClass(/border-l-primary/);

    // 3. Search something else, then clear it, and check highlight again
    await searchInput.fill('XYZ Non Existent');
    await expect(page.getByText('Nenhuma empresa encontrada')).toBeVisible();
    
    await searchInput.fill('');
    // History should reappear and highlight should persist
    await expect(historyItem).toBeVisible();
    await expect(historyItem).toHaveClass(/bg-primary\/10/);
  });

  test('should allow removing individual items and clearing all history', async ({ page }) => {
    const searchInput = page.getByTestId('company-search-input');

    // 1. Add some history
    await searchInput.fill('Promo');
    const c1 = page.locator('[data-testid^="company-option-"]').first();
    await c1.waitFor({ state: 'visible' });
    const c1Id = (await c1.getAttribute('data-testid'))?.replace('company-option-', '');
    await c1.click();

    await page.locator('.cursor-pointer.group').click();
    await searchInput.fill('Log');
    const c2 = page.locator('[data-testid^="company-option-"]').first();
    await c2.waitFor({ state: 'visible' });
    const c2Id = (await c2.getAttribute('data-testid'))?.replace('company-option-', '');
    await c2.click();

    // 2. Open and remove one
    await page.locator('.cursor-pointer.group').click();
    await expect(page.getByTestId(`history-item-${c1Id}`)).toBeVisible();
    await expect(page.getByTestId(`history-item-${c2Id}`)).toBeVisible();

    await page.getByLabel(`Remover ${await page.locator(`[data-testid="history-item-${c1Id}"] span.font-medium`).innerText()} do histórico`).click();
    await expect(page.getByTestId(`history-item-${c1Id}`)).not.toBeVisible();
    await expect(page.getByTestId(`history-item-${c2Id}`)).toBeVisible();

    // 3. Clear all
    await page.getByTestId('clear-history-button').click();
    await expect(page.getByTestId('search-history-section')).not.toBeVisible();
  });
});
