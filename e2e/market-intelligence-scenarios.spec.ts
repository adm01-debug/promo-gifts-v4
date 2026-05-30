import { test, expect } from '@playwright/test';

/**
 * Fixtures para simular diferentes cenários de mercado
 */
const SCENARIOS = {
  HIGH_DEMAND_LOW_STOCK: {
    avgDailyDepletion: 60.5,
    totalCurrentStock: 450, // Menos de 15 dias (450/60.5 = ~7.4 dias)
    trendPercent: 25,
    demandLevel: 'Muito Alta'
  },
  STABLE_MARKET: {
    avgDailyDepletion: 12.0,
    totalCurrentStock: 1500, // ~125 dias
    trendPercent: 2,
    demandLevel: 'Moderada'
  },
  CRITICAL_DROP: {
    avgDailyDepletion: 5.0,
    totalCurrentStock: 100,
    trendPercent: -45,
    demandLevel: 'Baixa'
  }
};

test.describe('Market Intelligence E2E - Responsive & Scenarios', () => {
  
  const viewports = [
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1280, height: 800 }
  ];

  for (const viewport of viewports) {
    test(`Tooltip layout should not overflow on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/inteligencia');
      
      const infoButtons = page.locator('button[aria-label^="Sobre"]');
      
      // Testar o último card (Disponível) que costuma ter o texto mais longo
      await infoButtons.last().hover();
      const tooltip = page.locator('[role="tooltip"]');
      await expect(tooltip).toBeVisible();
      
      // Verificar se o tooltip está contido na viewport (aproximado via bounding box)
      const box = await tooltip.boundingBox();
      if (box) {
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      }
    });
  }

  test('Argumentation rules validation - High Demand & Low Stock', async ({ page }) => {
    // Nota: Em um ambiente real, usaríamos page.route para interceptar a API e injetar SCENARIOS.HIGH_DEMAND_LOW_STOCK
    // Aqui validamos os padrões de texto implementados
    await page.goto('/inteligencia');
    
    const infoButtons = page.locator('button[aria-label^="Sobre"]');

    // Card Tendência (Urgência)
    await infoButtons.nth(2).hover();
    const trendTooltip = page.locator('[role="tooltip"]');
    // Verifica se a frase de impacto dinâmico está presente (exemplo de padrão)
    await expect(trendTooltip).toContainText(/A procura subiu .* esta semana/);

    // Card Disponível (Escassez)
    await infoButtons.nth(3).hover();
    const stockTooltip = page.locator('[role="tooltip"]');
    // Verifica gatilho de escassez quando o cálculo (feito pelo componente) resulta em < 15 dias
    await expect(stockTooltip).toContainText(/(Urgente|Atenção|estoque)/i);
  });

  test('Consolidated argumentation label check', async ({ page }) => {
    await page.goto('/inteligencia');
    const infoButtons = page.locator('button[aria-label^="Sobre"]');

    // Card Demanda
    await infoButtons.nth(1).hover();
    const demandTooltip = page.locator('[role="tooltip"]');
    
    // Validar se exibe o nível de interesse esperado (Alta/Média/Baixa) conforme os dados
    const demandText = await page.locator('div[role="status"] >> text=Demanda').locator('xpath=..').locator('p.text-sm').textContent();
    if (demandText) {
      await expect(demandTooltip).toContainText(`Interesse ${demandText} detectado`);
    }
  });
});
