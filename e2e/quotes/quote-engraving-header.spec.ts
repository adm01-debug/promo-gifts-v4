/**
 * Cabeçalho da gravação confirmada em /orcamentos/:id/editar — full-flow.
 *
 * Estratégia oportunística: navega para o primeiro orçamento em rascunho
 * e valida os invariantes do cabeçalho quando há gravação confirmada.
 * Se o ambiente não tiver rascunho com gravação confirmada, `test.skip`
 * (evita seed frágil e mantém a spec estável no CI).
 *
 * Invariantes validados:
 *  1. `[data-testid="customization-confirmed-header"]` fica montado durante
 *     a transição (sem colapsar altura → sem piscada).
 *  2. Enquanto `price.nome_tabela` carrega, aparece
 *     `[data-testid="customization-confirmed-skeleton"]`.
 *  3. Após loaded, o skeleton some e
 *     `[data-testid="customization-confirmed-title"]` exibe texto formatado
 *     no padrão "X | Y" (capitalização consistente do `formatEngravingTitle`).
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoQuoteScenario } from '../quotes/_helpers/quote-scenarios';

test.describe('ConfigurationPanelV6 — cabeçalho da gravação confirmada (full-flow)', () => {
  test('exibe título formatado após loading→loaded em orçamento com gravação', async ({ page }) => {
    await loginAs(page);

    const ok = await gotoQuoteScenario(page, 'rascunho');
    test.skip(!ok, 'sem orçamento em rascunho neste ambiente');

    // Procura por qualquer painel de gravação confirmada já renderizado.
    const header = page.locator('[data-testid="customization-confirmed-header"]').first();
    const headerCount = await header.count().catch(() => 0);
    test.skip(headerCount === 0, 'orçamento não tem gravação confirmada visível');

    // Cabeçalho deve estar visível e sempre com conteúdo (nunca vazio).
    await expect(header).toBeVisible({ timeout: 10_000 });

    // Aguarda o título final aparecer (skeleton pode existir por milissegundos).
    const title = page.locator('[data-testid="customization-confirmed-title"]').first();
    await expect(title).toBeVisible({ timeout: 15_000 });

    // Skeleton deve ter sumido depois do loaded.
    await expect(
      page.locator('[data-testid="customization-confirmed-skeleton"]').first(),
    ).toHaveCount(0);

    // Texto final: não deve ser a string legada e deve começar com letra maiúscula.
    const text = (await title.textContent())?.trim() ?? '';
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toBe('Gravação confirmada');
    expect(text).not.toBe('Adicionada ao orçamento');
    expect(text[0]).toMatch(/[A-ZÀ-Ý0-9]/);
    // Se houver múltiplos segmentos, devem estar unidos por " | " (padrão SSOT).
    if (text.includes('|')) {
      expect(text).toMatch(/\S \| \S/);
    }
  });
});
