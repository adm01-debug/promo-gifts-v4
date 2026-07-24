/**
 * Cobertura funcional + visual do <ColorSwatchPicker> V2 nas 4 rotas que
 * consomem o pipeline: /produtos, /filtros, /novidades, /reposicao.
 *
 * Valida:
 *   1. Tab-order: foco percorre os swatches V2 na ordem do DOM e segue para
 *      o próximo controle focável após o último swatch.
 *   2. Estado idle  → nenhum swatch com aria-pressed="true".
 *      Estado ativo → exatamente 1 com aria-pressed="true" + ring visível
 *      (outline OU box-shadow não-zero via `:focus-visible` ou classe ring).
 *   3. Abrir QuickView (clique no swatch) e fechar (Escape) restaura foco
 *      a um swatch focável; estado do picker preservado.
 *   4. Snapshot visual do QuickView com cor selecionada (regressão modal).
 *
 * Animações são congeladas globalmente para snapshots determinísticos.
 *
 * Flag canônica: `ff_useColorSwatchesV2=true` (ver src/lib/feature-flags.ts).
 */

import { test, expect, type Page, type Locator } from '@playwright/test';

const ROUTES = [
  { slug: 'catalogo',     path: '/produtos'  },
  { slug: 'super-filtro', path: '/filtros'   },
  { slug: 'novidades',    path: '/novidades' },
  { slug: 'reposicao',    path: '/reposicao' },
] as const;

// V2 picker: <button aria-pressed> com background inline; V1 usa role="radio".
const V2_SWATCH =
  'button[aria-pressed][title]:not([role="radio"])[style*="background-color"]';

const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0ms !important;
    animation-delay: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0ms !important;
    transition-delay: 0ms !important;
    scroll-behavior: auto !important;
  }
  /* Estabiliza caret e indicadores de foco padrão do user-agent. */
  *:focus { caret-color: transparent !important; }
`;

async function bootstrap(page: Page, path: string) {
  await page.addInitScript(() => {
    try { window.localStorage.setItem('ff_useColorSwatchesV2', 'true'); } catch {/* ignore */}
  });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: FREEZE_CSS });
}

async function firstPicker(page: Page): Promise<Locator | null> {
  const first = page.locator(V2_SWATCH).first();
  const ok = await first.waitFor({ state: 'visible', timeout: 20_000 }).then(() => true).catch(() => false);
  if (!ok) return null;
  return first.locator(
    'xpath=ancestor::div[contains(@class,"flex")][contains(@class,"flex-wrap")][1]'
  );
}

for (const route of ROUTES) {
  test.describe(`V2 ColorSwatchPicker • ${route.slug}`, () => {
    test(`${route.slug}: Tab-order + foco idle/ativo + QuickView`, async ({ page }) => {
      await bootstrap(page, route.path);

      const picker = await firstPicker(page);
      test.skip(picker === null, `Sem produtos com color_swatches em ${route.path}.`);
      const pickerEl = picker!;
      await pickerEl.scrollIntoViewIfNeeded();

      const swatches = pickerEl.locator(V2_SWATCH);
      const count = await swatches.count();
      expect(count, 'pelo menos 1 swatch V2 visível').toBeGreaterThan(0);

      // --- (1) Estado idle: nenhum aria-pressed="true" ---
      const pressedIdle = await swatches.evaluateAll(
        (els) => els.filter((e) => e.getAttribute('aria-pressed') === 'true').length
      );
      expect(pressedIdle, 'idle: 0 swatches pressed').toBe(0);

      // --- (2) Tab-order explícito ---
      // Foca o primeiro swatch programaticamente e tabula até o último,
      // validando a sequência por aria-label.
      const labels = await swatches.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
      await swatches.first().focus();
      for (let i = 0; i < count; i++) {
        const focusedLabel = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
        expect(focusedLabel, `tab[${i}] = swatch[${i}]`).toBe(labels[i]);
        if (i < count - 1) await page.keyboard.press('Tab');
      }
      // Após o último swatch, Tab DEVE sair do picker (focar outro elemento).
      await page.keyboard.press('Tab');
      const escapedPicker = await page.evaluate(
        (sel) => !document.activeElement?.matches(sel),
        V2_SWATCH
      );
      expect(escapedPicker, 'Tab após último swatch sai do picker').toBe(true);

      // --- (3) Estado ativo + ring visível ---
      const targetIdx = count >= 2 ? 1 : 0;
      const target = swatches.nth(targetIdx);
      const targetLabel = labels[targetIdx];
      await target.click();

      // QuickView abre — usa o seletor canônico do Radix Dialog.
      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 10_000 });

      // Fecha via Escape para validar restauração de foco.
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden({ timeout: 5_000 });

      // requestAnimationFrame x2 para Radix terminar o focus-return.
      await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

      // Foco restaurado em UM swatch V2 (idealmente o clicado).
      const focusBack = await page.evaluate(
        (sel) => document.activeElement?.matches(sel) ?? false,
        V2_SWATCH
      );
      expect(focusBack, 'foco volta para um swatch V2 após Escape').toBe(true);

      // aria-pressed="true" no swatch clicado + 1 e somente 1 ativo.
      const pressedCount = await swatches.evaluateAll(
        (els) => els.filter((e) => e.getAttribute('aria-pressed') === 'true').length
      );
      expect(pressedCount, 'exatamente 1 swatch ativo').toBe(1);
      await expect(target).toHaveAttribute('aria-pressed', 'true');
      await expect(target).toHaveAttribute('aria-label', targetLabel);

      // Ring visível: box-shadow OU outline não-zero (cobre `ring-*` Tailwind
      // e `:focus-visible` do user-agent).
      const hasRing = await target.evaluate((el) => {
        const cs = getComputedStyle(el);
        const shadow = cs.boxShadow && cs.boxShadow !== 'none';
        const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth || '0') > 0;
        return shadow || outline;
      });
      expect(hasRing, 'swatch ativo tem ring/outline visível').toBe(true);

      // --- (4) Snapshot do picker em estado ativo ---
      await expect(pickerEl).toHaveScreenshot(
        `v2-picker-${route.slug}-active-focused.png`,
        { maxDiffPixelRatio: 0.02, animations: 'disabled' }
      );

      // --- (5) Snapshot do QuickView com cor selecionada ---
      // Reabre clicando no mesmo swatch (foco já está nele).
      await page.keyboard.press('Enter');
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      // Estabilização: aguarda imagem do dialog assentar.
      await page.waitForTimeout(200);
      await expect(dialog).toHaveScreenshot(
        `v2-quickview-${route.slug}-color-active.png`,
        { maxDiffPixelRatio: 0.03, animations: 'disabled' }
      );
    });
  });
}
