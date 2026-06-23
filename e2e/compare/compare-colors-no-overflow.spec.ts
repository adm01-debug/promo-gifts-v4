/**
 * E2E — /comparar
 *
 * Invariante de UI: a coluna "Cores" do comparador (CompareTableView em
 * desktop e ComparisonMobileView em mobile) DEVE renderizar uma bolinha
 * para cada cor disponível — SEM chip de overflow `+N`.
 *
 * Vendedores precisam ver TODAS as cores no comparador; esconder atrás
 * de "+N" derrota o propósito.
 *
 * Seletores estáveis (resistentes a mudanças de layout):
 *   - `[data-testid="compare-colors-cell"]` — container da célula de cores
 *   - `[data-colors-count="N"]`             — contagem esperada (atributo)
 *   - `[data-testid="compare-color-dot"]`   — cada bolinha individual
 *   - `aria-label="N cores"`                — fonte de verdade acessível
 *
 * O spec passa em estado vazio (CompareEmptyStateSmart) — não há células
 * de cores nem chips, então o invariante segue válido.
 */
import { test, expect, type Page } from "@playwright/test";

const PLUS_N_REGEX = /^\s*\+\d+\s*$/;

async function gotoCompare(page: Page) {
  await page.goto("/comparar", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {/* best-effort */});
  await expect(page).not.toHaveURL(/\/login/);
}

async function assertNoOverflowChip(page: Page) {
  // Invariante negativo global: nenhum chip "+N" em lugar algum da página
  // de comparação (cobre desktop e mobile, presentation e duel views).
  await expect(page.getByText(PLUS_N_REGEX)).toHaveCount(0);
}

async function assertDotsMatchCount(page: Page) {
  const cells = page.locator('[data-testid="compare-colors-cell"]');
  const total = await cells.count();
  for (let i = 0; i < total; i++) {
    const cell = cells.nth(i);
    const expected = Number(await cell.getAttribute("data-colors-count"));
    if (!Number.isFinite(expected) || expected === 0) continue;

    const dots = cell.locator('[data-testid="compare-color-dot"]');
    await expect(
      dots,
      `cell #${i} esperava ${expected} bolinhas (data-colors-count)`,
    ).toHaveCount(expected);
  }
}

test.describe("/comparar — coluna Cores: bolinha por cor, sem +N", () => {
  test("desktop (CompareTableView)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoCompare(page);
    await assertNoOverflowChip(page);
    await assertDotsMatchCount(page);
  });

  test("mobile (ComparisonMobileView)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoCompare(page);
    await assertNoOverflowChip(page);
    await assertDotsMatchCount(page);
  });
});
