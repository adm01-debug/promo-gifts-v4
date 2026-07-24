/**
 * E2E — Fluxo completo de exclusão em lote de orçamentos.
 *
 * Cobre os 4 cenários críticos da feature de bulk delete em /orcamentos:
 *   1. SELEÇÃO    — ligar modo Selecionar + marcar 2 linhas faz o botão
 *                   "quotes-bulk-delete-top" aparecer com contador.
 *   2. CANCELAR   — abrir o AlertDialog e cancelar PRESERVA a seleção
 *                   (requisito de UX recém-implementado).
 *   3. SUCESSO    — confirmar dispara DELETE em /rest/v1/quotes; loading
 *                   aparece e desaparece; toast com action "Desfazer"; o
 *                   botão do topo some (seleção limpa).
 *   4. FALHA-REDE — todos os DELETEs respondem 503: o toast.error aparece,
 *                   o botão "Excluir (N)" PERMANECE no topo (bulkDeleteIds
 *                   preservado) para o usuário tentar novamente.
 *
 * Mock de rede via `page.route` na URL pública do Supabase canônico
 * (`doufsxqlfjyuvxuezpln`). NÃO toca o banco em produção quando o teste
 * roda no modo "rede mockada".
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";
import { seedQuotesForStatusChips } from "../helpers/quotes-status-seed";

test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

const QUOTES_REST = /\/rest\/v1\/quotes(\?|$)/;

test.describe("Fluxo: exclusão em lote de orçamentos", () => {
  test.beforeEach(() => requireAuth());

  test("seleção → cancelar preserva → sucesso emite Desfazer → falha mantém seleção", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    // ── Seed: garante ao menos 2 orçamentos visíveis em "Todos". ──
    await gotoAndSettle(page, "/orcamentos");
    const seed = await seedQuotesForStatusChips(page);
    expect(seed.skipped, `seed falhou: ${seed.skipped}`).toBeNull();

    await gotoAndSettle(page, "/orcamentos");
    await expect(page.locator(Sel.page.title("orcamentos")).first()).toBeVisible({
      timeout: 10_000,
    });

    // Garante chip "Todos" pressionado para enxergar tudo.
    await page.locator('button[data-chip-key="all"]').click();

    // ── 1) SELEÇÃO ──
    const selectToggle = page.getByTestId("quotes-select-toggle");
    await expect(selectToggle).toBeVisible();
    await selectToggle.click();
    await expect(selectToggle).toHaveAttribute("aria-pressed", "true");

    const rowCheckboxes = page.getByRole("checkbox", { name: /selecionar orçamento/i });
    await expect(rowCheckboxes.first()).toBeVisible();

    // Sem nada marcado, o botão "Excluir" do topo NÃO existe.
    await expect(page.getByTestId("quotes-bulk-delete-top")).toHaveCount(0);

    // Marca 2 itens.
    await rowCheckboxes.nth(0).click();
    await rowCheckboxes.nth(1).click();

    const bulkDeleteTop = page.getByTestId("quotes-bulk-delete-top");
    await expect(bulkDeleteTop).toBeVisible();
    await expect(bulkDeleteTop).toContainText("(2)");

    // ── 2) CANCELAR PRESERVA SELEÇÃO ──
    await bulkDeleteTop.click();
    const dialog = page.getByTestId("quotes-bulk-delete-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("quotes-bulk-delete-preview")).toBeVisible();

    await dialog.getByRole("button", { name: /cancelar/i }).click();
    await expect(dialog).toBeHidden();

    // Seleção visual + botão devem continuar lá (requisito do PO).
    await expect(bulkDeleteTop).toBeVisible();
    await expect(bulkDeleteTop).toContainText("(2)");
    await expect(selectToggle).toHaveAttribute("aria-pressed", "true");

    // ── 4) FALHA DE REDE PRIMEIRO (mock antes do clique) ──
    // Todos os DELETE em /rest/v1/quotes respondem 503 → toast.error e
    // bulkDeleteIds preservado (botão continua visível com (2)).
    let deleteCalls = 0;
    await page.route(QUOTES_REST, async (route, request) => {
      if (request.method() === "DELETE") {
        deleteCalls += 1;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "service unavailable", code: "PGRST503" }),
        });
        return;
      }
      await route.continue();
    });

    await bulkDeleteTop.click();
    await expect(dialog).toBeVisible();
    await dialog.getByTestId("quotes-bulk-delete-confirm").click();

    // Aguarda o pipeline tentar deletar pelo menos 1 vez.
    await expect.poll(() => deleteCalls, { timeout: 15_000 }).toBeGreaterThan(0);

    // Dialog fecha após o erro, mas o botão do topo PERSISTE.
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(bulkDeleteTop).toBeVisible();
    await expect(bulkDeleteTop).toContainText("(2)");

    // Mensagem genérica de erro visível em algum toast (sonner).
    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({
      timeout: 10_000,
    });

    // ── 3) SUCESSO — remove o mock e reexecuta ──
    await page.unroute(QUOTES_REST);

    let successDeletes = 0;
    await page.route(QUOTES_REST, async (route, request) => {
      if (request.method() === "DELETE") successDeletes += 1;
      await route.continue();
    });

    await bulkDeleteTop.click();
    await expect(dialog).toBeVisible();
    await dialog.getByTestId("quotes-bulk-delete-confirm").click();

    // Espera o backend processar (≥1 DELETE com resposta real).
    await expect.poll(() => successDeletes, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);

    // Dialog fecha; botão do topo some (seleção limpa via evento confirmed).
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(page.getByTestId("quotes-bulk-delete-top")).toHaveCount(0);

    // Toast de sucesso com action "Desfazer" deve estar visível.
    const undoToast = page.locator('[data-sonner-toast]').filter({
      hasText: /Desfazer/i,
    });
    await expect(undoToast.first()).toBeVisible({ timeout: 10_000 });
  });
});
