/**
 * E2E · layout da timeline (stepper) após o botão Reset.
 *
 * Valida que o stepper se estende do botão `quote-reset-button` até a borda
 * direita da página sem amontoar os ícones de etapa, em mobile, lg e xl.
 * Inclui snapshots âncora para detectar regressão visual de clipping/overlap.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const RESET = 'quote-reset-button';
const STEPPER_STEP = '[data-testid^="quote-step-"]';

async function setup(page: Page, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  await loginAs(page, 'user');
  await gotoAndSettle(page, '/orcamentos/novo');
  await expect(page.getByTestId(RESET)).toBeVisible();
}

/** Confirma o ConfirmDialog disparado pelo Reset (se aparecer). */
async function confirmReset(page: Page) {
  await page.getByTestId(RESET).click();
  const confirm = page
    .getByRole('button', { name: /sim, limpar tudo|sair e começar do zero/i })
    .first();
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click();
  }
}

/** Devolve as bounding boxes ordenadas das etapas do stepper. */
async function getStepBoxes(page: Page) {
  const steps = page.locator(STEPPER_STEP);
  const count = await steps.count();
  expect(count).toBeGreaterThanOrEqual(4); // Cliente, Condições, Itens, Personalização, Revisão
  const boxes = [] as Array<{ x: number; y: number; w: number; h: number }>;
  for (let i = 0; i < count; i++) {
    const b = await steps.nth(i).boundingBox();
    if (!b) throw new Error(`step ${i} sem boundingBox`);
    boxes.push({ x: b.x, y: b.y, w: b.width, h: b.height });
  }
  return boxes.sort((a, b) => a.x - b.x);
}

/** Garante que as etapas não se sobrepõem horizontalmente. */
function assertNoOverlap(boxes: Array<{ x: number; w: number }>) {
  for (let i = 1; i < boxes.length; i++) {
    const prev = boxes[i - 1];
    const cur = boxes[i];
    const gap = cur.x - (prev.x + prev.w);
    expect(gap, `etapas ${i - 1}/${i} se amontoam (gap=${gap}px)`).toBeGreaterThanOrEqual(-2);
  }
}

test.describe('@quote-reset-stepper-layout', () => {
  for (const vp of [
    { name: 'mobile 360x560', w: 360, h: 560 },
    { name: 'lg 1280x720', w: 1280, h: 720 },
    { name: 'xl 1440x900', w: 1440, h: 900 },
  ]) {
    test(`stepper alinhado sem amontoar — ${vp.name}`, async ({ page }) => {
      await setup(page, vp.w, vp.h);
      await confirmReset(page);

      const boxes = await getStepBoxes(page);
      assertNoOverlap(boxes);

      // Em lg/xl, stepper deve começar à direita do botão Reset e ir até perto
      // da borda direita da página (margem < 80px). Em mobile, layout empilha
      // e essa restrição não se aplica.
      if (vp.w >= 1024) {
        const resetBox = await page.getByTestId(RESET).boundingBox();
        expect(resetBox).not.toBeNull();
        const firstStep = boxes[0];
        const lastStep = boxes[boxes.length - 1];
        expect(firstStep.x, 'primeiro step deve ficar à direita do Reset').toBeGreaterThan(
          (resetBox!.x ?? 0) + (resetBox!.width ?? 0),
        );
        const rightMargin = vp.w - (lastStep.x + lastStep.w);
        expect(rightMargin, 'último step deve ficar próximo da borda direita').toBeLessThan(80);
      }

      // Snapshot âncora do header para detectar clipping/overlap visual.
      await expect(page).toHaveScreenshot(`quote-reset-header-${vp.w}x${vp.h}.png`, {
        clip: { x: 0, y: 0, width: vp.w, height: Math.min(160, vp.h) },
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
