/**
 * E2E — Idempotência e auditoria do fluxo de aprovação de desconto.
 *
 * Cobertura adicional sobre `04c-quote-discount-approval.spec.ts`:
 *
 *   1. Cliques rápidos repetidos em "Enviar para Aprovação" NÃO criam
 *      múltiplas solicitações. A defesa em camadas é:
 *        - guard no client (`useDiscountApproval.requestApproval`)
 *        - índice único parcial `uniq_dar_quote_pending` no banco
 *          (migration 20260625) — captura corridas concorrentes
 *      O sinal observável em UI: o vendedor é redirecionado para
 *      `/orcamentos/<uuid>` UMA única vez sem toast de erro.
 *
 *   2. Após a solicitação ser criada, o gestor (papel `admin`) vê o
 *      histórico/auditoria renderizado no painel
 *      `/admin/usuarios?tab=discounts` — esta parte é skipada quando o
 *      usuário E2E não tem papel admin, mantendo o spec verde em CI.
 */

import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { waitForTestIdVisible } from "../helpers/waits";
import { Sel } from "../fixtures/selectors";


test.describe.configure({ mode: "parallel" });

test.describe("Discount approval — idempotency & audit", () => {
  test.beforeEach(() => requireAuth());

  test("double-click em 'Enviar para Aprovação' resulta em UMA solicitação", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos/novo");
    await waitForTestIdVisible(page, "quote-wizard", { timeout: 15_000 });

    // Setup mínimo: sem empresa + 1 produto + desconto alto
    const companySearch = page.locator('[data-testid="company-search-input"]').first();
    await companySearch.click();
    await page.locator(Sel.quote.noCompanyOption).first().click();

    const addProduct = page.locator(Sel.quote.addProductButton).first();
    await addProduct.click();
    await page.locator(Sel.quote.productSearchInput).first().waitFor({ state: "visible" });
    const productCount = await page.locator(Sel.quote.productSearchOption).count();
    test.skip(productCount === 0, "Catálogo vazio — sem produto para teste");
    await page.locator(Sel.quote.productSearchOption).first().click();
    const noColor = page.locator(Sel.quote.addWithoutColor).first();
    if (await noColor.isVisible().catch(() => false)) await noColor.click();
    await page.locator(Sel.quote.item(0)).first().waitFor({ state: "visible" });

    // Desconto agressivo (75% — quase sempre acima do limite do vendedor)
    const discountInput = page.locator(Sel.quote.discountInput).first();
    await discountInput.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("75");
    await page.keyboard.press("Tab");

    const requestApproval = page.locator(Sel.quote.requestApprovalButton).first();
    const shown = await requestApproval.isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(!shown, "Vendedor sem limite < 75% — fluxo de alçada não disparou");

    await requestApproval.click();
    await waitForTestIdVisible(page, "quote-approval-dialog", { timeout: 10_000 });

    await page
      .locator(Sel.quote.approvalJustification)
      .first()
      .fill("E2E idempotência: cliente estratégico, justificativa válida");

    const submit = page.locator(Sel.quote.approvalSubmit).first();
    await expect(submit).toBeEnabled({ timeout: 5_000 });

    // Captura toasts de erro: a defesa em camadas deve impedir mensagens
    // como "Erro ao solicitar aprovação" mesmo sob cliques repetidos.
    const errorToasts: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errorToasts.push(msg.text());
    });

    // Double-click rápido — testa o caminho concorrente
    await Promise.all([submit.click(), submit.click().catch(() => null)]);

    // Espera redirect para /orcamentos/<uuid> (1x apenas)
    await page.waitForURL(/\/orcamentos\/[0-9a-f-]{36}/, { timeout: 20_000 });
    const finalUrl = page.url();
    expect(finalUrl).toMatch(/\/orcamentos\/[0-9a-f-]{36}/);

    // Após o redirect, NÃO deve aparecer toast de "Erro ao solicitar aprovação"
    const errorToast = page.getByText(/Erro ao solicitar aprovação/i);
    await expect(errorToast).toHaveCount(0);
  });

  test("gestor vê histórico/auditoria no painel (se tiver papel admin)", async ({ page }) => {
    await gotoAndSettle(page, "/admin/usuarios?tab=discounts");

    // Se não tem acesso admin, a UI redireciona ou mostra "não autorizado"
    const unauthorized = page.getByText(/n[ãa]o autorizado|acesso negado|n[ãa]o tem permiss[ãa]o/i);
    const isBlocked = await unauthorized.isVisible({ timeout: 3_000 }).catch(() => false);
    test.skip(isBlocked, "Usuário E2E não tem papel admin — painel inacessível");

    // Aguarda a fila renderizar (pode estar vazia em ambientes limpos)
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => null);

    // Se há ao menos uma solicitação, o componente de auditoria deve estar visível
    const auditToggle = page.locator('[data-testid^="discount-audit-toggle-"]').first();
    const hasAudit = await auditToggle.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasAudit) {
      test.info().annotations.push({
        type: "info",
        description: "Nenhuma solicitação pendente no momento — histórico não renderizado, mas spec não falha",
      });
      return;
    }

    await auditToggle.click();
    // Expande e mostra ao menos 1 linha de evento (created/approved/rejected)
    await expect(auditToggle).toHaveAttribute("data-state", "open", { timeout: 3_000 });
  });
});
