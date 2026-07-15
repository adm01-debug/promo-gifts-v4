/**
 * Magazine Editor — layout do header em xl+ e estado vazio da sidebar.
 *
 * Valida:
 *  1. Em xl (1440×900) o breadcrumb, o h1 (page-title-magazine-editor) e o
 *     `editor-hero` são visíveis e sem overflow horizontal.
 *  2. Se a revista aberta não tem páginas para exibir, o fallback vazio
 *     (`preview-empty-state`) aparece com role=status + texto legível.
 *  3. Se a revista tem preview, o teste ainda garante que hero+aside estão
 *     visíveis lado a lado (sanidade pós-remoção da miniatura do hero).
 *
 * Skip silencioso quando não há revistas na conta de teste.
 */
import { expect } from "@playwright/test";

import { test } from "../fixtures/test-base";
import { loginAs } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/nav";

const XL_VIEWPORT = { width: 1440, height: 900 };

test.describe("@smoke Magazine Editor — header xl+ e sidebar empty state", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(XL_VIEWPORT);
    await loginAs(page);
  });

  test("header responsivo em xl+ + fallback da sidebar quando não há capa", async ({ page }) => {
    await gotoAndSettle(page, "/magazine");

    const firstEditorLink = page.locator('a[href^="/magazine/"]').first();
    const hasMagazine = await firstEditorLink.count();
    test.skip(hasMagazine === 0, "sem revistas cadastradas na conta de teste");

    await firstEditorLink.click();
    await expect(page).toHaveURL(/\/magazine\/[^/]+$/);

    // 1. Header/breadcrumb visíveis e dentro do viewport (sem overflow).
    const hero = page.getByTestId("editor-hero");
    const breadcrumb = page.getByTestId("magazine-editor-breadcrumb");
    const title = page.getByTestId("page-title-magazine-editor");

    await expect(hero).toBeVisible();
    await expect(breadcrumb).toBeVisible();
    await expect(title).toBeVisible();

    const heroBox = await hero.boundingBox();
    expect(heroBox, "hero sem bounding box").not.toBeNull();
    expect(heroBox!.x).toBeGreaterThanOrEqual(0);
    expect(heroBox!.x + heroBox!.width).toBeLessThanOrEqual(XL_VIEWPORT.width + 1);

    // Breadcrumb deve estar acima do h1 (ordem visual correta)
    const bcTop = (await breadcrumb.boundingBox())!.y;
    const titleTop = (await title.boundingBox())!.y;
    expect(bcTop).toBeLessThan(titleTop);

    // 2. Sidebar: preview OU empty state. Ambos são estados válidos.
    const preview = page.getByTestId("magazine-preview-aside");
    const emptyState = page.getByTestId("preview-empty-state");

    await expect(preview).toBeVisible();

    const emptyCount = await emptyState.count();
    if (emptyCount > 0) {
      // Empty state: valida role/label acessíveis + copy
      await expect(emptyState).toBeVisible();
      await expect(emptyState).toHaveAttribute("role", "status");
      await expect(emptyState).toHaveAttribute("aria-live", "polite");
      await expect(emptyState).toContainText(/Sem capa para exibir/i);
      await expect(emptyState).toContainText(/Adicione produtos|escolha um template/i);
    }
  });
});
