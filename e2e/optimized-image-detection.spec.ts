import { test, expect } from '@playwright/test';

/**
 * E2E tests for OptimizedImage detection logic and placeholder generation.
 * Validates Cloudflare imagedelivery.net handling and other CDN providers.
 *
 * TODO(auth): a rota /debug/images está atrás de ProtectedRoute.
 * Para estes testes passarem completamente é necessário:
 *   (A) Usar o project chromium-authed com storageState + secrets E2E_USER_*
 *   (B) Mover a rota para fora do ProtectedRoute no App.tsx
 * Enquanto isso, o workflow usa continue-on-error: true.
 */
test.describe('OptimizedImage Detection & Placeholders', () => {
  // Corrigido: era '/tools/OptimizedImageDemo' (rota inexistente)
  const DEMO_URL = '/debug/images';

  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO_URL);
    await expect(page.getByText('OptimizedImage Demo')).toBeVisible();
  });

  test('should detect Cloudflare images and generate /thumbnail placeholder', async ({ page }) => {
    const cfCard = page.locator('div:has-text("Cloudflare Images Detection")').locator('..').first();
    const container = cfCard.locator('div.relative.overflow-hidden').first();

    await expect(container).toHaveAttribute('data-detection-rule', 'cloudflare');

    const placeholderImg = container.locator('img[aria-hidden="true"]');
    await expect(placeholderImg).toBeVisible();

    const src = await placeholderImg.getAttribute('src');
    expect(src).toContain('/thumbnail');
    expect(src).not.toContain('/public');
  });

  test('should emit console.info only for debug mode or CF detection', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'info' && msg.text().includes('[OptimizedImage]')) {
        logs.push(msg.text());
      }
    });

    await page.reload();
    await expect(page.getByText('OptimizedImage Demo')).toBeVisible();

    // O card Cloudflare tem debug={true} → deve emitir os logs
    expect(logs.some((log) => log.includes('Cloudflare Image detected'))).toBe(true);
    expect(logs.some((log) => log.includes('CF_VARIANT_REPLACEMENT'))).toBe(true);
    expect(logs.some((log) => log.includes('/thumbnail'))).toBe(true);
  });

  test('should handle edge cases for Cloudflare URLs', async ({ page }) => {
    // 3 linhas com data-testid="row-cloudflare" (Padrão, c/ Query, c/ Barra)
    const cfQueryRow = page.locator('tr[data-testid="row-cloudflare"]').nth(1);
    const cfSlashRow = page.locator('tr[data-testid="row-cloudflare"]').nth(2);

    await expect(cfQueryRow).toBeVisible();
    await expect(cfSlashRow).toBeVisible();

    await expect(cfQueryRow.locator('div.relative.overflow-hidden')).toHaveAttribute(
      'data-detection-rule',
      'cloudflare',
    );
    await expect(cfSlashRow.locator('div.relative.overflow-hidden')).toHaveAttribute(
      'data-detection-rule',
      'cloudflare',
    );
  });

  test('should correctly identify other providers', async ({ page }) => {
    await expect(
      page.locator('tr[data-testid="row-unsplash"] div.relative.overflow-hidden'),
    ).toHaveAttribute('data-detection-rule', 'unsplash');
    await expect(
      page.locator('tr[data-testid="row-supabase"] div.relative.overflow-hidden'),
    ).toHaveAttribute('data-detection-rule', 'supabase');
    await expect(
      page.locator('tr[data-testid="row-generic"] div.relative.overflow-hidden'),
    ).toHaveAttribute('data-detection-rule', 'generic');
  });
});
