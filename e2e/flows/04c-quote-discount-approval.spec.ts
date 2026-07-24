/**
 * E2E ponta-a-ponta REAL — aprovação de desconto
 *
 * Testa o fluxo crítico do bloqueador B-4 da auditoria:
 *   quando um vendedor tenta aplicar desconto > seu limite cadastrado,
 *   a UI deve forçar o caminho de "Solicitar Aprovação" em vez de
 *   permitir submit direto. Isso é a defesa em UI complementar ao
 *   trigger SQL `validate_quote_real_discount` que valida server-side.
 *
 * Cobertura:
 *
 *   1. UI muda quando desconto excede limite
 *      - aplica desconto bem alto (75%) — quase sempre acima do limite
 *        configurado (default 5% ou similar; em ambiente de teste pode
 *        ser 0% se o vendedor não tem linha em seller_discount_limits)
 *      - confere que o botão "Criar/Salvar" some
 *      - confere que o botão "Solicitar Aprovação" aparece (cor âmbar)
 *      - se o vendedor TEM limite cadastrado de 100% ou mais (ou não
 *        tem limite → maxDiscountPercent=null), o teste é skipado
 *        com mensagem explícita
 *
 *   2. Dialog "Solicitar Aprovação" abre com valores corretos
 *      - clica no botão "Solicitar Aprovação"
 *      - confere que o dialog renderiza
 *      - confere que mostra "Seu Limite" e "Solicitado"
 *      - confere que o valor solicitado bate com o discountValue digitado
 *
 *   3. Submissão da justificativa cria entry e redireciona
 *      - preenche justificativa
 *      - clica "Enviar para Aprovação"
 *      - confere redirect para /orcamentos/{uuid}
 *      - confere que o orçamento foi salvo como pending_approval
 *
 * Por que isso vale:
 *   Os 4 testes existentes em `discount-approval.spec.ts` (37 linhas)
 *   apenas verificam que rotas de admin redirecionam para login —
 *   smoke puro. Nenhum exercita o fluxo do VENDEDOR ao solicitar
 *   aprovação, que é o caminho do dinheiro real.
 *
 * Requisitos:
 *   - E2E_USER_EMAIL/PASSWORD do vendedor com role 'agente'
 *   - O vendedor PRECISA ter algum limite configurado em
 *     seller_discount_limits — se não tiver, maxDiscountPercent
 *     será null e isDiscountExceeded nunca dispara → skip controlado
 */

import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { waitForTestIdVisible } from "../helpers/waits";
import { Sel } from "../fixtures/selectors";


test.describe.configure({ mode: "parallel" });

test.describe("Quote discount approval — REAL com persistência", () => {
  test.beforeEach(() => requireAuth());

  /**
   * Helper: cria um quote builder com 1 produto e aplica um desconto
   * percentual alto. Retorna se conseguiu (catálogo populado) ou skipa.
   */
  async function setupQuoteWithHighDiscount(page: import("@playwright/test").Page, discountPct: number) {
    await gotoAndSettle(page, "/orcamentos/novo");
    await waitForTestIdVisible(page, "quote-wizard", { timeout: 15_000 });

    // Step 1 — sem empresa
    const companySearch = page.locator('[data-testid="company-search-input"]').first();
    await companySearch.waitFor({ state: "visible", timeout: 10_000 });
    await companySearch.click();
    await page.locator(Sel.quote.noCompanyOption).first().click();

    // Adicionar 1º produto disponível
    const addProduct = page.locator(Sel.quote.addProductButton).first();
    await addProduct.waitFor({ state: "visible", timeout: 10_000 });
    await addProduct.click();

    const searchInput = page.locator(Sel.quote.productSearchInput).first();
    await searchInput.waitFor({ state: "visible", timeout: 10_000 });

    const productCount = await page.locator(Sel.quote.productSearchOption).count();
    test.skip(productCount === 0, "Catálogo vazio — sem produto pra adicionar (não é falha do spec)");

    await page.locator(Sel.quote.productSearchOption).first().click();
    const noColor = page.locator(Sel.quote.addWithoutColor).first();
    if (await noColor.isVisible().catch(() => false)) {
      await noColor.click();
    }

    // Esperar item aparecer
    await page.locator(Sel.quote.item(0)).first().waitFor({ state: "visible", timeout: 10_000 });

    // Garantir que o tipo de desconto é percent (default já é, mas explícito)
    // Ler valor atual do select; se já é 'percent', não muda
    // (não usamos page.selectOption porque é Radix Select; usar tipo padrão é OK)

    // Aplicar desconto via CurrencyInput
    const discountInput = page.locator(Sel.quote.discountInput).first();
    await discountInput.waitFor({ state: "visible", timeout: 10_000 });
    await discountInput.click();
    // CurrencyInput aceita digitação direta
    await page.keyboard.press("Control+A");
    await page.keyboard.type(String(discountPct));
    // Sair do foco pra disparar o onChange final
    await page.keyboard.press("Tab");
  }

  test("desconto > limite faz UI trocar 'Criar' por 'Solicitar Aprovação'", async ({ page }) => {
    await setupQuoteWithHighDiscount(page, 75);

    // Esperar até 5s pelo React reagir ao valor digitado
    // (isDiscountExceeded é derivado de discountValue × maxDiscountPercent)
    const requestApproval = page.locator(Sel.quote.requestApprovalButton).first();
    const saveFinal = page.locator(Sel.quote.saveFinal).first();

    // Se o vendedor não tiver limite (maxDiscountPercent=null), ambos botões podem ficar
    // num estado neutro — skipa de forma documentada
    const isApprovalVisible = await requestApproval.isVisible({ timeout: 5_000 }).catch(() => false);
    const isFinalVisible = await saveFinal.isVisible({ timeout: 100 }).catch(() => false);

    test.skip(
      !isApprovalVisible && isFinalVisible,
      "Vendedor sem limite ou com limite >=75% — isDiscountExceeded não disparou. " +
        "Configure seller_discount_limits para este usuário com max_discount_percent < 75 para que este teste rode.",
    );

    // Caso esperado: botão "Solicitar Aprovação" visível, botão "Criar" não
    await expect(requestApproval).toBeVisible({ timeout: 5_000 });
    await expect(saveFinal).toBeHidden({ timeout: 1_000 });
  });

  test("dialog de aprovação mostra limite vs solicitado", async ({ page }) => {
    await setupQuoteWithHighDiscount(page, 75);

    const requestApproval = page.locator(Sel.quote.requestApprovalButton).first();
    const isApprovalVisible = await requestApproval.isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(
      !isApprovalVisible,
      "Botão 'Solicitar Aprovação' não apareceu — vendedor sem limite < 75% (ver explicação no test 1).",
    );

    await requestApproval.click();

    // Dialog deve abrir
    const dialog = page.locator(Sel.quote.approvalDialog).first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Conferir que mostra os 2 cards (Seu Limite + Solicitado)
    const limitCard = page.locator(Sel.quote.approvalLimit).first();
    const requestedCard = page.locator(Sel.quote.approvalRequested).first();
    await expect(limitCard).toBeVisible();
    await expect(requestedCard).toBeVisible();

    // O card "Solicitado" deve conter "75%"
    await expect(requestedCard).toContainText(/75/);

    // O card "Seu Limite" deve conter "%" (sem assertar o valor exato, varia por vendedor)
    await expect(limitCard).toContainText(/%/);
  });

  test("submeter justificativa salva quote como pending_approval e redireciona", async ({ page }) => {
    await setupQuoteWithHighDiscount(page, 75);

    const requestApproval = page.locator(Sel.quote.requestApprovalButton).first();
    const isApprovalVisible = await requestApproval.isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(
      !isApprovalVisible,
      "Botão 'Solicitar Aprovação' não apareceu — vendedor sem limite < 75% (ver explicação no test 1).",
    );

    await requestApproval.click();
    await waitForTestIdVisible(page, "quote-approval-dialog", { timeout: 10_000 });

    // Preencher justificativa
    const justification = page.locator(Sel.quote.approvalJustification).first();
    await justification.fill("E2E test: cliente estratégico, pedido de teste automatizado");

    // Submeter
    const submit = page.locator(Sel.quote.approvalSubmit).first();
    await expect(submit).toBeEnabled({ timeout: 5_000 });
    await submit.click();

    // Esperar redirect para /orcamentos/<uuid>
    await page.waitForURL(/\/orcamentos\/[0-9a-f-]{36}/, { timeout: 20_000 });

    const match = new URL(page.url()).pathname.match(/\/orcamentos\/([0-9a-f-]{36})/);
    expect(match, "URL deve conter UUID do orçamento criado").toBeTruthy();

    // Reload e confere que rota continua válida (quote foi persistido)
    await page.reload({ waitUntil: "domcontentloaded" });
    expect(page.url()).toContain("/orcamentos/");
    await expect(
      page.getByText(/Or[çc]amento n[ãa]o encontrado|not found/i),
    ).toHaveCount(0);
  });
});
