/**
 * Regressão visual do ConfirmDialog nas larguras 180/320/375/768.
 *
 * Usa o harness dev-only em `/__test/confirm-dialog` (rota pública, sem auth).
 * Valida:
 *   1) baseline PNG por (variante × largura) — gere/atualize com
 *      `bunx playwright test e2e/ui/confirm-dialog-visual.spec.ts --update-snapshots`
 *   2) ausência de clipping/text-overflow: para cada botão, checamos que
 *      `scrollWidth <= clientWidth` (nenhum texto cortado horizontalmente)
 *      e que a altura do botão fica dentro da faixa esperada de UMA linha
 *      (12px..44px), garantindo que `whitespace-nowrap` está funcionando.
 */
import { test, expect } from '@playwright/test';

const VARIANTS = ['default', 'destructive', 'warning', 'info'] as const;
const WIDTHS = [180, 320, 375, 768] as const;

// Faixa de altura razoável para 1 linha de botão (h-8 = 32px + padding/border).
const MAX_SINGLE_LINE_HEIGHT_PX = 44;
const MIN_BUTTON_HEIGHT_PX = 20;

for (const variant of VARIANTS) {
  for (const width of WIDTHS) {
    test.describe(`ConfirmDialog visual — ${variant} @ ${width}px`, () => {
      test.use({ viewport: { width, height: 720 } });

      test(`baseline + no-clip (${variant}, ${width}px)`, async ({ page }) => {
        await page.goto(`/__test/confirm-dialog?variant=${variant}&width=${width}`, {
          waitUntil: 'domcontentloaded',
        });
        await page.waitForSelector('[data-testid="harness-ready"]');

        // Estabiliza animações antes do screenshot.
        await page.addStyleTag({
          content: `*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }`,
        });

        const dialog = page.getByRole('alertdialog');
        await expect(dialog).toBeVisible();

        // 1) baseline visual do diálogo (apenas o container do alertdialog).
        await expect(dialog).toHaveScreenshot(`confirm-dialog-${variant}-${width}.png`, {
          maxDiffPixelRatio: 0.02,
          animations: 'disabled',
        });

        // 1.b) largura renderizada real (bounding box) — pega regressões que
        // asserções de classe não detectam (ex.: `max-w-lg` do shadcn voltando
        // a vencer). Alvo: min(358px, viewport*0.92) com tolerância de 4px.
        const box = await dialog.boundingBox();
        expect(box).not.toBeNull();
        const viewportWidth = page.viewportSize()?.width ?? width;
        const expectedWidth = Math.min(358, viewportWidth * 0.92);
        expect(Math.abs(box!.width - expectedWidth)).toBeLessThanOrEqual(4);

        // 1.c) Dialog inteiro DEVE estar dentro do viewport (sem overflow horizontal).
        expect(box!.x).toBeGreaterThanOrEqual(-1);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1);

        // 1.d) Sem overflow VERTICAL (top/bottom clipping em telas pequenas).
        const viewportHeight = page.viewportSize()?.height ?? 720;
        expect(box!.y).toBeGreaterThanOrEqual(-1);
        expect(box!.y + box!.height).toBeLessThanOrEqual(viewportHeight + 1);

        // 2) sem clipping horizontal em qualquer botão do footer.
        for (const testId of ['confirm-dialog-yes', 'confirm-dialog-no']) {
          const btn = page.getByTestId(testId);
          await expect(btn).toBeVisible();
          const metrics = await btn.evaluate((el) => ({
            scrollWidth: (el as HTMLElement).scrollWidth,
            clientWidth: (el as HTMLElement).clientWidth,
            height: (el as HTMLElement).getBoundingClientRect().height,
            hasNowrap: getComputedStyle(el as HTMLElement).whiteSpace.includes('nowrap'),
            ariaLabel: el.getAttribute('aria-label'),
          }));
          // whitespace-nowrap ativo → texto não quebra.
          expect(metrics.hasNowrap).toBe(true);
          // altura consistente com 1 linha (nunca 2).
          expect(metrics.height).toBeGreaterThan(MIN_BUTTON_HEIGHT_PX);
          expect(metrics.height).toBeLessThanOrEqual(MAX_SINGLE_LINE_HEIGHT_PX);
          // aria-label sempre com texto completo (leitor de tela).
          expect(metrics.ariaLabel).toBeTruthy();
          expect(metrics.ariaLabel?.length ?? 0).toBeGreaterThan(3);
          // texto visível não pode ultrapassar o container.
          expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
          // botão inteiro dentro do viewport (sem clipping H nem V).
          const btnBox = await btn.boundingBox();
          expect(btnBox).not.toBeNull();
          const vpH = page.viewportSize()?.height ?? 720;
          expect(btnBox!.x).toBeGreaterThanOrEqual(-1);
          expect(btnBox!.x + btnBox!.width).toBeLessThanOrEqual(viewportWidth + 1);
          expect(btnBox!.y).toBeGreaterThanOrEqual(-1);
          expect(btnBox!.y + btnBox!.height).toBeLessThanOrEqual(vpH + 1);
        }
      });
    });
  }
}
