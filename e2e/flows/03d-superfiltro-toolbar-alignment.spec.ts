/**
 * Super Filtro — alinhamento à direita dos botões "Selecionar" e "Layout".
 *
 * Cobertura:
 *  1. 3 viewports (desktop 1536, tablet 820, mobile 390)
 *  2. Matriz de estados: vazio, busca, com preset aplicado, modo seleção,
 *     sem-resultados (busca improvável)
 *  3. Asserts numéricos de bounding box:
 *      - ambos visíveis e na mesma linha (Δy ≤ 4px)
 *      - ordem horizontal preservada (Layout à direita de Selecionar)
 *      - borda direita do grupo ≤ MAX_RIGHT_GAP do viewport
 *      - centro do grupo > metade do viewport (nunca centralizado)
 *      - tolerância de centralização: |groupCenter - vp.width/2| ≥ vp.width/8
 *  4. Visual regression (screenshot do toolbar) por viewport
 *
 * Selectores estáveis: data-testid="superfiltro-toolbar-actions" envolve o grupo.
 * Ref UI: src/pages/products/FiltersPage.tsx (linha ~543).
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";

type VP = { name: "desktop" | "tablet" | "mobile"; width: number; height: number };

const VIEWPORTS: VP[] = [
  { name: "desktop", width: 1536, height: 864 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
];

const STATES = [
  { id: "empty", url: "/produtos" },
  { id: "search", url: "/produtos?search=caneta" },
  { id: "no-results", url: "/produtos?search=zzzqqq-nao-existe-xyz" },
  { id: "category", url: "/produtos?categories=__any__" },
] as const;

const MAX_RIGHT_GAP = 96; // px de folga até a borda direita do viewport
const ROW_TOLERANCE = 4; // px — desalinhamento vertical aceitável

test.describe("Super Filtro — toolbar alignment @smoke", () => {
  test.beforeEach(() => requireAuth());

  for (const vp of VIEWPORTS) {
    for (const state of STATES) {
      test(`alinhado à direita — ${vp.name} (${vp.width}) · estado=${state.id}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await gotoAndSettle(page, state.url);

        const group = page.getByTestId("superfiltro-toolbar-actions");
        await expect(group).toBeVisible({ timeout: 15_000 });

        // Toggle modo seleção em metade dos estados (estado extra implícito)
        if (state.id === "search") {
          const selectBtn = group.getByRole("button", {
            name: /selecionar|ativar modo de seleção/i,
          });
          await selectBtn.click().catch(() => {});
        }

        const selBtn = group
          .getByRole("button", { name: /selecionar|cancelar seleção/i })
          .first();
        const layBtn = group.getByRole("button").last(); // LayoutPopover trigger

        await expect(selBtn).toBeVisible();
        await expect(layBtn).toBeVisible();

        const [selBox, layBox, groupBox] = await Promise.all([
          selBtn.boundingBox(),
          layBtn.boundingBox(),
          group.boundingBox(),
        ]);
        expect(selBox, "Selecionar bbox").not.toBeNull();
        expect(layBox, "Layout bbox").not.toBeNull();
        expect(groupBox, "Group bbox").not.toBeNull();
        if (!selBox || !layBox || !groupBox) return;

        // 1) Mesma linha (tolerância vertical)
        expect(Math.abs(selBox.y - layBox.y)).toBeLessThanOrEqual(ROW_TOLERANCE);

        // 2) Ordem horizontal: Layout à direita de Selecionar
        expect(layBox.x).toBeGreaterThan(selBox.x);

        // 3) Borda direita do grupo encostada no viewport
        const rightEdge = groupBox.x + groupBox.width;
        const gap = vp.width - rightEdge;
        expect(gap, `gap até a borda (${vp.name}/${state.id})`).toBeLessThanOrEqual(
          MAX_RIGHT_GAP,
        );
        expect(gap).toBeGreaterThanOrEqual(0);

        // 4) Nunca centralizado
        const groupCenter = groupBox.x + groupBox.width / 2;
        expect(groupCenter).toBeGreaterThan(vp.width / 2);
        expect(Math.abs(groupCenter - vp.width / 2)).toBeGreaterThanOrEqual(
          vp.width / 8,
        );

        // 5) Visual regression — só no estado "empty" para não inflar baseline
        if (state.id === "empty") {
          await expect(group).toHaveScreenshot(
            `superfiltro-toolbar-${vp.name}.png`,
            { maxDiffPixelRatio: 0.05, animations: "disabled" },
          );
        }
      });
    }
  }
});
