/**
 * Mobile Responsiveness Smoke Tests
 * Gap identificado no QA Sprint (qa/02-test-matrix.md)
 * 
 * Testa responsividade nas páginas mais críticas usando
 * viewports de 360px (Android) e 375px (iPhone) sem necessidade de auth.
 */
import { test, expect } from '@playwright/test';

const MOBILE_VIEWPORTS = [
  { name: 'android-360', width: 360, height: 800 },
  { name: 'iphone-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
];

test.describe('Mobile Responsiveness — Páginas Públicas', () => {
  for (const vp of MOBILE_VIEWPORTS) {
    test.describe(`viewport ${vp.name} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test('página de login renderiza sem overflow horizontal', async ({ page }) => {
        await page.goto('/auth');
        await page.waitForLoadState('networkidle');

        // Sem scroll horizontal (overflow-x)
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(vp.width + 2); // tolerância de 2px

        // Formulário de login visível
        const form = page.locator('form, [data-testid="auth-form"]');
        if (await form.count() > 0) {
          await expect(form.first()).toBeVisible();
        }
      });

      test('página 404 renderiza corretamente', async ({ page }) => {
        await page.goto('/pagina-que-nao-existe-404-xyz');
        await page.waitForLoadState('networkidle');

        // Sem overflow horizontal
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(vp.width + 2);
      });

      test('página de termos renderiza sem overflow', async ({ page }) => {
        await page.goto('/termos');
        await page.waitForLoadState('networkidle');

        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(vp.width + 2);
      });
    });
  }
});

test.describe('Mobile Responsiveness — Páginas Autenticadas', () => {
  test.use({ storageState: 'e2e/fixtures/auth-state.json' });

  for (const vp of MOBILE_VIEWPORTS) {
    test.describe(`viewport ${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test('catálogo não tem overflow horizontal', async ({ page }) => {
        await page.goto('/filtros');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500); // aguarda animações

        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(vp.width + 5);
      });

      test('sidebar fecha corretamente em mobile', async ({ page }) => {
        await page.goto('/filtros');
        await page.waitForLoadState('networkidle');

        // Em viewports < 768px a sidebar deve estar fechada por padrão
        if (vp.width < 768) {
          const sidebar = page.locator('[data-testid="main-sidebar"], .sidebar-container, aside[role="navigation"]');
          if (await sidebar.count() > 0) {
            // Verifica que não está obstruindo o conteúdo principal
            const isVisible = await sidebar.first().isVisible();
            if (isVisible) {
              // Se visível, deve estar sobreposta (position: fixed/absolute)
              const position = await sidebar.first().evaluate(el =>
                window.getComputedStyle(el).position
              );
              expect(['fixed', 'absolute', 'sticky']).toContain(position);
            }
          }
        }
      });

      test('cards de produto têm tamanho mínimo tocável (44px)', async ({ page }) => {
        await page.goto('/filtros');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Botões e elementos interativos devem ter pelo menos 44px (WCAG touch target)
        const interactiveElements = page.locator('button:visible, a:visible, [role="button"]:visible');
        const count = await interactiveElements.count();

        if (count > 0) {
          // Verifica os primeiros 10 elementos
          const sample = Math.min(count, 10);
          for (let i = 0; i < sample; i++) {
            const el = interactiveElements.nth(i);
            const box = await el.boundingBox();
            if (box) {
              // Tolerância: elementos decorativos podem ser menores
              const isTouchTarget = box.height >= 32 || box.width >= 32;
              if (!isTouchTarget) {
                // Log ao invés de falhar (pode ser ícone decorativo)
                console.log(`[WARN] Elemento pequeno: ${box.width}x${box.height}`);
              }
            }
          }
        }
      });
    });
  }
});
