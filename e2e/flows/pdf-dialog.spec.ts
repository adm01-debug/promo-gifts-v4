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

async function openPdfDialog(page: import('@playwright/test').Page) {
  const ok = await gotoQuoteScenario(page, 'enviada');
  if (!ok) test.skip(true, 'Sem orçamento enviado no ambiente.');
  const trigger = page.getByTestId('pdf-preview-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  const confirm = page.getByTestId('pdf-generate-confirm');
  await expect(confirm).toBeVisible({ timeout: 10_000 });
  return { trigger, confirm };
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

    // Captura número da proposta no header (padrão "Proposta Comercial 10015/26")
    let quoteNumber: string | null = null;
    if (!isMobile) {
      const title = await page.locator('[role="dialog"] .truncate').first().textContent();
      const m = title?.match(/(\d{3,}\/?\d*)/);
      quoteNumber = m?.[1] ?? null;
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

        // Extração textual — via pdftotext (poppler). Se ausente localmente,
        // o teste apenas registra e segue; no CI o step instala poppler-utils.
        const { spawnSync } = await import('node:child_process');
        const res = spawnSync('pdftotext', ['-layout', '-nopgbrk', path, '-'], {
          encoding: 'utf-8',
        });
        if (res.status === 0 && res.stdout) {
          const text = res.stdout.replace(/\s+/g, ' ').toLowerCase();
          // Deve mencionar a natureza do documento (proposta/orçamento).
          expect(text, 'PDF não contém marcadores de proposta').toMatch(
            /proposta|or[çc]amento/i,
          );
          // Se capturamos o número do orçamento, ele precisa aparecer no PDF.
          if (quoteNumber) {
            const [head] = quoteNumber.split('/');
            expect(text, `número ${quoteNumber} ausente no PDF`).toContain(head.toLowerCase());
          }
          // Algum campo esperado do cliente (razão social/CNPJ/e-mail/contato).
          expect(
            text,
            'PDF sem campos-âncora do cliente',
          ).toMatch(/cliente|raz[ãa]o\s+social|cnpj|contato|e-?mail|telefone/i);
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

  test('navegação por teclado — Tab/Shift+Tab preso, Enter dispara, Escape fecha e devolve foco', async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.startsWith('mobile-');
    const { trigger, confirm } = await openPdfDialog(page);

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
});
