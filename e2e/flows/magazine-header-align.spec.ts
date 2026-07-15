/**
 * Magazine Editor — alinhamento vertical do cluster "Salvo / PDF / Publicar"
 * com o botão "Trocar template" (SSOT `EditorHero`).
 *
 * Contexto:
 *  Onda "align-buttons" — a coluna direita passou de `lg:pt-1` para `lg:pt-7`
 *  para descer os botões e alinhá-los à linha do "Trocar template" (que fica
 *  ao lado do h1 dentro de `EditorHero`).
 *
 * Cobertura:
 *  - lg (1024), xl (1440), 2xl (1920): |Δ center-Y| entre "Publicar" e
 *    "Trocar template" ≤ 8px, mesma banda para "PDF" e "Salvo".
 *  - Resiliência a texto longo: injeta um h1 gigante via DOM e reavalia o
 *    alinhamento (o botão deve continuar na mesma linha do "Trocar template",
 *    independente do wrap do título).
 *  - < lg (md 820): o cluster empilha (não está mais na mesma linha do
 *    breadcrumb) e nada estoura horizontalmente.
 *  - Regressão visual do header (viewport 1440) — snapshot congelado.
 *
 * Skip silencioso se a conta de teste não tem revistas cadastradas.
 * Atualizar baseline visual:
 *   npx playwright test e2e/flows/magazine-header-align.spec.ts --update-snapshots
 */
import { test, expect, type Page } from "../fixtures/test-base";
import { loginAs } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/nav";

const FREEZE_CSS = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
    caret-color: transparent !important;
  }
`;

const CENTER_TOLERANCE_PX = 8;

async function openFirstEditor(page: Page): Promise<boolean> {
  await gotoAndSettle(page, "/magazine");
  const firstEditorLink = page.locator('a[href^="/magazine/"]').first();
  if ((await firstEditorLink.count()) === 0) return false;
  await firstEditorLink.click();
  await expect(page).toHaveURL(/\/magazine\/[^/]+$/);
  await page.addStyleTag({ content: FREEZE_CSS });
  await expect(page.getByTestId("page-title-magazine-editor")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId("magazine-template-swap-trigger")).toBeVisible();
  await page
    .evaluate(() =>
      (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready,
    )
    .catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  return true;
}

async function centerY(page: Page, locator: ReturnType<Page["locator"]>) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("bounding box indisponível");
  return box.y + box.height / 2;
}

type Btn = "Salvo" | "Salvando" | "PDF" | "Publicar";

function rightColButton(page: Page, name: Btn) {
  if (name === "Salvo" || name === "Salvando") {
    // "Salvo" é <span role="status">, não um botão.
    return page.getByRole("status").filter({ hasText: /Salv(o|ando)/ }).first();
  }
  return page.getByRole("button", { name: new RegExp(`^${name}$`) }).first();
}

test.describe("@smoke Magazine Editor — alinhamento Salvo/PDF/Publicar × Trocar template", () => {
  for (const vp of [
    { name: "lg", width: 1024, height: 900 },
    { name: "xl", width: 1440, height: 900 },
    { name: "2xl", width: 1920, height: 919 },
  ] as const) {
    test(`cluster direito alinhado ao "Trocar template" (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await loginAs(page);
      const opened = await openFirstEditor(page);
      test.skip(!opened, "sem revistas cadastradas na conta de teste");

      const trigger = page.getByTestId("magazine-template-swap-trigger");
      const publicar = rightColButton(page, "Publicar");
      const pdf = rightColButton(page, "PDF");
      const savedStatus = rightColButton(page, "Salvo");

      await expect(trigger).toBeVisible();
      await expect(publicar).toBeVisible();
      await expect(pdf).toBeVisible();

      const triggerY = await centerY(page, trigger);
      const publicarY = await centerY(page, publicar);
      const pdfY = await centerY(page, pdf);

      expect(
        Math.abs(triggerY - publicarY),
        `Publicar desalinhado do Trocar template em ${vp.name} (${Math.abs(triggerY - publicarY).toFixed(1)}px)`,
      ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);

      expect(
        Math.abs(triggerY - pdfY),
        `PDF desalinhado do Trocar template em ${vp.name}`,
      ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);

      // Se o status "Salvo/Salvando" existir, também alinha.
      if ((await savedStatus.count()) > 0) {
        const savedY = await centerY(page, savedStatus);
        expect(
          Math.abs(triggerY - savedY),
          `Status Salvo/Salvando desalinhado do Trocar template em ${vp.name}`,
        ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
      }
    });
  }

  test("resiliente a título longo (1440 xl)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page);
    const opened = await openFirstEditor(page);
    test.skip(!opened, "sem revistas cadastradas na conta de teste");

    // Simula título muito longo (i18n com strings compridas / user input).
    await page.getByTestId("page-title-magazine-editor").evaluate((el) => {
      el.textContent =
        "Título extremamente longo para simular idiomas verbosos e nomes reais compridos de revistas corporativas — teste de wrap";
    });
    // Deixa o layout reagir ao reflow.
    await page.waitForTimeout(150);

    const trigger = page.getByTestId("magazine-template-swap-trigger");
    const publicar = rightColButton(page, "Publicar");
    const triggerY = await centerY(page, trigger);
    const publicarY = await centerY(page, publicar);

    // Com wrap do h1 o "Trocar template" pode descer uma linha; o cluster
    // direito continua em sua própria coluna e a diferença NÃO deve crescer
    // além do gap semântico (1 linha ≈ 40px).
    expect(
      Math.abs(triggerY - publicarY),
      `Alinhamento quebra com título longo (${Math.abs(triggerY - publicarY).toFixed(1)}px)`,
    ).toBeLessThanOrEqual(40);
  });

  test("< lg: cluster empilha sem overflow (md 820)", async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await loginAs(page);
    const opened = await openFirstEditor(page);
    test.skip(!opened, "sem revistas cadastradas na conta de teste");

    const overflowsX = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflowsX, "scroll horizontal indevido em md").toBe(false);

    const trigger = page.getByTestId("magazine-template-swap-trigger");
    const publicar = rightColButton(page, "Publicar");
    const triggerBox = (await trigger.boundingBox())!;
    const publicarBox = (await publicar.boundingBox())!;

    // Em < lg a coluna direita empilha abaixo do hero → publicar.y > trigger.y
    expect(publicarBox.y).toBeGreaterThan(triggerBox.y);
  });

  test("regressão visual do header em 1440", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page);
    const opened = await openFirstEditor(page);
    test.skip(!opened, "sem revistas cadastradas na conta de teste");

    const heroRow = page.getByTestId("magazine-editor-hero-row");
    await expect(heroRow).toBeVisible();
    await expect(heroRow).toHaveScreenshot("magazine-editor-hero-row-xl.png", {
      maxDiffPixelRatio: 0.02,
    });
  });
});
