import { test, expect } from './fixtures/test-base';
import { loginAs } from './helpers/auth';

test.describe('Regressão Visual - Product Hero', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    // Ir para a home e clicar no primeiro produto para garantir que estamos em uma página de produto
    await page.goto('/');
    // Esperar os produtos carregarem
    await page.waitForSelector('[data-testid="product-card"]', { timeout: 15000 });
    await page.locator('[data-testid="product-card"]').first().click();
    // Esperar o Hero carregar
    await page.waitForSelector('h1[data-testid="product-name"]', { timeout: 10000 });
  });

  test('Hero section layout e cores dos botões', async ({ page }) => {
    const hero = page.locator('.grid.lg\\:grid-cols-\\[minmax\\(0\\,5fr\\)_minmax\\(0\\,7fr\\)\\]');
    await expect(hero).toBeVisible();
    
    // Snapshot básico
    await expect(hero).toHaveScreenshot('product-hero-initial.png', {
      mask: [page.locator('[data-testid="product-name"]')], // Mascarar nome pois pode mudar
    });
  });

  test('Interação nos botões Carrinho e Orçamento', async ({ page }) => {
    // Pegar botões específicos da seção Hero (para evitar conflito com mobile nav se visível)
    const hero = page.locator('.grid.lg\\:grid-cols-\\[minmax\\(0\\,5fr\\)_minmax\\(0\\,7fr\\)\\]');
    const carrinhoBtn = hero.getByRole('button', { name: /carrinho/i });
    const orcamentoBtn = hero.getByRole('button', { name: /orçamento/i });

    // Hover Carrinho
    await carrinhoBtn.hover();
    await page.waitForTimeout(200);
    await expect(carrinhoBtn).toHaveScreenshot('button-carrinho-hover.png');

    // Hover Orçamento
    await orcamentoBtn.hover();
    await page.waitForTimeout(200);
    await expect(orcamentoBtn).toHaveScreenshot('button-orcamento-hover.png');
    
    // Estado Disabled (via JS para teste visual)
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      btns.forEach(btn => {
        if (btn.innerText.includes('Carrinho') || btn.innerText.includes('Orçamento')) {
          btn.setAttribute('disabled', 'true');
        }
      });
    });
    await expect(carrinhoBtn).toHaveScreenshot('button-carrinho-disabled.png');
    await expect(orcamentoBtn).toHaveScreenshot('button-orcamento-disabled.png');
  });

  test('Visualização em Diferentes Skins', async ({ page }) => {
    const skins = ['corporate', 'diversity', 'ocean'];
    const hero = page.locator('.grid.lg\\:grid-cols-\\[minmax\\(0\\,5fr\\)_minmax\\(0\\,7fr\\)\\]');
    
    for (const skin of skins) {
      await page.evaluate((s) => {
        localStorage.setItem('gifts-store-theme-config', JSON.stringify({ presetId: s, radius: 14, mode: 'dark' }));
        window.location.reload();
      }, skin);
      await page.waitForSelector('h1[data-testid="product-name"]', { timeout: 10000 });
      // Pequeno delay para garantir que o preset CSS foi aplicado
      await page.waitForTimeout(500);
      await expect(hero).toHaveScreenshot(`product-hero-skin-${skin}.png`, {
        mask: [page.locator('[data-testid="product-name"]')],
      });
    }
  });
});

test.describe('Regressão Visual - Layout (Header & Breadcrumb)', () => {
  test('Header e Breadcrumb em Desktop - Scroll e Sticky', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/filtros'); // Uma página que tem breadcrumb e conteúdo longo
    
    const header = page.locator('[data-testid="app-header"]');
    const breadcrumb = page.locator('[data-testid="breadcrumb-bar"]');
    
    // Esperar header carregar
    await expect(header).toBeVisible();
    
    // Estado Inicial (Header 56px)
    await expect(header).toHaveScreenshot('header-desktop-initial.png');
    await expect(breadcrumb).toHaveScreenshot('breadcrumb-desktop-initial.png');
    
    // Scroll para baixo
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(500); // Esperar transição
    
    // Header deve estar compactado (48px) e breadcrumb sticky
    await expect(header).toHaveScreenshot('header-desktop-scrolled.png');
    await expect(breadcrumb).toHaveScreenshot('breadcrumb-desktop-scrolled.png');
    
    // Verificar se breadcrumb está abaixo do header
    const headerBox = await header.boundingBox();
    const breadcrumbBox = await breadcrumb.boundingBox();
    if (headerBox && breadcrumbBox) {
      // O breadcrumb deve estar exatamente no top: headerHeight
      expect(breadcrumbBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1);
    }
  });

  test('Layout em Mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/filtros');
    
    const header = page.locator('[data-testid="app-header"]');
    await expect(header).toBeVisible();
    await expect(header).toHaveScreenshot('header-mobile.png');
    
    // Breadcrumb deve estar visível no mobile também
    const breadcrumb = page.locator('[data-testid="breadcrumb-bar"]');
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb).toHaveScreenshot('breadcrumb-mobile.png');
  });

  test('Breadcrumb oculto na Home', async ({ page }) => {
    await page.goto('/');
    const breadcrumb = page.locator('[data-testid="breadcrumb-bar"]');
    await expect(breadcrumb).toBeHidden();
  });
});

