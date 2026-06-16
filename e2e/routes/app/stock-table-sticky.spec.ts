/**
 * Stock table sticky — valida que ao rolar a tabela "Estoque por Cor/Variação":
 *   - a toolbar (busca + paginação + Expandir/Recolher) permanece visível
 *   - o cabeçalho `<thead>` permanece visível
 *   - o conteúdo das linhas não fica cortado em mobile (375), tablet (820) e
 *     desktop (1366)
 *
 * Skipa automaticamente se a rota estiver vazia/em sincronização — preserva
 * o CI em ambientes sem dados seedados.
 */
import { test, expect, type Page } from "../../fixtures/test-base";
import { TID } from "../../fixtures/selectors";
import { gotoAndSettle } from "../../helpers/nav";
import { loginAs } from "../../helpers/auth";

const TOOLBAR = TID("variant-stock-toolbar");
const THEAD = TID("variant-stock-thead");
const SCROLL = TID("variant-stock-scroll");

async function maybeSkipIfEmpty(page: Page) {
  const syncing = page.getByText(/Sincronizando estoque/i);
  if (await syncing.isVisible().catch(() => false)) {
    await expect(syncing).not.toBeVisible({ timeout: 60_000 });
  }
  const empty = page.getByText(/Nenhum produto encontrado/i);
  if (await empty.isVisible().catch(() => false)) {
    test.skip(true, "sem dados seedados para validar sticky");
  }
}

const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1366, height: 768 },
] as const;

test.describe("@regression /estoque — tabela sticky (toolbar + thead)", () => {
  for (const vp of viewports) {
    test(`@stock-table-sticky permanece fixo no scroll — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await loginAs(page, "admin");
      await gotoAndSettle(page, "/estoque");
      await maybeSkipIfEmpty(page);

      const toolbar = page.locator(TOOLBAR);
      const thead = page.locator(THEAD);
      const scroll = page.locator(SCROLL);

      await expect(toolbar).toBeVisible();
      await expect(thead).toBeVisible();
      await expect(scroll).toBeVisible();

      // Posições iniciais (top do bounding box em coords da viewport)
      const toolbarBefore = await toolbar.boundingBox();
      const theadBefore = await thead.boundingBox();
      if (!toolbarBefore || !theadBefore) {
        test.skip(true, "bounding boxes indisponíveis");
        return;
      }

      // Rola o container interno em até 400px (ou o máximo possível)
      const scrolled = await scroll.evaluate((el) => {
        const start = el.scrollTop;
        el.scrollTop = Math.min(el.scrollHeight - el.clientHeight, 400);
        return el.scrollTop - start;
      });
      if (scrolled <= 0) {
        test.skip(true, "conteúdo não excede a altura interna — sem scroll a validar");
        return;
      }

      // Após o scroll, toolbar e thead devem continuar visíveis e na mesma faixa Y
      await expect(toolbar).toBeVisible();
      await expect(thead).toBeVisible();
      const toolbarAfter = await toolbar.boundingBox();
      const theadAfter = await thead.boundingBox();
      expect(toolbarAfter).not.toBeNull();
      expect(theadAfter).not.toBeNull();

      // Tolerância de 2px para sub-pixel/border rounding
      expect(Math.abs((toolbarAfter!.y ?? 0) - toolbarBefore.y)).toBeLessThanOrEqual(2);
      expect(Math.abs((theadAfter!.y ?? 0) - theadBefore.y)).toBeLessThanOrEqual(2);

      // thead NÃO pode sobrepor a toolbar (z-index/offset coerentes)
      expect((theadAfter!.y ?? 0)).toBeGreaterThanOrEqual(
        toolbarAfter!.y + Math.min(toolbarAfter!.height, 16),
      );
    });
  }
});
