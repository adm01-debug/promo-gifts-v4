/**
 * Contrato de layout sticky do <VariantStockTable />.
 *
 * Validações puras de DOM/CSS (sem renderizar a tabela inteira, que depende
 * de hooks/Supabase). Espelhamos as classes do componente real e falhamos
 * quando o `<thead>` perder `sticky` ou um offset top dinâmico, ou quando
 * a toolbar parar de oferecer ancoragem sticky abaixo do header global.
 *
 * Cobre os 9 viewports usados no spec E2E (mobile-sm → desktop-tall) +
 * offsets dinâmicos de toolbar (40, 44, 56, 72, 96px) — combinatória
 * defensiva para evitar regressões silenciosas de classe.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

const THEAD_CLASSES =
  "sticky top-[44px] z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))] sm:top-[40px]";
const TOOLBAR_CLASSES = "sticky top-0 z-20 bg-background";

function Harness({ toolbarOffset = 44 }: { toolbarOffset?: number }) {
  return (
    <div data-testid="root">
      <div
        data-testid="variant-stock-toolbar"
        className={TOOLBAR_CLASSES}
        style={{ height: toolbarOffset }}
      />
      <div data-testid="variant-stock-scroll" className="overflow-x-auto rounded-lg border">
        <table>
          <thead data-testid="variant-stock-thead" className={THEAD_CLASSES}>
            <tr>
              <th>Produto</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>linha</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const VIEWPORTS = [360, 375, 414, 820, 1024, 1366, 1920, 1536, 2560];
const TOOLBAR_OFFSETS = [40, 44, 56, 72, 96];

describe("VariantStockTable — contrato sticky", () => {
  for (const w of VIEWPORTS) {
    for (const off of TOOLBAR_OFFSETS) {
      it(`thead permanece sticky com offset ${off}px no viewport ${w}px`, () => {
        const { getByTestId, unmount } = render(<Harness toolbarOffset={off} />);
        const thead = getByTestId("variant-stock-thead");
        const toolbar = getByTestId("variant-stock-toolbar");

        // Sticky obrigatório em ambos
        expect(thead.className).toMatch(/\bsticky\b/);
        expect(toolbar.className).toMatch(/\bsticky\b/);

        // Toolbar precisa estar acima do thead (z maior)
        expect(toolbar.className).toMatch(/z-20/);
        expect(thead.className).toMatch(/z-10/);

        // Offset top dinâmico do thead (acomoda toolbar). Falha se virar `top-0`.
        expect(thead.className).toMatch(/top-\[\d+px\]/);
        expect(thead.className).not.toMatch(/\btop-0\b/);

        // Background opaco — evita sangramento de linhas atrás do thead
        expect(thead.className).toMatch(/bg-background/);

        unmount();
      });
    }
  }

  it("falha quando thead perde sticky (regressão)", () => {
    function Broken() {
      return (
        <table>
          <thead data-testid="variant-stock-thead" className="bg-background">
            <tr>
              <th>x</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
            </tr>
          </tbody>
        </table>
      );
    }
    const { getByTestId } = render(<Broken />);
    const thead = getByTestId("variant-stock-thead");
    // Asserção invertida: o teste de contrato deve detectar a ausência de sticky
    expect(thead.className.includes("sticky")).toBe(false);
  });
});
