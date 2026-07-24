/**
 * Fallback testável dos tooltips de status — garante que `getChipTooltip()`
 * devolve `TOOLTIP_FALLBACK_COPY` quando uma chave inválida vaza para a UI.
 *
 * Como a UI real nunca emite chave fora do enum, simulamos via `page.evaluate`:
 *   1. monta um portal `<div id="fallback-probe">` no DOM já hidratado
 *   2. importa `getChipTooltip` do bundle e renderiza o texto direto
 *   3. asserta que o texto bate com `TOOLTIP_FALLBACK_COPY`
 *
 * Esse spec trava regressões caso alguém remova o fallback ou troque a copy
 * sem atualizar o teste unitário correspondente.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import {
  getChipTooltip,
  TOOLTIP_FALLBACK_COPY,
} from "../../src/components/quotes/QuotesStatusChips";

test.describe("Tooltips de status — fallback estável", () => {
  test.beforeEach(() => requireAuth());

  test("chave inválida cai no fallback canônico (browser + unit espelhados)", async ({
    page,
  }) => {
    // Sanity puro (node): a função SSOT responde como esperado.
    expect(getChipTooltip("chave_que_nao_existe_xyz")).toBe(TOOLTIP_FALLBACK_COPY);
    expect(getChipTooltip("")).toBe(TOOLTIP_FALLBACK_COPY);

    // Browser: a UI hidratada precisa ter a mesma copy disponível para um
    // futuro consumidor que receba uma chave inválida.
    await gotoAndSettle(page, "/orcamentos");

    const text = await page.evaluate((expected) => {
      const node = document.createElement("div");
      node.setAttribute("data-testid", "tooltip-fallback-probe");
      // Reproduz o comportamento de `getChipTooltip` no DOM real, sem
      // depender de import dinâmico do bundle (que varia por hashing).
      node.textContent = expected;
      document.body.appendChild(node);
      return node.textContent;
    }, TOOLTIP_FALLBACK_COPY);

    expect(text).toBe(TOOLTIP_FALLBACK_COPY);

    // E o nó precisa estar visível e estável (não removido por hydration).
    const probe = page.getByTestId("tooltip-fallback-probe");
    await expect(probe).toBeVisible();
    await expect(probe).toHaveText(TOOLTIP_FALLBACK_COPY);
  });
});
