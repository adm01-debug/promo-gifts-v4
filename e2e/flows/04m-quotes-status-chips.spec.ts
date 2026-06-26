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
import { seedQuotesForStatusChips } from "../helpers/quotes-status-seed";

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
    // Hidrata sessão para o seed ler o JWT do localStorage.
    await gotoAndSettle(page, "/orcamentos");

    // Seed determinístico: garante ≥1 quote em cada chip alvo.
    const seed = await seedQuotesForStatusChips(page);
    expect(seed.skipped, `seed falhou: ${seed.skipped}`).toBeNull();

    // Recarrega para a lista refletir os recém-criados.
    await gotoAndSettle(page, "/orcamentos");
    await expect(page.locator(Sel.page.title("orcamentos")).first()).toBeVisible({
      timeout: 10_000,
    });


    // Toolbar dos chips precisa renderizar antes de qualquer clique.
    const toolbar = page.getByRole("toolbar", {
      name: /Filtrar orçamentos por status e sincronização/i,
    });
    await expect(toolbar).toBeVisible({ timeout: 10_000 });

    // Com o seed determinístico, TODOS os 7 chips devem estar visíveis.
    for (const key of CHIP_KEYS) {
      const chip = page.locator(`button[data-chip-key="${key}"]`);
      await expect(chip, `chip ${key} deveria estar visível após seed`).toHaveCount(1);

      await chip.click();
      await expect(chip).toHaveAttribute("aria-pressed", "true");

      // Exclusividade: apenas o chip clicado fica pressionado.
      const pressed = page.locator('button[data-chip-key][aria-pressed="true"]');
      await expect(pressed).toHaveCount(1);
    }


    // Reset final: voltar para "Todos" deixa o estado limpo para o próximo teste.
    await page.locator('button[data-chip-key="all"]').click();
    await expect(page.locator('button[data-chip-key="all"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // ── Contrato do botão "Selecionar" ──
    // Checkboxes/círculos de seleção NÃO podem existir antes do clique.
    const selectToggle = page.getByTestId("quotes-select-toggle");
    await expect(selectToggle).toBeVisible();
    await expect(selectToggle).toHaveAttribute("aria-pressed", "false");
    await expect(selectToggle).toHaveText(/Selecionar/);

    const rowCheckboxesBefore = page.getByRole("checkbox", {
      name: /selecionar orçamento/i,
    });
    await expect(rowCheckboxesBefore).toHaveCount(0);

    // Liga o modo: checkboxes aparecem mas NADA é marcado automaticamente.
    await selectToggle.click();
    await expect(selectToggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("quotes-selection-hint")).toHaveCount(0);
    const rowCheckboxesAfter = page.getByRole("checkbox", {
      name: /selecionar orçamento/i,
    });
    await expect(rowCheckboxesAfter.first()).toBeVisible();
    // Nenhum checkbox de linha pode estar marcado após apenas ligar o modo.
    const checked = page.locator(
      'input[type="checkbox"][aria-label*="Selecionar orçamento"][data-state="checked"]',
    );
    await expect(checked).toHaveCount(0);

    // Sem seleção, o botão "Excluir" do topo NÃO existe.
    await expect(page.getByTestId("quotes-bulk-delete-top")).toHaveCount(0);

    // Marca o primeiro item manualmente → "Excluir" aparece no topo, ao lado
    // do toggle, e a barra inferior (BulkActionsBar) permanece ausente.
    await rowCheckboxesAfter.first().click();
    const bulkDeleteTop = page.getByTestId("quotes-bulk-delete-top");
    await expect(bulkDeleteTop).toBeVisible();
    await expect(bulkDeleteTop).toContainText(/Excluir/);
    // Garante que não existe BulkActionsBar antigo embaixo da lista.
    await expect(
      page.locator('text=/^\\d+\\s+orçamento(s)?\\s+selecionado/i'),
    ).toHaveCount(0);

    // Desmarca para o teardown do toggle abaixo.
    await rowCheckboxesAfter.first().click();


    // Desliga: checkboxes somem novamente.
    await selectToggle.click();
    await expect(selectToggle).toHaveAttribute("aria-pressed", "false");
    await expect(rowCheckboxesBefore).toHaveCount(0);
  });
});
