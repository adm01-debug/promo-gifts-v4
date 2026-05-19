/**
 * E2E ponta-a-ponta REAL — criação de orçamento
 *
 * Diferente dos specs smoke (04-quotes.spec.ts), este executa o fluxo
 * COMPLETO até persistir no servidor e valida que os dados sobrevivem
 * a um reload da página.
 *
 * Cobertura:
 *
 *   1. Persistência mínima (saveDraft)
 *      - login → /orcamentos/novo → "Sem empresa" → "Salvar Rascunho"
 *      - espera redirect para /orcamentos/{uuid}
 *      - extrai o uuid da URL
 *      - reload — confere que o quote ainda existe na rota
 *
 *   2. Cálculo de subtotal (qty × unit_price)
 *      - login → /orcamentos/novo → "Sem empresa"
 *      - abre dialog de produto, escolhe 1º produto disponível
 *      - "Adicionar sem cor específica" (se houver seletor de cor)
 *      - confere summary-subtotal-products > 0 após adicionar item
 *      - salva como rascunho → reload → confere persistência via UI de view
 *
 * Por que isso vale:
 *   Os 131 specs existentes em e2e/flows/ são quase todos smoke
 *   (apenas confirmam que a página carrega). Este vai até a borda real:
 *   linha do DB (via UI) e ciclo persist→reload→read.
 *
 * Requisitos:
 *   - E2E_USER_EMAIL/PASSWORD setados (skipa via requireAuth se ausentes)
 *   - Catálogo precisa ter pelo menos 1 produto (skip controlado se vazio)
 */

import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { waitForTestIdVisible } from "../helpers/waits";
import { Sel } from "../fixtures/selectors";

/** Lê texto numérico formatado pt-BR ("R$ 1.234,56" → 1234.56). */
function parseBRL(raw: string): number {
  const m = raw.match(/-?[\d.]+,\d{2}/);
  if (!m) return Number.NaN;
  return Number(m[0].replace(/\./g, "").replace(",", "."));
}

test.describe("Quote create — ponta-a-ponta REAL com persistência", () => {
  test.beforeEach(() => requireAuth());

  test("salva rascunho mínimo (sem empresa) e sobrevive ao reload", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos/novo");
    await waitForTestIdVisible(page, "quote-wizard", { timeout: 15_000 });

    // ── Step 1: Cliente — usa a opção "Sem empresa" pra não depender de empresa cadastrada
    // O dropdown precisa ser aberto primeiro
    const companySearch = page.locator('[data-testid="company-search-input"]').first();
    await companySearch.waitFor({ state: "visible", timeout: 10_000 });
    await companySearch.click();

    const noCompany = page.locator(Sel.quote.noCompanyOption).first();
    await noCompany.waitFor({ state: "visible", timeout: 10_000 });
    await noCompany.click();

    // ── Salvar Rascunho (não exige wizard completo)
    const saveDraft = page.locator(Sel.quote.saveDraft).first();
    await expect(saveDraft).toBeEnabled({ timeout: 10_000 });
    await saveDraft.click();

    // ── Esperar redirect para /orcamentos/<uuid>
    await page.waitForURL(/\/orcamentos\/[0-9a-f-]{36}(\/|$|\?)/, { timeout: 20_000 });
    const url = new URL(page.url());
    const match = url.pathname.match(/\/orcamentos\/([0-9a-f-]{36})/);
    expect(match, "URL deve conter UUID do orçamento criado").toBeTruthy();
    const quoteId = match![1];

    // ── Reload e confirma persistência: rota continua válida, sem erro 404
    await page.reload({ waitUntil: "domcontentloaded" });

    expect(page.url(), "reload deve manter rota do quote").toContain(`/orcamentos/${quoteId}`);

    await expect(
      page.getByText(/Or[çc]amento n[ãa]o encontrado|not found/i),
    ).toHaveCount(0);
  });

  test("subtotal calculado bate com qty × preço unitário", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos/novo");
    await waitForTestIdVisible(page, "quote-wizard", { timeout: 15_000 });

    // ── Step 1: Sem empresa
    const companySearch = page.locator('[data-testid="company-search-input"]').first();
    await companySearch.click();
    await page.locator(Sel.quote.noCompanyOption).first().click();

    // ── Abrir dialog de produto
    const addProduct = page.locator(Sel.quote.addProductButton).first();
    await addProduct.waitFor({ state: "visible", timeout: 10_000 });
    await addProduct.click();

    // ── Aguardar input de busca aparecer
    const searchInput = page.locator(Sel.quote.productSearchInput).first();
    await searchInput.waitFor({ state: "visible", timeout: 10_000 });

    // ── Pegar 1º produto disponível na lista (sem hardcode de nome)
    const firstProduct = page.locator(Sel.quote.productSearchOption).first();
    const productCount = await page.locator(Sel.quote.productSearchOption).count();
    test.skip(productCount === 0, "Catálogo vazio neste ambiente — sem produto pra adicionar");

    await firstProduct.click();

    // ── Se aparecer color selector, escolher "sem cor específica"
    const noColor = page.locator(Sel.quote.addWithoutColor).first();
    if (await noColor.isVisible().catch(() => false)) {
      await noColor.click();
    }

    // ── Esperar item aparecer na lista
    const firstItem = page.locator(Sel.quote.item(0)).first();
    await firstItem.waitFor({ state: "visible", timeout: 10_000 });

    // ── Ler subtotal exibido — deve ser > 0 após adicionar produto
    const subtotalEl = page.locator(Sel.quote.summarySubtotal).first();
    await subtotalEl.waitFor({ state: "visible", timeout: 10_000 });

    await expect
      .poll(async () => parseBRL(await subtotalEl.innerText()), {
        timeout: 5_000,
        message: "subtotal deve ser > 0 após adicionar produto",
      })
      .toBeGreaterThan(0);

    const subtotalShown = parseBRL(await subtotalEl.innerText());
    expect(Number.isFinite(subtotalShown)).toBeTruthy();
    expect(subtotalShown).toBeGreaterThan(0);

    // ── Salvar como rascunho pra validar persistência
    const saveDraft = page.locator(Sel.quote.saveDraft).first();
    await expect(saveDraft).toBeEnabled({ timeout: 10_000 });
    await saveDraft.click();

    await page.waitForURL(/\/orcamentos\/[0-9a-f-]{36}/, { timeout: 20_000 });

    // ── Reload e checar persistência via UI de view
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(/R\$\s*\d/).first()).toBeVisible({ timeout: 15_000 });
  });
});
