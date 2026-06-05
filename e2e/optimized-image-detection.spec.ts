import { test, expect } from '@playwright/test';
import { gotoAndSettle } from './helpers/nav';

/**
 * E2E tests for OptimizedImage detection logic and placeholder generation.
 * Validates Cloudflare imagedelivery.net handling and other CDN providers.
 *
 * A rota /debug/images é pública (sem ProtectedRoute) em todos os ambientes.
 * Executa no project chromium-public (chromium, sem auth).
 */
test.describe('OptimizedImage Detection & Placeholders', () => {
  const DEMO_URL = '/debug/images';

  test.beforeEach(async ({ page }) => {
    await gotoAndSettle(page, DEMO_URL);
    await expect(page.getByText('OptimizedImage Demo')).toBeVisible();
  });

  test('should detect Cloudflare images and generate /thumbnail placeholder', async ({ page }) => {
    // The "Cloudflare CDN" demo card renders an OptimizedImage whose root div
    // carries data-detection-rule. Scope to it via the card image's unique alt
    // ("Cloudflare CDN Demo") — the demo wrapper div is also relative/overflow-hidden,
    // so a positional `.first()` on div.relative.overflow-hidden is ambiguous.
    const container = page
      .locator('[data-detection-rule]')
      .filter({ has: page.locator('img[alt="Cloudflare CDN Demo"]') })
      .first();

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

    await gotoAndSettle(page, DEMO_URL);
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
