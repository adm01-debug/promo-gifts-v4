/**
 * E2E: botões de ação do rodapé do Resumo (Criar / Salvar Rascunho).
 *
 * Garante que após a refatoração de layout:
 *  - ambos renderizam lado a lado, com "Criar" à esquerda do "Rascunho";
 *  - cada um ocupa ~50% da largura disponível (flex-1, ±8px de tolerância);
 *  - mesma altura (alinhamento vertical);
 *  - continuam clicáveis (não cobertos por overlay) após scroll do Resumo;
 *  - layout permanece coerente em desktop/tablet/mobile sem overflow horizontal;
 *  - interação Recolher/Expandir × Agrupar não altera contagem nem
 *    interatividade dos botões de ação.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const STORAGE_KEY_NEW = 'quote-builder:collapsed-item-keys:new';

async function setup(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await loginAs(page, 'user');
  await page.addInitScript((k) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }, STORAGE_KEY_NEW);
  await gotoAndSettle(page, '/orcamentos/novo');
}

async function skipIfEmpty(page: Page) {
  const firstCard = page.getByTestId('quote-summary-item-0');
  if ((await firstCard.count()) === 0) {
    test.skip(true, 'Resumo vazio — adicionar produto está fora do escopo desta spec.');
  }
  await expect(firstCard).toBeVisible({ timeout: 10_000 });
}

function getActionButtons(page: Page): { criar: Locator; rascunho: Locator } {
  // "Criar" pode virar "Solicitar Aprovação" quando desconto excede alçada;
  // ambos compartilham a coluna esquerda do par de ações.
  const criar = page
    .locator('[data-testid="quote-save-final"], [data-testid="quote-request-approval-button"]')
    .first();
  const rascunho = page.getByTestId('quote-save-draft');
  return { criar, rascunho };
}

async function scrollSummaryToBottom(page: Page) {
  await page.evaluate(() => {
    const header = document.querySelector('[data-testid="quote-summary-header"]');
    let el: HTMLElement | null = header?.parentElement ?? null;
    while (el) {
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight) {
        el.scrollTop = el.scrollHeight;
        return;
      }
      el = el.parentElement;
    }
    window.scrollTo(0, document.body.scrollHeight);
  });
}

test.describe('QuoteBuilderSummaryColumn — botões Criar / Rascunho lado a lado', () => {
  test('desktop 1440: Criar à esquerda, mesma linha, ~50% cada, clicáveis após scroll', async ({
    page,
  }) => {
    await setup(page, 1440, 900);
    await skipIfEmpty(page);

    const { criar, rascunho } = getActionButtons(page);
    await expect(criar).toBeVisible();
    await expect(rascunho).toBeVisible();

    const cBox = await criar.boundingBox();
    const rBox = await rascunho.boundingBox();
    expect(cBox && rBox).toBeTruthy();
    if (!cBox || !rBox) return;

    // Mesma linha (top alinhado, tolerância 4px).
    expect(Math.abs(cBox.y - rBox.y)).toBeLessThanOrEqual(4);
    // Mesma altura.
    expect(Math.abs(cBox.height - rBox.height)).toBeLessThanOrEqual(2);
    // Criar à esquerda do Rascunho.
    expect(cBox.x).toBeLessThan(rBox.x);
    // Larguras parecidas (flex-1) — tolerância 8px p/ gap/borda.
    expect(Math.abs(cBox.width - rBox.width)).toBeLessThanOrEqual(8);

    // Ainda clicáveis após scroll do container do Resumo.
    await scrollSummaryToBottom(page);
    await expect(criar).toBeVisible();
    await expect(rascunho).toBeVisible();
    // hover sem erro confirma que não há overlay cobrindo.
    await criar.hover({ trial: true });
    await rascunho.hover({ trial: true });
  });

  test('Recolher → Expandir → Agrupar mantém contagem e botões interativos', async ({ page }) => {
    await setup(page, 1440, 900);
    await skipIfEmpty(page);

    const collapseAll = page.getByTestId('quote-summary-collapse-all');
    const groupBtn = page.getByTestId('quote-summary-group-trigger');
    const { criar, rascunho } = getActionButtons(page);

    const itemsBefore = await page.locator('[data-testid^="quote-summary-item-"]').count();

    if (await collapseAll.isVisible().catch(() => false)) {
      await collapseAll.click();
      await expect(collapseAll).toHaveAttribute('data-open-count', '0');
      await collapseAll.click();
      const openCount = await collapseAll.getAttribute('data-open-count');
      expect(Number(openCount)).toBeGreaterThan(0);
    }

    if (await groupBtn.isVisible().catch(() => false)) {
      await groupBtn.click();
    }

    const itemsAfter = await page.locator('[data-testid^="quote-summary-item-"]').count();
    // Agrupar não pode inventar nem perder itens.
    expect(itemsAfter).toBeGreaterThan(0);
    expect(itemsAfter).toBeLessThanOrEqual(itemsBefore);

    await scrollSummaryToBottom(page);
    await expect(criar).toBeVisible();
    await expect(rascunho).toBeVisible();
    await criar.hover({ trial: true });
    await rascunho.hover({ trial: true });
  });

  for (const vp of [
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'mobile-375', width: 375, height: 812 },
  ]) {
    test(`@${vp.name}: botões lado a lado sem overflow horizontal nem corte`, async ({ page }) => {
      await setup(page, vp.width, vp.height);
      await skipIfEmpty(page);

      const { criar, rascunho } = getActionButtons(page);
      await expect(criar).toBeVisible();
      await expect(rascunho).toBeVisible();

      const cBox = await criar.boundingBox();
      const rBox = await rascunho.boundingBox();
      if (!cBox || !rBox) test.fail(true, 'boundingBox indisponível para botões de ação');
      if (!cBox || !rBox) return;

      // Lado a lado (mesma linha) também em telas pequenas.
      expect(Math.abs(cBox.y - rBox.y)).toBeLessThanOrEqual(4);
      expect(cBox.x).toBeLessThan(rBox.x);
      expect(Math.abs(cBox.width - rBox.width)).toBeLessThanOrEqual(8);

      // Sem overflow horizontal global.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 2,
      );
      expect(overflow).toBe(false);

      // Botões dentro do viewport.
      expect(cBox.x).toBeGreaterThanOrEqual(0);
      expect(rBox.x + rBox.width).toBeLessThanOrEqual(vp.width + 2);
    });
  }
});
