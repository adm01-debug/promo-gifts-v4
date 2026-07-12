/**
 * Regression guard para altura reduzida dos botões Cancelar/Excluir do
 * `ConfirmDialog` (SSOT em `src/components/ui/ConfirmDialog.tsx`).
 *
 * Garante para TODAS as variantes (default | destructive | warning | info):
 *   1) Classes CSS incluem `h-[26px]` E `min-h-[26px]`.
 *   2) Classe `min-h-[44px]` NÃO está presente (regressão do `buttonVariants`
 *      default que costumava sobrescrever a altura reduzida).
 *   3) Altura renderizada real (bounding box) fica em ~26px (24..30 tolerância).
 *   4) Em viewport mobile (375×667) o foco vai para o botão via keyboard e
 *      Enter/Espaço disparam `click` sem regressão.
 *
 * Sem side-effects: usa o harness dev-only `/__test/confirm-dialog`.
 */
import { test, expect, type Page } from '@playwright/test';

const VARIANTS = ['default', 'destructive', 'warning', 'info'] as const;
const EXPECTED_H = 26;
const TOLERANCE = 4; // ±4px cobre padding/border/rounding do browser.

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

async function assertButtonHeight(page: Page, testId: string, variant: string) {
  const btn = page.locator(`[data-testid="${testId}"]`);
  await expect(btn, `[${variant}] ${testId} deve estar visível`).toBeVisible();

  const cls = (await btn.getAttribute('class')) ?? '';

  expect(
    cls,
    `[${variant}] ${testId}: classe deve conter h-[26px] — atual="${cls}"`,
  ).toContain('h-[26px]');

  expect(
    cls,
    `[${variant}] ${testId}: classe deve conter min-h-[26px] — atual="${cls}"`,
  ).toContain('min-h-[26px]');

  // Regressão explícita: min-h-[44px] (herdado de buttonVariants.default)
  // NÃO pode aparecer entre as classes finais aplicadas pelo tw-merge.
  expect(
    cls.includes('min-h-[44px]'),
    `[${variant}] ${testId}: min-h-[44px] NÃO deve estar presente (regressão do buttonVariants default) — atual="${cls}"`,
  ).toBe(false);

  const box = await btn.boundingBox();
  expect(box, `[${variant}] ${testId}: bounding box deve existir`).not.toBeNull();
  const h = box!.height;
  expect(
    h,
    `[${variant}] ${testId}: altura renderizada ${h.toFixed(2)}px fora da faixa ${EXPECTED_H}±${TOLERANCE}px`,
  ).toBeGreaterThanOrEqual(EXPECTED_H - TOLERANCE);
  expect(h).toBeLessThanOrEqual(EXPECTED_H + TOLERANCE);
}

for (const variant of VARIANTS) {
  test.describe(`ConfirmDialog height 26px — ${variant}`, () => {
    test(`Cancelar & Confirmar em 26px sem min-h-[44px] (${variant})`, async ({ page }) => {
      await openHarness(page, variant);
      await assertButtonHeight(page, 'confirm-dialog-no', variant);
      await assertButtonHeight(page, 'confirm-dialog-yes', variant);
    });
  });
}

test.describe('ConfirmDialog mobile keyboard & focus', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('foco alcançável e Enter/Espaço disparam ação (destructive @ 375px)', async ({ page }) => {
    await openHarness(page, 'destructive');

    // Altura reduzida também vale em mobile.
    await assertButtonHeight(page, 'confirm-dialog-no', 'destructive/mobile');
    await assertButtonHeight(page, 'confirm-dialog-yes', 'destructive/mobile');

    const cancel = page.locator('[data-testid="confirm-dialog-no"]');
    const confirm = page.locator('[data-testid="confirm-dialog-yes"]');

    // Foco programático + verificação de que o elemento focado é o botão.
    await cancel.focus();
    expect(
      await page.evaluate(
        (el) => document.activeElement === el,
        await cancel.elementHandle(),
      ),
      'Cancelar deve receber foco',
    ).toBe(true);

    // Instrumentação: contamos cliques disparados via keyboard.
    await page.evaluate(() => {
      (window as unknown as { __clicks: string[] }).__clicks = [];
      for (const id of ['confirm-dialog-no', 'confirm-dialog-yes']) {
        const el = document.querySelector(`[data-testid="${id}"]`);
        el?.addEventListener('click', () => {
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
    expect(clicks, 'Enter em Cancelar + Espaço em Confirmar devem disparar click').toEqual([
      'confirm-dialog-no',
      'confirm-dialog-yes',
    ]);
  });
});
