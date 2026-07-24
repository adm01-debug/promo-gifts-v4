/**
 * Magazine Editor — Header/breadcrumb responsivo + regressão visual.
 *
 * Cobre 3 viewports (sm 640, md 820, xl 1440) validando:
 *
 *  - Hero + breadcrumb + h1 visíveis, breadcrumb acima do h1.
 *  - Sem scroll horizontal na página (scrollWidth ≤ innerWidth + 1).
 *  - Breadcrumb e (quando presente) empty state não estouram do viewport.
 *  - Em xl+: aside da sidebar visível (`magazine-preview-aside`) e, se
 *    aplicável, `preview-empty-state` com role/aria corretos.
 *  - Em sm/md: aside oculto; botão "Preview" abre um `Sheet` com o
 *    `PreviewSidebar` interno (drawer variant).
 *  - Regressão visual: screenshot do hero em xl+ e (quando presente)
 *    do empty state — snapshots por viewport, com CSS de animação
 *    congelado para reduzir flake.
 *
 * Atualizar baselines: `npx playwright test e2e/flows/magazine-header-responsive.spec.ts --update-snapshots`
 * Skip silencioso se a conta de teste não tem revistas cadastradas.
 */
import { test, expect, type Page } from "../fixtures/test-base";
import { loginAs } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/nav";

const VIEWPORTS = [
  { name: "sm", width: 640, height: 900 },
  { name: "md", width: 820, height: 1180 },
  { name: "xl", width: 1440, height: 900 },
] as const;

// Congela animações/cursores para snapshots estáveis
const FREEZE_CSS = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
    caret-color: transparent !important;
  }
`;

async function openFirstEditor(page: Page): Promise<boolean> {
  await gotoAndSettle(page, "/magazine");
  const firstEditorLink = page.locator('a[href^="/magazine/"]').first();
  const hasMagazine = await firstEditorLink.count();
  if (hasMagazine === 0) return false;
  await firstEditorLink.click();
  await expect(page).toHaveURL(/\/magazine\/[^/]+$/);
  await page.addStyleTag({ content: FREEZE_CSS });
  await expect(page.getByTestId("editor-hero")).toBeVisible({ timeout: 15_000 });
  // Estabilização de snapshot: aguarda fonts e rede quiescente para reduzir flake
  // no FOUT do Outfit e assets async.
  await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready);
  await page.waitForLoadState("networkidle").catch(() => {});
  return true;
}

test.describe("@smoke Magazine Editor — header responsivo + regressão visual", () => {
  for (const vp of VIEWPORTS) {
    test.describe(`viewport ${vp.name}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await loginAs(page);
      });

      test(`hero/breadcrumb sem overflow e ordem visual correta (${vp.name})`, async ({ page }) => {
        const opened = await openFirstEditor(page);
        test.skip(!opened, "sem revistas cadastradas na conta de teste");

        const hero = page.getByTestId("editor-hero");
        const breadcrumb = page.getByTestId("magazine-editor-breadcrumb");
        const title = page.getByTestId("page-title-magazine-editor");

        await expect(hero).toBeVisible();
        await expect(breadcrumb).toBeVisible();
        await expect(title).toBeVisible();

        // Sem scroll horizontal na página
        const overflowsX = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1,
        );
        expect(overflowsX, `scroll horizontal detectado em ${vp.name}`).toBe(false);

        // Hero dentro do viewport
        const heroBox = (await hero.boundingBox())!;
        expect(heroBox.x).toBeGreaterThanOrEqual(-1);
        expect(heroBox.x + heroBox.width).toBeLessThanOrEqual(vp.width + 1);

        // Breadcrumb inteiro dentro do viewport
        const bcBox = (await breadcrumb.boundingBox())!;
        expect(bcBox.x).toBeGreaterThanOrEqual(-1);
        expect(bcBox.x + bcBox.width).toBeLessThanOrEqual(vp.width + 1);

        // Breadcrumb visualmente acima do título
        expect(bcBox.y).toBeLessThan((await title.boundingBox())!.y);
      });

      test(`sidebar preview: aside em xl, drawer em sm/md (${vp.name})`, async ({ page }) => {
        const opened = await openFirstEditor(page);
        test.skip(!opened, "sem revistas cadastradas na conta de teste");

        const aside = page.getByTestId("magazine-preview-aside");
        const drawerTrigger = page.getByRole("button", { name: /^Preview$/ });

        if (vp.name === "xl") {
          await expect(aside).toBeVisible();
        } else {
          // Abaixo de xl o aside está `hidden`; o drawer é a via de acesso.
          await expect(aside).toBeHidden();
          await expect(drawerTrigger).toBeVisible();
          await drawerTrigger.click();

          // Após abrir o Sheet, o PreviewSidebar (variant drawer) renderiza
          // com o próprio testid `magazine-preview-aside` NÃO — ele é wrapper
          // externo do aside. Basta verificar o conteúdo interno do Sheet.
          await expect(page.getByRole("dialog")).toBeVisible();
        }
      });

      test(`empty state da sidebar quando não há capa (${vp.name})`, async ({ page }) => {
        const opened = await openFirstEditor(page);
        test.skip(!opened, "sem revistas cadastradas na conta de teste");

        // xl: aside sempre montado; sm/md: precisamos abrir o drawer.
        if (vp.name !== "xl") {
          const drawerTrigger = page.getByRole("button", { name: /^Preview$/ });
          await drawerTrigger.click();
          await expect(page.getByRole("dialog")).toBeVisible();
        }

        const emptyState = page.getByTestId("preview-empty-state");
        const emptyCount = await emptyState.count();
        test.skip(
          emptyCount === 0,
          "revista aberta tem páginas — empty state não aplicável neste ambiente",
        );

        const anchor = emptyState.first();
        await expect(anchor).toBeVisible();
        await expect(anchor).toHaveAttribute("role", "status");
        await expect(anchor).toHaveAttribute("aria-live", "polite");
        await expect(anchor).toContainText(/Sem capa para exibir/i);

        // Empty state cabe no viewport (sem overflow)
        const box = (await anchor.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
      });
    });
  }

  test("regressão visual — hero xl e empty state (quando aplicável)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page);
    const opened = await openFirstEditor(page);
    test.skip(!opened, "sem revistas cadastradas na conta de teste");

    await expect(page.getByTestId("editor-hero")).toHaveScreenshot("magazine-editor-hero-xl.png", {
      maxDiffPixelRatio: 0.02,
    });

    const emptyState = page.getByTestId("preview-empty-state");
    if ((await emptyState.count()) > 0) {
      await expect(emptyState.first()).toHaveScreenshot(
        "magazine-preview-empty-state-xl.png",
        { maxDiffPixelRatio: 0.02 },
      );
    }
  });
});
