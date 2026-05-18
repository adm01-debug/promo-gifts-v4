import { test, expect } from '@playwright/test';

test.describe('Company Search Dropdown - History & Prioritization', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page that uses CompanySearchDropdown (e.g., Quote Builder Step 1)
    await page.goto('/quotes/new');
    
    // Ensure we are on Step 1
    await expect(page.getByText('CLIENTE')).toBeVisible();
    
    // Clear localStorage to start fresh
    await page.evaluate(() => localStorage.clear());
  });

  test('should add companies to history and prioritize them in search', async ({ page }) => {
    const input = page.getByTestId('company-search-input');
    
    // 1. Search and select a company to add to history
    await input.click();
    await input.fill('Alpha');
    
    // Wait for results
    const option = page.getByTestId(/company-option-/).first();
    const companyName = await option.textContent();
    await option.click();
    
    // 2. Clear selection and check history
    await page.getByTestId('clear-company-button').click();
    await input.click();
    
    // Should see "Pesquisas recentes"
    await expect(page.getByTestId('search-history-section')).toBeVisible();
    const historyItem = page.getByTestId(/history-item-/).first();
    await expect(historyItem).toContainText(companyName?.replace('AL', '').trim().split('\n')[0] || '');

    // 3. Search again and check prioritization
    await input.fill('Alpha');
    // History match should be first in results list (after "Sem empresa")
    const firstResult = page.getByTestId(/company-option-/).first();
    await expect(firstResult).toContainText(companyName?.replace('AL', '').trim().split('\n')[0] || '');
  });

  test('should maintain highlighted state and history during loading', async ({ page }) => {
    const input = page.getByTestId('company-search-input');
    
    // 1. Add item to history
    await input.click();
    await input.fill('Alpha');
    const option = page.getByTestId(/company-option-/).first();
    const companyId = await option.getAttribute('data-testid').then(id => id?.replace('company-option-', ''));
    await option.click();
    
    // 2. Re-open dropdown with company selected
    await input.click();
    
    // Check highlight in history
    const historyItem = page.getByTestId(`history-item-${companyId}`);
    await expect(historyItem).toHaveClass(/bg-primary\/10/);
    
    // 3. Type to trigger search
    await input.fill('NonExistentTermThatTriggersLoading');
    
    // Even if loading, if we clear or type back a matching term, highlight should persist
    await input.fill('Alpha');
    const searchMatch = page.getByTestId(`company-option-${companyId}`);
    await expect(searchMatch).toHaveClass(/bg-primary\/10/);
  });

  test('should handle CNPJ search with masks, spaces and invalid characters', async ({ page }) => {
    const input = page.getByTestId('company-search-input');
    
    // 1. Find a company with CNPJ and add to history
    await input.click();
    await input.fill('00'); // Common CNPJ start
    const option = page.getByTestId(/company-option-/).first();
    const cnpjFull = await option.locator('span').last().textContent();
    const companyId = await option.getAttribute('data-testid').then(id => id?.replace('company-option-', ''));
    await option.click();
    await page.getByTestId('clear-company-button').click();
    
    // 2. Search with spaces and invalid chars
    await input.click();
    await input.fill(cnpjFull + '  abc!@#');
    
    // Should still find the company in history group/prioritized
    const match = page.getByTestId(`company-option-${companyId}`);
    await expect(match).toBeVisible();
    
    // 3. Search with incomplete mask
    const partialCnpj = cnpjFull?.substring(0, 5) || '';
    await input.fill(partialCnpj);
    await expect(page.getByTestId(`company-option-${companyId}`)).toBeVisible();
  });

  test('should prioritize most recent items when multiple history matches exist', async ({ page }) => {
    const input = page.getByTestId('company-search-input');
    
    // 1. Add Company A to history
    await input.click();
    await input.fill('Alpha');
    const optionA = page.getByTestId(/company-option-/).first();
    const nameA = (await optionA.textContent())?.replace('AL', '').trim().split('\n')[0];
    await optionA.click();
    await page.getByTestId('clear-company-button').click();
    
    // 2. Add Company B to history (now B is more recent)
    await input.click();
    await input.fill('Beta');
    const optionB = page.getByTestId(/company-option-/).first();
    const nameB = (await optionB.textContent())?.replace('BE', '').trim().split('\n')[0];
    await optionB.click();
    await page.getByTestId('clear-company-button').click();
    
    // 3. Check history order (most recent first)
    await input.click();
    const historyItems = page.getByTestId(/history-item-/);
    await expect(historyItems.first()).toContainText(nameB || '');
    await expect(historyItems.nth(1)).toContainText(nameA || '');
  });

  test('should return to default state and maintain highlight after clearing search', async ({ page }) => {
    const input = page.getByTestId('company-search-input');
    
    // 1. Select a company
    await input.click();
    await input.fill('Alpha');
    const option = page.getByTestId(/company-option-/).first();
    const companyId = await option.getAttribute('data-testid').then(id => id?.replace('company-option-', ''));
    await option.click();
    
    // 2. Search for something else and clear
    await input.click();
    await input.fill('XYZ');
    await expect(page.getByTestId(`history-item-${companyId}`)).not.toBeVisible();
    
    // Clear via keyboard
    await input.fill('');
    
    // Should see history again and it should be highlighted
    const historyItem = page.getByTestId(`history-item-${companyId}`);
    await expect(historyItem).toBeVisible();
    await expect(historyItem).toHaveClass(/bg-primary\/10/);
  });

  test('should call onSelectCompany correctly when selecting from history', async ({ page }) => {
    const input = page.getByTestId('company-search-input');
    
    // 1. Add to history
    await input.click();
    await input.fill('Alpha');
    const option = page.getByTestId(/company-option-/).first();
    const name = (await option.textContent())?.replace('AL', '').trim().split('\n')[0];
    await option.click();
    await page.getByTestId('clear-company-button').click();
    
    // 2. Select from history
    await input.click();
    await page.getByTestId(/history-item-/).first().click();
    
    // 3. Verify selection UI
    await expect(page.getByTestId('selected-company-card')).toBeVisible();
    await expect(page.getByTestId('selected-company-card')).toContainText(name || '');
  });
});