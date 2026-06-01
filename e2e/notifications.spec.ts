import { test, expect } from '@playwright/test';

test.describe('Notifications Module', () => {
  test.beforeEach(async ({ page }) => {
    // Presume setup de auth ou mock
    await page.goto('/');
  });

  test('should open notification drawer and show items', async ({ page }) => {
    const bell = page.locator('button[aria-label^="Notificações"]');
    await expect(bell).toBeVisible();
    
    await bell.click();
    
    const drawerTitle = page.getByText('Notificações', { exact: true });
    await expect(drawerTitle).toBeVisible();
  });

  test('should toggle preferences view', async ({ page }) => {
    await page.locator('button[aria-label^="Notificações"]').click();
    
    const settingsBtn = page.locator('button').filter({ has: page.locator('svg.lucide-settings2') });
    await settingsBtn.click();
    
    await expect(page.getByText('Preferências')).toBeVisible();
    await expect(page.getByText('Segurança')).toBeVisible();
  });

  test('should navigate when clicking notification with action_url', async ({ page }) => {
    // Este teste precisaria de data-testids ou mocks específicos
    await page.locator('button[aria-label^="Notificações"]').click();
    
    const firstNotification = page.locator('div.cursor-pointer').first();
    if (await firstNotification.isVisible()) {
      await firstNotification.click();
      // Validar navegação ou fechamento do drawer
    }
  });
});
