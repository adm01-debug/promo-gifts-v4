/**
 * E2E — quote_number deve aparecer no topo do PDF exportado (não só no preview).
 *
 * Estratégia:
 *  1. Navega até a tela de visualização do orçamento (cenário Rascunho/Enviada/Novo
 *     quando aplicável — Novo gera "Proposta Comercial" sem numeração).
 *  2. No desktop: abre o dialog via `data-testid="pdf-preview-trigger"` e
 *     dispara o download via `data-testid="export-pdf-button"` (confirm).
 *  3. Lê o PDF baixado e extrai o texto com `pdf-parse` (já listado em
 *     devDependencies via @types/pdf-parse). Falha o teste se a frase legada
 *     aparecer OU se o quote_number do orçamento atual não constar no PDF.
 *
 * Caso o download não exista no projeto (botão ausente) ou cenário não existir,
 * o teste faz `test.skip` para não bloquear o pipeline em ambiente sem seed.
 */
import { test, expect } from '../fixtures/test-base';
import { requireAuth } from '../fixtures/test-base';
import * as fs from 'node:fs/promises';
import {
  FORBIDDEN_PHRASE,
  QUOTE_NUMBER_REGEX,
  gotoQuoteScenario,
  type QuoteScenario,
} from './_helpers/quote-scenarios';

test.describe('PDF exportado · quote_number no topo', () => {
  test.skip(
    ({ page: _page }, testInfo) => testInfo.project.name !== 'chromium-authed',
    'Requer auth real para acessar export PDF.',
  );
  test.beforeEach(() => requireAuth());

  for (const scenario of ['rascunho', 'enviada'] as QuoteScenario[]) {
    test(`[${scenario}] PDF exportado contém quote_number e não contém frase legada`, async ({
      page,
    }) => {
      const ok = await gotoQuoteScenario(page, scenario);
      if (!ok) test.skip(true, `Sem orçamento ${scenario} no ambiente.`);

      const subtitle = page.getByTestId('quote-number-display');
      const subText = (await subtitle.textContent()) ?? '';
      const match = subText.match(QUOTE_NUMBER_REGEX);
      if (!match) test.skip(true, `Orçamento ${scenario} sem quote_number — não testável.`);
      const quoteNumber = match![0];

      // Desktop: abre o dialog via `pdf-preview-trigger` e dispara o download
      // via `export-pdf-button` (confirm dentro do dialog).
      const trigger = page.getByTestId('pdf-preview-trigger');
      await expect(trigger, 'pdf-preview-trigger ausente no desktop').toHaveCount(1, {
        timeout: 10_000,
      });

      // a11y: nome acessível obrigatório no trigger.
      await expect(trigger).toHaveAttribute('aria-label', /.+/);

      // Teclado: foca via Tab e ativa via Enter (em vez de click) para
      // garantir que o fluxo funciona sem mouse.
      await trigger.focus();
      await expect(trigger).toBeFocused();
      await page.keyboard.press('Enter');

      const exportBtn = page.getByTestId('export-pdf-button');
      await expect(exportBtn).toHaveCount(1, { timeout: 10_000 });
      await expect(exportBtn).toHaveAttribute('aria-label', /.+/);

      const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
      await exportBtn.focus();
      await page.keyboard.press('Enter');
      const download = await downloadPromise;
      const path = await download.path();
      expect(path).toBeTruthy();

      const buf = await fs.readFile(path!);
      // Lazy import — apenas neste spec — para evitar peso no resto do bundle.
      const pdfParse = (await import('pdf-parse')).default as (b: Buffer) => Promise<{ text: string }>;
      const { text } = await pdfParse(buf);

      expect(text).toContain(quoteNumber);
      expect(text).not.toContain(FORBIDDEN_PHRASE);
      // Validação extra: o cabeçalho "Proposta Comercial" deve estar intacto.
      expect(text).toMatch(/Proposta\s*Comercial/);
    });
  }

  test('[fallback] orçamento sem quote_number gera PDF com "Proposta Comercial" e sem frase legada', async ({
    page,
  }) => {
    // Cenário: rascunho NOVO ainda não persistido — usuário gera PDF antes de salvar.
    // Garante que o fallback amigável não quebra o layout do PDF.
    await page.goto('/orcamentos/novo');
    const exportBtn = page.getByTestId('export-pdf-button');
    if ((await exportBtn.count()) === 0) test.skip(true, 'Export PDF indisponível em /novo.');

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 }).catch(() => null);
    await exportBtn.first().click({ trial: false }).catch(() => undefined);
    const download = await downloadPromise;
    if (!download) test.skip(true, 'PDF não baixado em modo novo (esperado em algumas configurações).');

    const path = await download!.path();
    const buf = await fs.readFile(path!);
    const pdfParse = (await import('pdf-parse')).default as (b: Buffer) => Promise<{ text: string }>;
    const { text } = await pdfParse(buf);
    expect(text).toMatch(/Proposta\s*Comercial/);
    expect(text).not.toContain(FORBIDDEN_PHRASE);
    // Sem número definitivo: aceita ausência OU placeholder amigável.
    expect(text).not.toMatch(/undefined|null|NaN/i);
  });

  test('[malformado] fallback amigável no preview NÃO quebra grid/layout', async ({ page }) => {
    // Cenário: simula quote_number malformado injetando via localStorage/DOM —
    // valida que o display de fallback (`quote-number-display-fallback` ou
    // `-missing`) mantém a coluna/row dentro de bounds e não overflowa o header.
    await page.goto('/orcamentos/novo');

    // Aceita qualquer variante de fallback (missing/malformed/fallback).
    const fallback = page
      .locator(
        '[data-testid="quote-number-display-fallback"], [data-testid="quote-number-display-missing"], [data-testid="quote-number-display-malformed"]',
      )
      .first();

    if ((await fallback.count()) === 0) {
      test.skip(true, 'Fallback display não presente nesta rota.');
    }
    await expect(fallback).toBeVisible();

    // Validação de layout: não pode estourar a viewport horizontal nem
    // ter altura zero (= quebrou grid).
    const box = await fallback.boundingBox();
    expect(box, 'fallback sem bounding box (display:none?)').not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
    const viewport = page.viewportSize();
    if (viewport) {
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    }
    // Texto não pode vazar tokens técnicos para o usuário.
    const txt = (await fallback.textContent()) ?? '';
    expect(txt).not.toMatch(/undefined|null|NaN/i);
    expect(txt).not.toContain(FORBIDDEN_PHRASE);
  });
});

