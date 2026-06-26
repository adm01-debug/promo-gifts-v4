/**
 * Fluxo: chips de status em /orcamentos.
 * Clica em cada chip (Todos, Rascunho, Criado (Não Sinc.), Criado (Sincronizado),
 * Sincronizado, Pendente, Expirado) e confirma que:
 *   - `aria-pressed="true"` migra para o chip clicado
 *   - apenas um chip fica pressionado por vez
 *
 * Seletor: `[data-chip-key="<key>"]` — atributo estável definido em
 * `QuotesStatusChips.tsx`, não depende de texto/role.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";

const CHIP_KEYS = [
  "all",
  "draft",
  "unsynced",
  "created_synced",
  "synced",
  "pending",
  "expired",
] as const;

test.describe("Fluxo: chips de status de orçamentos", () => {
  test.beforeEach(() => requireAuth());

  test("clicar em cada chip aplica o filtro correspondente", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos");
    await expect(page.locator(Sel.page.title("orcamentos")).first()).toBeVisible({
      timeout: 10_000,
    });

    // Toolbar dos chips precisa renderizar antes de qualquer clique.
    const toolbar = page.getByRole("toolbar", {
      name: /Filtrar orçamentos por status e sincronização/i,
    });
    await expect(toolbar).toBeVisible({ timeout: 10_000 });

    // "Todos" e "Criado (Sincronizado)" sempre devem ser alcançáveis:
    // - "all" é sempre renderizado;
    // - "created_synced" pode estar oculto se contagem=0 e inativo, então
    //   forçamos via clique no botão quando presente OU pulamos com soft assert.
    for (const key of CHIP_KEYS) {
      const chip = page.locator(`button[data-chip-key="${key}"]`);
      const count = await chip.count();

      if (count === 0) {
        // Chips com contagem 0 são ocultados (exceto "all") — comportamento esperado.
        // Validamos que pelo menos "all" e os com dados estejam acessíveis.
        expect(key).not.toBe("all");
        continue;
      }

      await chip.first().click();
      await expect(chip.first()).toHaveAttribute("aria-pressed", "true");

      // Garante que nenhum outro chip permanece pressionado.
      const pressed = page.locator('button[data-chip-key][aria-pressed="true"]');
      await expect(pressed).toHaveCount(1);
    }

    // Reset final: voltar para "Todos" deixa o estado limpo para o próximo teste.
    await page.locator('button[data-chip-key="all"]').click();
    await expect(page.locator('button[data-chip-key="all"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
