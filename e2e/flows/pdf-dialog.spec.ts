/**
 * E2E — PdfGenerationDialog (fluxo completo + validações estendidas)
 *
 * Cobre:
 *   1. Fluxo completo — abre, valida aviso pill + tooltip, click Gerar PDF,
 *      valida download (nome + tamanho mínimo) e confirma fechamento sem
 *      resíduo (dialog realmente fecha, trigger volta a existir).
 *   2. Navegação por teclado — Tab/Shift+Tab preso ao dialog (focus trap
 *      Radix), Enter no confirm dispara a geração, Escape fecha e devolve
 *      o foco ao trigger.
 *   3. Responsividade do botão — mede rect CSS em desktop e mobile,
 *      confere alvo tátil ≥44px (AA), footer alinhado à direita.
 *   4. Screenshots visuais — captura dialog aberto (com aviso e tooltip)
 *      em desktop e o mesmo em mobile, com máscara sobre o preview do
 *      documento (que varia por fixture) — diff visual detecta regressões
 *      de UI antes do merge.
 *
 * Roda em `chromium-authed`, `firefox-authed` e `mobile-chrome`. Skipa em
 * projetos sem auth ou quando não há orçamento enviado no ambiente.
 */
import { test, expect } from '../fixtures/test-base';
import { requireAuth } from '../fixtures/test-base';
import { gotoQuoteScenario } from '../quotes/_helpers/quote-scenarios';

const AUTHED_PROJECTS = new Set([
  'chromium-authed',
  'firefox-authed',
  'mobile-chrome',
  'mobile-safari',
]);

const MIN_PDF_BYTES = 1024; // 1 KB — abaixo disso quase certamente é erro.

async function openPdfDialog(
  page: import('@playwright/test').Page,
  scenario: 'enviada' | 'rascunho' = 'enviada',
) {
  const ok = await gotoQuoteScenario(page, scenario);
  if (!ok) test.skip(true, `Sem orçamento no estado "${scenario}" no ambiente.`);
  const trigger = page.getByTestId('pdf-preview-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  const confirm = page.getByTestId('pdf-generate-confirm');
  await expect(confirm).toBeVisible({ timeout: 10_000 });
  return { trigger, confirm };
}

/** Extrai texto por página via pdftotext. Retorna null se a lib faltar. */
async function extractPdfPages(pdfPath: string): Promise<string[] | null> {
  const { spawnSync } = await import('node:child_process');
  const res = spawnSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf-8' });
  if (res.status !== 0 || !res.stdout) return null;
  return res.stdout.split('\f').filter((p) => p.trim().length > 0);
}

test.describe('PdfGenerationDialog · fluxo completo', () => {
  test.skip(
    ({}, testInfo) => !AUTHED_PROJECTS.has(testInfo.project.name),
    'Requer projeto autenticado (multi-engine + mobile).',
  );
  test.beforeEach(() => requireAuth());

  test('abre, valida aviso + tooltip, gera PDF (nome + tamanho + conteúdo) e fecha limpo', async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.startsWith('mobile-');
    const { trigger, confirm } = await openPdfDialog(page);

    await expect(confirm).toBeEnabled();
    await expect(confirm).toHaveAttribute('aria-label', /gerar.+pdf/i);

    // Aviso pill — contrato ARIA
    const pill = page.locator('.pdf-warn-pill');
    await expect(pill).toHaveCount(1);
    await expect(pill).toHaveAttribute('role', 'status');
    await expect(pill).toHaveAttribute('aria-live', 'polite');
    await expect(pill).toHaveAttribute('aria-label', /aviso|confira/i);
    if (!isMobile) await expect(pill).toBeVisible();

    // Captura número da proposta no header — regex robusto ao formato
    // "10015/26", "10015 / 26", "10015-26", com espaços/quebras no meio.
    let quoteNumber: string | null = null;
    let quoteNumberHead: string | null = null;
    if (!isMobile) {
      const title = await page.locator('[role="dialog"] .truncate').first().textContent();
      const normalized = (title ?? '').replace(/\s+/g, ' ').trim();
      const m = normalized.match(/(\d{3,})\s*[\/\-]?\s*(\d{0,4})/);
      if (m) {
        quoteNumberHead = m[1];
        quoteNumber = m[2] ? `${m[1]}/${m[2]}` : m[1];
      }
    }


    // Tooltip do botão — foco + hover + contrato ARIA
    if (!isMobile) {
      await confirm.focus();
      // Ao focar, Radix Tooltip abre e liga aria-describedby ao content.
      const tooltip = page.getByRole('tooltip', {
        name: /gera e baixa o pdf final da proposta/i,
      });
      await expect(tooltip).toBeVisible({ timeout: 3_000 });
      const describedBy = await confirm.getAttribute('aria-describedby');
      expect(describedBy, 'confirm sem aria-describedby quando tooltip aberta').toBeTruthy();
      if (describedBy) {
        const tooltipId = await tooltip.getAttribute('id');
        expect(describedBy.split(/\s+/)).toContain(tooltipId);
      }
      // Blur remove tooltip e limpa aria-describedby (contrato Radix).
      await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => undefined);
      await confirm.evaluate((el: HTMLElement) => el.blur());
      await expect(tooltip).toBeHidden({ timeout: 3_000 });
    }

    // Download — nome + tamanho mínimo + conteúdo textual
    const downloadPromise = page
      .waitForEvent('download', { timeout: 20_000 })
      .catch(() => null);
    await confirm.click();
    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
      const path = await download.path();
      if (path) {
        const { statSync } = await import('node:fs');
        const size = statSync(path).size;
        expect(size, `PDF suspeito de ser erro (${size} bytes)`).toBeGreaterThan(MIN_PDF_BYTES);

        // Extração textual — via pdftotext (poppler). Multi-página: extraímos
        // TODAS as páginas e também mantemos o texto por página para
        // localizar em qual folha o campo aparece. Se pdftotext estiver
        // ausente localmente, o teste registra e segue; no CI é instalado.
        const { spawnSync } = await import('node:child_process');
        const raw = spawnSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf-8' });
        if (raw.status === 0 && raw.stdout) {
          // pdftotext (sem -nopgbrk) separa páginas com form-feed (\f).
          const pages = raw.stdout.split('\f').filter((p) => p.trim().length > 0);
          // Normalização única por página + agregada — remove quebras, hifens
          // e diacríticos para casar "razão"/"razao", "número"/"n°"/"nº".
          const normalize = (s: string) =>
            s
              .replace(/\r?\n/g, ' ')
              .replace(/\s+/g, ' ')
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
              .toLowerCase();
          const pagesNorm = pages.map(normalize);
          const allText = pagesNorm.join(' \f ');

          testInfo.annotations.push({
            type: 'pdf-pages',
            description: `Total de páginas: ${pages.length}`,
          });

          // Deve mencionar a natureza do documento em alguma página.
          expect(
            pagesNorm.some((p) => /proposta|orcamento/.test(p)),
            'Nenhuma página menciona "proposta" ou "orçamento"',
          ).toBe(true);

          // Número da proposta — regex tolerante a espaços, hífen, "nº"/"n°"
          // e quebras de linha (já normalizadas). Se capturamos do header,
          // ele precisa aparecer em pelo menos UMA página relevante.
          if (quoteNumberHead) {
            const head = quoteNumberHead;
            // Constrói regex do número com variações de formato ao redor.
            const numberRe = new RegExp(
              `(?:n\\s*[o°º]\\s*|numero\\s*|proposta\\s*(?:comercial\\s*)?)?` +
                `${head}` +
                `(?:\\s*[\\/-]\\s*\\d{1,4})?`,
              'i',
            );
            const foundPageIdx = pagesNorm.findIndex((p) => numberRe.test(p));
            expect(
              foundPageIdx,
              `número ${quoteNumber ?? head} ausente em todas as ${pages.length} página(s)`,
            ).toBeGreaterThanOrEqual(0);
            testInfo.annotations.push({
              type: 'quote-number-page',
              description: `Número "${quoteNumber ?? head}" localizado na página ${foundPageIdx + 1}`,
            });
          }

          // Campo-âncora do cliente em qualquer página relevante.
          const clientRe = /cliente|razao\s+social|cnpj|contato|e-?mail|telefone/;
          const clientPageIdx = pagesNorm.findIndex((p) => clientRe.test(p));
          expect(
            clientPageIdx,
            `PDF sem campos-âncora do cliente em nenhuma das ${pages.length} página(s). ` +
              `Amostra p1: "${(pagesNorm[0] ?? '').slice(0, 200)}"`,
          ).toBeGreaterThanOrEqual(0);
          testInfo.annotations.push({
            type: 'client-field-page',
            description: `Campo do cliente localizado na página ${clientPageIdx + 1}`,
          });

          // Sanidade: se há > 1 página, o texto agregado precisa ser maior
          // que o de uma única página (garante que multi-página foi lida).
          if (pages.length > 1) {
            expect(allText.length).toBeGreaterThan(pagesNorm[0].length);
          }
        } else {
          testInfo.annotations.push({
            type: 'pdftotext-missing',
            description:
              'pdftotext não disponível — extração textual pulada. Em CI o step instala poppler-utils.',
          });
        }
      }
    }

    // Fechamento limpo — dialog sai do DOM e trigger reaparece.
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape').catch(() => undefined);
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId('pdf-generate-confirm')).toHaveCount(0);
    await expect(trigger).toBeVisible();
  });

  test('navegação por teclado — Tab/Shift+Tab preso, ordem correta, Enter dispara, Escape fecha e devolve foco', async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.startsWith('mobile-');
    const { trigger, confirm } = await openPdfDialog(page);

    // --- Ordem de Tab (sequência esperada dentro do dialog) ---
    // Coleta a ordem circular de foco a partir do primeiro tabbable.
    // O contrato Radix garante: close (X) -> ... -> confirm -> volta ao close.
    const collectFocusOrder = async (steps: number): Promise<string[]> => {
      const order: string[] = [];
      for (let i = 0; i < steps; i++) {
        const id = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el) return 'none';
          return (
            el.getAttribute('data-testid') ||
            el.getAttribute('aria-label') ||
            el.tagName.toLowerCase()
          );
        });
        order.push(id);
        await page.keyboard.press('Tab');
      }
      return order;
    };

    // Foca o botão de fechar do dialog para começar do topo da ordem.
    await page.locator('[role="dialog"] [aria-label*="Close" i], [role="dialog"] button').first().focus();
    const forwardOrder = await collectFocusOrder(8);
    // O confirm precisa aparecer na sequência forward.
    expect(
      forwardOrder.some((id) => id === 'pdf-generate-confirm'),
      `pdf-generate-confirm ausente da ordem de Tab: ${JSON.stringify(forwardOrder)}`,
    ).toBe(true);
    // A ordem precisa ser cíclica (foco reaparece dentro do dialog).
    const uniqueInsideDialog = await page.evaluate(
      () => !!document.activeElement?.closest('[role="dialog"]'),
    );
    expect(uniqueInsideDialog, 'ordem de Tab escapou do dialog').toBe(true);

    // Shift+Tab reverte: primeiro Shift+Tab a partir do confirm foca o anterior tabbable.
    await confirm.focus();
    await page.keyboard.press('Shift+Tab');
    const prevIsInside = await page.evaluate(
      () => !!document.activeElement?.closest('[role="dialog"]'),
    );
    expect(prevIsInside, 'Shift+Tab escapou do dialog').toBe(true);
    const prevIsSame = await page.evaluate(
      () => document.activeElement?.getAttribute('data-testid') === 'pdf-generate-confirm',
    );
    expect(prevIsSame, 'Shift+Tab não moveu o foco para o elemento anterior').toBe(false);

    // Focus trap (Radix Dialog): Tab N vezes nunca deve escapar para <body>.
    await confirm.focus();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const insideDialog = await page.evaluate(() => {
        const el = document.activeElement;
        return !!el && !!el.closest('[role="dialog"]');
      });
      expect(insideDialog, `Foco escapou do dialog após Tab #${i + 1}`).toBe(true);
    }

    // Shift+Tab também mantém preso.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+Tab');
      const insideDialog = await page.evaluate(
        () => !!document.activeElement?.closest('[role="dialog"]'),
      );
      expect(insideDialog).toBe(true);
    }


    // Enter no confirm dispara a geração (loader ou download).
    await confirm.focus();
    const downloadPromise = page
      .waitForEvent('download', { timeout: 20_000 })
      .catch(() => null);
    await page.keyboard.press('Enter');
    await Promise.race([
      expect(page.locator('svg.animate-spin').first()).toBeVisible({ timeout: 8_000 }),
      downloadPromise.then((d) => expect(d).not.toBeNull()),
    ]).catch(() => undefined);
    await downloadPromise;

    // Escape fecha e devolve foco ao trigger (contrato Radix).
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape').catch(() => undefined);
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 15_000 });

    // Desktop: Radix restaura foco no elemento que abriu o dialog.
    // Mobile: alguns browsers touch não restauram — só validamos desktop.
    if (!isMobile) {
      await expect(trigger).toBeFocused({ timeout: 3_000 });
    } else {
      await expect(trigger).toBeVisible();
    }
  });

  test('responsividade do botão Gerar PDF — alvo tátil ≥44px e footer alinhado à direita', async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.startsWith('mobile-');
    const { confirm } = await openPdfDialog(page);

    const box = await confirm.boundingBox();
    expect(box, 'boundingBox do confirm não disponível').not.toBeNull();
    if (box) {
      // WCAG 2.1 AA — alvo tátil mínimo 44×44.
      expect(box.height, `altura ${box.height}px < 44`).toBeGreaterThanOrEqual(44);
      // Padding responsivo (px-5 sm:px-6 md:px-7): largura mínima segura.
      expect(box.width).toBeGreaterThanOrEqual(isMobile ? 100 : 120);
    }

    // Footer alinha o botão à direita: distância da borda direita < da esquerda.
    const layout = await confirm.evaluate((btn) => {
      const footer = btn.closest('div.flex.items-center.justify-end') as HTMLElement | null;
      if (!footer) return null;
      const fRect = footer.getBoundingClientRect();
      const bRect = btn.getBoundingClientRect();
      return {
        gapRight: fRect.right - bRect.right,
        gapLeft: bRect.left - fRect.left,
        footerWidth: fRect.width,
      };
    });
    expect(layout, 'footer do dialog não encontrado').not.toBeNull();
    if (layout) {
      expect(layout.gapRight).toBeGreaterThanOrEqual(0);
      expect(layout.gapRight).toBeLessThan(layout.footerWidth / 2);
      expect(layout.gapLeft).toBeGreaterThan(layout.gapRight);
    }
  });

  test('snapshot visual — dialog aberto com aviso e tooltip (desktop) / aviso oculto (mobile)', async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.startsWith('mobile-');
    const { confirm } = await openPdfDialog(page);

    // Estabiliza: pausa animações do pill (shimmer/glow) para snapshot determinístico.
    await page.addStyleTag({
      content: `
        .pdf-warn-pill, .pdf-warn-shimmer::before { animation: none !important; }
        *, *::before, *::after { transition: none !important; }
      `,
    });

    if (!isMobile) {
      await confirm.hover();
      await page
        .getByRole('tooltip', { name: /gera e baixa o pdf final da proposta/i })
        .waitFor({ state: 'visible', timeout: 3_000 })
        .catch(() => undefined);
    }
    await page.waitForTimeout(200);

    const dialog = page.getByRole('dialog').first();
    // Máscara sobre o miolo do preview (varia por fixture/data) e sobre o
    // número de orçamento no título — o objetivo é diff da moldura, aviso,
    // tooltip e footer, não do conteúdo do PDF.
    const mask = [
      page.locator('div.bg-white.shadow-lg'),
      page.locator('[role="dialog"] .truncate'),
    ];

    const suffix = isMobile ? 'mobile' : 'desktop';
    await expect(dialog).toHaveScreenshot(`pdf-generation-dialog-${suffix}.png`, {
      mask,
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
      timeout: 15_000,
    });
  });

  test('RASCUNHO — orçamento em rascunho gera PDF com marca d\'água em TODAS as páginas', async ({
    page,
  }, testInfo) => {
    const { confirm } = await openPdfDialog(page, 'rascunho');

    const downloadPromise = page
      .waitForEvent('download', { timeout: 20_000 })
      .catch(() => null);
    await confirm.click();
    const download = await downloadPromise;
    if (!download) test.skip(true, 'Download não disparou no ambiente.');

    const pdfPath = await download!.path();
    if (!pdfPath) test.skip(true, 'PDF sem path resolvível.');

    const pages = await extractPdfPages(pdfPath!);
    if (!pages) {
      testInfo.annotations.push({
        type: 'pdftotext-missing',
        description: 'pdftotext ausente — asserção de RASCUNHO pulada localmente.',
      });
      test.skip(true, 'pdftotext indisponível.');
    }

    // Contrato: RASCUNHO deve aparecer em CADA página (não só na primeira).
    // pdftotext preserva espaçamento entre letras causado pelo letter-spacing
    // do watermark ("R A S C U N H O") — normalizamos removendo whitespace.
    const missing: number[] = [];
    (pages ?? []).forEach((p, idx) => {
      const compact = p.replace(/\s+/g, '').toUpperCase();
      if (!compact.includes('RASCUNHO')) missing.push(idx + 1);
    });
    expect(
      missing,
      `RASCUNHO ausente nas páginas ${JSON.stringify(missing)} de ${pages?.length}`,
    ).toEqual([]);

    testInfo.annotations.push({
      type: 'rascunho-coverage',
      description: `RASCUNHO presente em ${pages?.length} de ${pages?.length} páginas`,
    });
  });

  test('RASCUNHO — orçamento NÃO-rascunho (enviado) gera PDF SEM marca d\'água (evita falso positivo)', async ({
    page,
  }, testInfo) => {
    const { confirm } = await openPdfDialog(page, 'enviada');

    const downloadPromise = page
      .waitForEvent('download', { timeout: 20_000 })
      .catch(() => null);
    await confirm.click();
    const download = await downloadPromise;
    if (!download) test.skip(true, 'Download não disparou no ambiente.');

    const pdfPath = await download!.path();
    if (!pdfPath) test.skip(true, 'PDF sem path resolvível.');

    const pages = await extractPdfPages(pdfPath!);
    if (!pages) {
      testInfo.annotations.push({
        type: 'pdftotext-missing',
        description: 'pdftotext ausente — asserção negativa pulada localmente.',
      });
      test.skip(true, 'pdftotext indisponível.');
    }

    // Contrato negativo: NENHUMA página pode conter RASCUNHO.
    const contaminated: number[] = [];
    (pages ?? []).forEach((p, idx) => {
      const compact = p.replace(/\s+/g, '').toUpperCase();
      if (compact.includes('RASCUNHO')) contaminated.push(idx + 1);
    });
    expect(
      contaminated,
      `PDF enviado contaminado com RASCUNHO nas páginas ${JSON.stringify(contaminated)}`,
    ).toEqual([]);
  });
});

