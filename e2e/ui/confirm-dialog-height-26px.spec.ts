/**
 * Regression guard para altura reduzida dos botões Cancelar/Confirmar do
 * `ConfirmDialog` (SSOT em `src/components/ui/ConfirmDialog.tsx`).
 *
 * Contrato validado:
 *   1) Em TODAS as variantes (default | destructive | warning | info), as
 *      classes CSS aplicadas incluem `h-[26px]` e `min-h-[26px]` e NÃO
 *      contêm `min-h-[44px]` (regressão do `buttonVariants` default).
 *   2) Em viewport desktop (≥640px), a altura renderizada é ~26px (24..30px).
 *   3) Em viewport mobile (<640px), o piso é 44px devido à regra global de
 *      touch-target (WCAG 2.5.5) em `src/styles/responsive.css` — as classes
 *      ainda são `h-[26px] min-h-[26px]`, mas o CSS global sobrescreve o
 *      min-height para 44px. Isso é INTENCIONAL de acessibilidade e o spec
 *      documenta o contrato para prevenir tanto regressão (ficar >44px sem
 *      motivo) quanto remoção acidental da regra WCAG.
 *   4) Em mobile, foco alcançável e Enter/Espaço disparam click.
 *
 * Sem side-effects: usa o harness dev-only `/__test/confirm-dialog`.
 */
import { test, expect, type Page } from '@playwright/test';

const VARIANTS = ['default', 'destructive', 'warning', 'info'] as const;
const DESKTOP_H = 26;
const DESKTOP_TOL = 4; // ±4px cobre padding/border/rounding.
const MOBILE_H = 44; // WCAG 2.5.5 floor via CSS global (responsive.css).
const MOBILE_TOL = 2;

async function openHarness(page: Page, variant: string) {
  await page.goto(`/__test/confirm-dialog?variant=${variant}&width=400`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('[data-testid="harness-ready"]');
  await page.addStyleTag({
    content: `*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }`,
  });
  await expect(page.getByRole('alertdialog')).toBeVisible();
}

/**
 * Valida CLASSES (tw-merge) e altura renderizada para uma faixa esperada.
 * `expected` é o alvo de altura em px; `tolerance` a folga aceita.
 */
async function assertButton(
  page: Page,
  testId: string,
  label: string,
  expected: number,
  tolerance: number,
) {
  const btn = page.locator(`[data-testid="${testId}"]`);
  await expect(btn, `[${label}] ${testId} visível`).toBeVisible();

  const cls = (await btn.getAttribute('class')) ?? '';

  expect(cls, `[${label}] ${testId} deve conter h-[26px]`).toContain('h-[26px]');
  expect(cls, `[${label}] ${testId} deve conter min-h-[26px]`).toContain('min-h-[26px]');
  expect(
    cls.includes('min-h-[44px]'),
    `[${label}] ${testId}: min-h-[44px] NÃO pode ser aplicado como classe (regressão do buttonVariants default)`,
  ).toBe(false);

  const box = await btn.boundingBox();
  expect(box, `[${label}] ${testId} bounding box`).not.toBeNull();
  const h = box!.height;
  expect(
    h,
    `[${label}] ${testId}: altura ${h.toFixed(2)}px fora de ${expected}±${tolerance}px`,
  ).toBeGreaterThanOrEqual(expected - tolerance);
  expect(h).toBeLessThanOrEqual(expected + tolerance);
}

// ── Desktop: todas as variantes em ~26px ────────────────────────────────
test.describe('ConfirmDialog height 26px @ desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const variant of VARIANTS) {
    test(`Cancelar & Confirmar em 26px sem min-h-[44px] (${variant})`, async ({ page }) => {
      await openHarness(page, variant);
      await assertButton(page, 'confirm-dialog-no', variant, DESKTOP_H, DESKTOP_TOL);
      await assertButton(page, 'confirm-dialog-yes', variant, DESKTOP_H, DESKTOP_TOL);
    });
  }
});

// ── Mobile (<640px): WCAG 2.5.5 força 44px, mas classes 26px persistem ──
test.describe('ConfirmDialog mobile keyboard & focus (<640px)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('classes 26px preservadas, altura efetiva ~44px (WCAG 2.5.5)', async ({ page }) => {
    await openHarness(page, 'destructive');
    await assertButton(page, 'confirm-dialog-no', 'mobile', MOBILE_H, MOBILE_TOL);
    await assertButton(page, 'confirm-dialog-yes', 'mobile', MOBILE_H, MOBILE_TOL);
  });

  test('foco via keyboard + Enter/Espaço disparam click', async ({ page }) => {
    await openHarness(page, 'destructive');

    const cancel = page.locator('[data-testid="confirm-dialog-no"]');
    const confirm = page.locator('[data-testid="confirm-dialog-yes"]');

    await cancel.focus();
    expect(
      await page.evaluate(
        () => (document.activeElement as HTMLElement | null)?.getAttribute('data-testid'),
      ),
      'Cancelar deve receber foco',
    ).toBe('confirm-dialog-no');

    // Conta cliques disparados via teclado.
    await page.evaluate(() => {
      (window as unknown as { __clicks: string[] }).__clicks = [];
      for (const id of ['confirm-dialog-no', 'confirm-dialog-yes']) {
        document
          .querySelector(`[data-testid="${id}"]`)
          ?.addEventListener('click', () => {
            (window as unknown as { __clicks: string[] }).__clicks.push(id);
          });
      }
    });

    await cancel.focus();
    await page.keyboard.press('Enter');
    await confirm.focus();
    await page.keyboard.press('Space');

    const clicks = await page.evaluate(
      () => (window as unknown as { __clicks: string[] }).__clicks,
    );
    expect(clicks).toEqual(['confirm-dialog-no', 'confirm-dialog-yes']);
  });
});
