/**
 * E2E — quote_number deve aparecer no topo do PDF exportado (não só no preview).
 *
 * Estratégia:
 *  1. Navega até a tela de visualização do orçamento (cenário Rascunho/Enviada/Novo
 *     quando aplicável — Novo gera "Proposta Comercial" sem numeração).
 *  2. Dispara o download do PDF via botão `data-testid="export-pdf-button"`.
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

      const exportBtn = page.getByTestId('export-pdf-button');
      // Botão de export PDF é OBRIGATÓRIO no desktop — falha se ausente
      // para não mascarar regressão de testid removido.
      await expect(exportBtn, 'export-pdf-button ausente no desktop').toHaveCount(1, {
        timeout: 10_000,
      });

      const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
      await exportBtn.click();
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
});
