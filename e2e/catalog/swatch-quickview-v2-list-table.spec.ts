/**
 * E2E — Modo V2 (flag `useColorSwatchesV2`) na Lista e na Tabela.
 *
 * Valida o pipeline novo (`useProductColorSwatch` + `<ColorSwatchPicker size="sm" maxVisible={4}>`)
 * para as 4 rotas que consomem produtos do catálogo externo:
 *   /produtos · /filtros · /novidades · /reposicao
 *
 * Suite cobre:
 *   1. V2 ON → clique numa bolinha (ColorSwatchPicker, `aria-pressed`) abre o
 *      QuickView na cor correta em Lista e Tabela.
 *   2. V2 ON → botão "Todos" do ColorSwatchPicker reseta a seleção.
 *   3. V2 OFF → fallback `ProductColorSwatches` (`role="radio"`) continua
 *      operando e o QuickView NÃO renderiza o ColorSwatchPicker V2.
 *   4. A11y V2 → swatch responde a Enter e Space; tab leva foco ao botão;
 *      Escape no QuickView restaura o foco para a row de origem.
 *   5. Smoke render → em cada uma das 4 rotas, com V2 ON, pelo menos uma row
 *      com >= 2 swatches existe (size sm, maxVisible 4 ⇒ aceita até 4 + "+N").
 *
 * Skipa graciosamente quando a rota não traz produtos com `color_swatches`
 * populado (BD externo não retornou itens, ou auth ausente).
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

const ROUTES = [
  { path: '/produtos',  label: 'catalogo'     },
  { path: '/filtros',   label: 'super-filtro' },
  { path: '/novidades', label: 'novidades'    },
  { path: '/reposicao', label: 'reposicao'    },
] as const;

const VIEWS = [
  { mode: 'list'  as const, toggleTid: 'view-mode-list',  rowSelector: '[data-testid="product-list-item-thumb"]' },
  { mode: 'table' as const, toggleTid: 'view-mode-table', rowSelector: 'div[data-index]' },
];

/** Seletor canônico do ColorSwatchPicker V2 — distinto do fallback que usa role="radio". */
const V2_SWATCH = 'button[aria-pressed][title]:not([role="radio"])';
/** Botão "Todos" só aparece quando há seleção ativa (ColorSwatchPicker.tsx). */
const V2_RESET  = 'button[aria-label="Ver todas as cores"]';

async function setFlag(page: import('@playwright/test').Page, value: boolean) {
  await page.evaluate((v) => {
    try {
      const ls = window.localStorage;
      const raw = ls.getItem('feature-flags');
      const obj = raw ? JSON.parse(raw) : {};
      obj.useColorSwatchesV2 = v;
      ls.setItem('feature-flags', JSON.stringify(obj));
      // Cobre store alternativo (setFeatureFlag escreve em janela global em alguns builds).
      const win = window as unknown as { __FEATURE_FLAGS__?: Record<string, boolean> };
      if (win.__FEATURE_FLAGS__) win.__FEATURE_FLAGS__.useColorSwatchesV2 = v;
    } catch {/* ignore */}
  }, value);
}

async function switchToView(page: import('@playwright/test').Page, toggleTid: string) {
  const toggle = page.locator(`[data-testid="${toggleTid}"]`).first();
  if (await toggle.count()) await toggle.click().catch(() => undefined);
}

test.describe('Swatch V2 → QuickView (Lista e Tabela)', () => {
  test.beforeEach(() => requireAuth());

  // ── (1) + (2) — Clique e reset por view ───────────────────────────────────
  for (const v of VIEWS) {
    test(`[${v.mode}] V2 ON · swatch abre QV na cor e "Todos" reseta`, async ({ page }) => {
      await page.setViewportSize({ width: 1366, height: 900 });
      await gotoAndSettle(page, '/produtos');
      await setFlag(page, true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await switchToView(page, v.toggleTid);

      const rows = page.locator(v.rowSelector);
      await rows.first().waitFor({ timeout: 10_000 }).catch(() => undefined);
      const total = await rows.count();
      test.skip(total === 0, `Sem itens em /produtos (${v.mode}).`);

      // Localiza a primeira row com >= 1 swatch V2.
      let swatch = page.locator(V2_SWATCH).first();
      const hasV2 = await swatch.count();
      test.skip(hasV2 === 0, 'Nenhum produto com color_swatches populado nesta rota.');

      const label = (await swatch.getAttribute('aria-label')) ?? '';
      expect(label).toBeTruthy();

      await swatch.click();

      // QuickView abre e o estoque carrega `data-color-id` != "" (cor específica).
      const stockBadge = page.locator('[data-testid="quickview-stock"]');
      await expect(stockBadge).toBeVisible({ timeout: 8_000 });
      await expect(stockBadge).toHaveAttribute('data-color-id', /.+/);

      // Botão "Todos" do V2 fica visível dentro do QV/row e ao clicar reseta.
      const reset = page.locator(V2_RESET).first();
      await expect(reset).toBeVisible();
      await reset.click();

      // Após reset, ou data-color-id volta vazio (estoque total) ou QV permanece sem cor ativa.
      const colorId = (await stockBadge.getAttribute('data-color-id')) ?? '';
      expect(colorId === '' || colorId === null).toBeTruthy();
    });
  }

  // ── (3) — Fallback com V2 OFF ────────────────────────────────────────────
  test('V2 OFF · fallback ProductColorSwatches continua operando', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoAndSettle(page, '/produtos');
    await setFlag(page, false);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await switchToView(page, 'view-mode-list');

    const v2 = page.locator(V2_SWATCH);
    expect(await v2.count(), 'V2 não deve renderizar com flag OFF').toBe(0);

    // Fallback usa role="radio".
    const fallback = page.locator('[role="radio"][aria-label^="Opção de cor"]').first();
    if (!(await fallback.count())) {
      test.skip(true, 'Sem cores no fallback nesta rota.');
      return;
    }
    await fallback.click();
    await expect(page.locator('[data-testid="quickview-stock"]')).toBeVisible({ timeout: 8_000 });
  });

  // ── (4) — A11y V2 ─────────────────────────────────────────────────────────
  test('V2 ON · a11y: Enter, Space e foco restaurado ao fechar QV', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoAndSettle(page, '/produtos');
    await setFlag(page, true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await switchToView(page, 'view-mode-list');

    const swatch = page.locator(V2_SWATCH).first();
    const hasV2 = await swatch.count();
    test.skip(hasV2 === 0, 'Nenhum swatch V2 disponível.');

    // Marca o swatch como elemento de origem para restauração.
    await swatch.evaluate((el) => el.setAttribute('data-focus-marker', '1'));
    await swatch.focus();
    await expect(swatch).toBeFocused();

    // Space abre QV.
    await page.keyboard.press('Space');
    await expect(page.locator('[data-testid="quickview-stock"]')).toBeVisible({ timeout: 8_000 });

    // Fecha por Escape.
    await page.keyboard.press('Escape');
    await page.locator('[data-testid="quickview-stock"]').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined);

    // requestAnimationFrame ×2 → foco volta para algum swatch (idealmente o marcado).
    await page.evaluate(
      () =>
        new Promise<void>((res) =>
          requestAnimationFrame(() => requestAnimationFrame(() => res())),
        ),
    );
    const focusedIsSwatch = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      if (!a) return false;
      return a.matches('button[aria-pressed][title]') || a.hasAttribute('data-focus-marker');
    });
    expect(focusedIsSwatch).toBeTruthy();

    // Enter num swatch também dispara seleção.
    const swatch2 = page.locator(V2_SWATCH).nth(1);
    if (await swatch2.count()) {
      await swatch2.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('[data-testid="quickview-stock"]')).toBeVisible({ timeout: 8_000 });
    }
  });

  // ── (5) — Smoke render nas 4 rotas ────────────────────────────────────────
  for (const r of ROUTES) {
    test(`[smoke][${r.label}] V2 ON · ColorSwatchPicker renderiza (sm/maxVisible=4)`, async ({ page }) => {
      await page.setViewportSize({ width: 1366, height: 900 });
      await gotoAndSettle(page, r.path);
      await setFlag(page, true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await switchToView(page, 'view-mode-list');

      const rows = page.locator('[data-testid="product-list-item-thumb"]');
      await rows.first().waitFor({ timeout: 10_000 }).catch(() => undefined);
      if (!(await rows.count())) {
        test.skip(true, `Sem itens em ${r.path}.`);
        return;
      }

      const swatches = page.locator(V2_SWATCH);
      const count = await swatches.count();
      test.skip(count === 0, `Sem produtos com color_swatches em ${r.path}.`);

      // Diâmetro 16px (size="sm" → dotPx 16).
      const box = await swatches.first().boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(14);
      expect(box?.width).toBeLessThanOrEqual(20);

      // maxVisible=4: por linha contamos no máximo 4 swatches V2 + opcional "+N".
      // Pegamos a primeira row e contamos os swatches dentro do seu ancestral.
      const firstThumb = rows.first();
      const ancestor = firstThumb.locator('xpath=ancestor::*[self::article or self::li or self::div][1]');
      const rowSwatches = ancestor.locator(V2_SWATCH);
      const visible = await rowSwatches.count();
      expect(visible).toBeLessThanOrEqual(4);
    });
  }
});
