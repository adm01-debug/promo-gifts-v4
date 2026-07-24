/**
 * E2E: Mockup Generation — Smoke
 */
import { test, expect } from '@playwright/test';

const AUTH_URL_RE = /\/auth(\?|#|$)/;

test.describe('Mockup Generator', () => {
  test('mockup studio requires auth', async ({ page }) => {
    await page.goto('/mockup-generator');
    await page.waitForURL(AUTH_URL_RE, { timeout: 10000 });
    await expect(page).toHaveURL(AUTH_URL_RE);
  });

  test('magic up requires auth', async ({ page }) => {
    await page.goto('/magic-up');
    await page.waitForURL(AUTH_URL_RE, { timeout: 10000 });
    await expect(page).toHaveURL(AUTH_URL_RE);
  });
});
