import { test, expect } from '@playwright/test';

test.describe('Auth Legal Pages', () => {
  test('should render Terms of Use page with correct styling and back link @mobile', async ({ page }) => {
    await page.goto('/termos');
    
    // Check page title
    await expect(page.getByTestId('page-title-termos')).toBeVisible();
    await expect(page.getByTestId('page-title-termos')).toHaveText('Termos de Uso');
    
    // Check background color (should be the dark background)
    const main = page.locator('main');
    await expect(main).toHaveCSS('background-color', 'rgb(3, 5, 8)');
    
    // Check text color for legibility (should be light/white)
    const title = page.getByTestId('page-title-termos');
    await expect(title).toHaveCSS('color', 'rgb(255, 255, 255)');
    
    // Check back link
    const backLink = page.getByTestId('terms-back-link');
    await expect(backLink).toBeVisible();
    await backLink.click();
    await expect(page).toHaveURL(/\/auth/);
  });

  test('should render Privacy Policy page with correct styling and back link @mobile', async ({ page }) => {
    await page.goto('/privacidade');
    
    // Check page title
    await expect(page.getByTestId('page-title-privacidade')).toBeVisible();
    await expect(page.getByTestId('page-title-privacidade')).toHaveText('Política de Privacidade');
    
    // Check background color
    const main = page.locator('main');
    await expect(main).toHaveCSS('background-color', 'rgb(3, 5, 8)');
    
    // Check text color
    const title = page.getByTestId('page-title-privacidade');
    await expect(title).toHaveCSS('color', 'rgb(255, 255, 255)');
    
    // Check back link
    const backLink = page.getByTestId('privacy-back-link');
    await expect(backLink).toBeVisible();
    await backLink.click();
    await expect(page).toHaveURL(/\/auth/);
  });

  test('should have accessible links in LegalFooter on login page @mobile', async ({ page }) => {
    await page.goto('/auth');
    
    const termsLink = page.getByRole('link', { name: 'Termos de Uso' });
    const privacyLink = page.getByRole('link', { name: 'Política de Privacidade' });
    
    await expect(termsLink).toBeVisible();
    await expect(privacyLink).toBeVisible();
    
    // Check focus state (simplified check: it should be focusable)
    await termsLink.focus();
    await expect(termsLink).toBeFocused();
    
    await privacyLink.focus();
    await expect(privacyLink).toBeFocused();
  });
});
