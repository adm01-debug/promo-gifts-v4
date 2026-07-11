/**
 * Regressão visual — StockAlertsIndicator (sino de estoque).
 *
 * Captura o painel aberto em desktop e mobile e valida:
 *  1) largura consumida do token `--stock-alerts-panel-width` (391px),
 *  2) presença e ordem canônica dos 4 chips: Zerou · Baixo · Novidade · Chegou,
 *  3) snapshots visuais determinísticos (animações desabilitadas).
 *
 * Em ambientes sem sessão autenticada (sino ausente), faz skip explícito.
 *
 * Para atualizar baselines:
 *   npx playwright test e2e/visual/stock-alerts-panel.spec.ts --update-snapshots
 */
import { test, expect, type Page } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';
import { TID } from '../fixtures/selectors';

const BELL = TID('stock-alerts-indicator');
const PANEL = TID('stock-alerts-panel');
const CHIP_ORDER = ['stockout', 'low', 'new', 'restocked'] as const;
const EXPECTED_WIDTH_PX = 391;

const FREEZE_CSS = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
    caret-color: transparent !important;
  }
`;

async function openBell(page: Page): Promise<boolean> {
  await gotoAndSettle(page, '/');
  await page.addStyleTag({ content: FREEZE_CSS });
  const bell = page.locator(BELL);
  if ((await bell.count()) === 0) return false;
  await bell.first().click();
  const panel = page.locator(PANEL);
  await panel.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  return (await panel.count()) > 0;
}

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`Painel de alertas de estoque — ${vp.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
    });

    test('largura respeita token 391px e chips estão na ordem correta', async ({ page }) => {
      const ok = await openBell(page);
      test.skip(!ok, 'Sino de estoque indisponível (sessão não autenticada).');

      const panel = page.locator(PANEL);
      await expect(panel).toBeVisible();

      // Token CSS: `--stock-alerts-panel-width` == 391px
      const tokenValue = await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--stock-alerts-panel-width')
          .trim(),
      );
      expect(tokenValue).toBe(`${EXPECTED_WIDTH_PX}px`);

      // Largura efetiva do painel — em mobile pode ser limitada por max-w,
      // então garantimos que não excede 391px e nunca ultrapassa o viewport.
      const box = await panel.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeLessThanOrEqual(EXPECTED_WIDTH_PX + 1);
      expect(box!.width).toBeLessThanOrEqual(vp.width);

      // Ordem dos chips
      for (let i = 0; i < CHIP_ORDER.length; i++) {
        await expect(page.locator(TID(`stock-alerts-chip-${CHIP_ORDER[i]}`))).toBeVisible();
      }
      const chipsBoxes = await Promise.all(
        CHIP_ORDER.map((k) => page.locator(TID(`stock-alerts-chip-${k}`)).boundingBox()),
      );
      const xs = chipsBoxes.map((b) => b?.x ?? -1);
      const sorted = [...xs].sort((a, b) => a - b);
      expect(xs).toEqual(sorted);

      // Todos os chips cabem dentro do painel (sem overflow horizontal).
      const panelBox = await panel.boundingBox();
      for (const b of chipsBoxes) {
        expect(b).not.toBeNull();
        expect(b!.x + b!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width + 1);
      }
    });

    test('snapshot visual do painel aberto', async ({ page }) => {
      const ok = await openBell(page);
      test.skip(!ok, 'Sino de estoque indisponível (sessão não autenticada).');

      const panel = page.locator(PANEL);
      await expect(panel).toBeVisible();

      await expect(panel).toHaveScreenshot(`stock-alerts-panel-${vp.name}.png`, {
        animations: 'disabled',
        maxDiffPixelRatio: 0.03,
        // Mascara imagens/thumbs de itens (dependem de dados ao vivo).
        mask: [panel.locator('img')],
      });
    });
  });
}
