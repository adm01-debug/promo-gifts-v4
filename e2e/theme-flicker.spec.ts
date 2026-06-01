import { test, expect } from '@playwright/test';

test.describe('Flash de Tema Claro (FOUC) Prevention', () => {
  test('deve ter a classe "dark" no elemento HTML antes mesmo da hidratação', async ({ page }) => {
    // Interrompemos o carregamento do JS para verificar o HTML puro
    await page.route('**/*.{js,ts,tsx}', route => route.abort());
    
    await page.goto('/');
    
    const htmlClass = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass).toContain('dark');
    
    const bodyBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    // rgb(10, 10, 10) é o correspondente para #0a0a0a
    expect(bodyBg).toBe('rgb(10, 10, 10)');
  });

  test('não deve haver botões de alternância de tema na interface', async ({ page }) => {
    await page.goto('/');
    // Aguarda o carregamento inicial (se o JS não estiver bloqueado)
    await page.waitForLoadState('networkidle');
    
    // Verifica se os botões Sun/Moon (que costumam ter esses labels ou títulos) foram removidos
    const themeToggles = page.locator('button:has-text("Modo Claro"), button:has-text("Modo Escuro"), [aria-label*="tema"], [aria-label*="theme"]');
    
    // Filtramos os tooltips que ainda podem ter "tema" no label mas não são botões de troca
    // Na nossa implementação anterior, removemos o botão de toggle do Header e as ações do CommandBar.
    const count = await themeToggles.count();
    for (let i = 0; i < count; i++) {
        const label = await themeToggles.nth(i).getAttribute('aria-label');
        // O botão de "Alternar tamanho do tooltip" ou "Skins" ainda pode existir, mas não deve ser toggle de light/dark
        if (label?.toLowerCase().includes('claro') || label?.toLowerCase().includes('dark')) {
            throw new Error(`Botão de tema encontrado: ${label}`);
        }
    }
  });
});
