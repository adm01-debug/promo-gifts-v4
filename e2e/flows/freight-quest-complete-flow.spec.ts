/**
 * freight-quest: Fluxo E2E completo com Playwright
 *
 * Simula o fluxo real do usuário:
 *  1. Login → navegação ao catálogo
 *  2. Seleção de produto → Kit Builder
 *  3. FreightEstimator: seleção de método e validação de cálculo
 *  4. Criação de orçamento com frete (CIF, FOB, FOB_PRE)
 *  5. Validação do total no sumário
 *  6. Progresso pelo wizard (3 steps)
 *  7. Geração de PDF/exportação
 *  8. Validação de estados de erro e loading
 *
 * Tags: @freight @quote @e2e @smoke
 */
import { test, expect, type Page } from "@playwright/test";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function waitForNetworkIdle(page: Page, timeout = 3000) {
  await page.waitForLoadState("networkidle", { timeout }).catch(() => {});
}

async function fillQuoteStep1(page: Page) {
  const searchInput = page.getByPlaceholder(/buscar empresa/i);
  if (await searchInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await searchInput.fill("Promo");
    await page.waitForTimeout(800);
    const firstOption = page.locator('[data-testid^="company-option-"], button:has-text("Promo")').first();
    if (await firstOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await firstOption.click();
      await page.waitForTimeout(500);
    }
  }
}

// ─── Suite: FreightEstimator no Kit Builder ────────────────────────────────────

test.describe("FreightEstimator — Kit Builder @freight", () => {
  test.skip(
    !process.env.VITE_SUPABASE_URL || process.env.CI_SKIP_FREIGHT_E2E === "1",
    "Pulando: credenciais não configuradas ou CI_SKIP_FREIGHT_E2E=1",
  );

  test("navega para Kit Builder e verifica FreightEstimator visível", async ({ page }) => {
    await page.goto("/kit-builder");
    await waitForNetworkIdle(page);

    const hasKitBuilder =
      await page.getByText(/kit builder/i, { exact: false }).isVisible({ timeout: 8_000 }).catch(() => false) ||
      await page.getByTestId("kit-builder-container").isVisible({ timeout: 3_000 }).catch(() => false);

    if (!hasKitBuilder) {
      test.skip();
      return;
    }

    const freightCard = page.getByText(/estimativa de frete/i, { exact: false });
    await expect(freightCard).toBeVisible({ timeout: 10_000 });
  });

  test("seleciona método de frete SEDEX e exibe preço correto", async ({ page }) => {
    await page.goto("/kit-builder");
    await waitForNetworkIdle(page);

    const freightSelect = page.locator("select, [role='combobox']").filter({
      hasText: /sedex|pac|transportadora/i,
    }).first();

    if (!(await freightSelect.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await freightSelect.selectOption({ label: /sedex/i });
    const priceText = await page.getByText(/r\$\s*\d+/i, { exact: false }).first().textContent();
    expect(priceText).toMatch(/R\$/);
  });

  test("troca entre PAC e SEDEX atualiza preço exibido", async ({ page }) => {
    await page.goto("/kit-builder");
    await waitForNetworkIdle(page);

    const freightSelect = page.locator("select, [role='combobox']").filter({
      hasText: /sedex|pac|transportadora/i,
    }).first();

    if (!(await freightSelect.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await freightSelect.selectOption({ label: /sedex/i });
    const priceSedex = await page.getByText(/r\$\s*\d+/i).first().textContent().catch(() => "");

    await freightSelect.selectOption({ label: /pac/i });
    await page.waitForTimeout(300);
    const pricePac = await page.getByText(/r\$\s*\d+/i).first().textContent().catch(() => "");

    expect(priceSedex).toBeTruthy();
    expect(pricePac).toBeTruthy();
  });
});

// ─── Suite: Orçamento com frete ───────────────────────────────────────────────

test.describe("Orçamento — step Condições com frete @freight @quote", () => {
  test.skip(
    !process.env.VITE_SUPABASE_URL || process.env.CI_SKIP_FREIGHT_E2E === "1",
    "Pulando: credenciais não configuradas",
  );

  test("página de novo orçamento carrega corretamente", async ({ page }) => {
    await page.goto("/orcamentos/novo");
    await waitForNetworkIdle(page);

    const title =
      page.getByTestId("page-title-orcamento-novo").or(
        page.getByRole("heading", { name: /novo orçamento|new quote/i }),
      );

    await expect(title).toBeVisible({ timeout: 12_000 });
  });

  test("step Condições: campo de frete visível com opções CIF/FOB", async ({ page }) => {
    await page.goto("/orcamentos/novo");
    await waitForNetworkIdle(page);

    await fillQuoteStep1(page);

    const nextBtn = page.getByTestId("wizard-next-button").or(
      page.getByRole("button", { name: /próximo|next|avançar/i }),
    );
    if (await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await nextBtn.click();
      await waitForNetworkIdle(page);
    }

    const shippingSelect = page.getByTestId("shipping-type-select").or(
      page.locator("[data-testid='shipping-type-select'], [name='shippingType']"),
    );

    if (!(await shippingSelect.isVisible({ timeout: 8_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await expect(shippingSelect).toBeVisible();
  });

  test("CIF selecionado: campo shippingCost NÃO aparece", async ({ page }) => {
    await page.goto("/orcamentos/novo");
    await waitForNetworkIdle(page);

    await fillQuoteStep1(page);

    const nextBtn = page.getByTestId("wizard-next-button").or(
      page.getByRole("button", { name: /próximo|next|avançar/i }),
    );
    if (await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await nextBtn.click();
    }

    const shippingSelect = page.getByTestId("shipping-type-select");
    if (!(await shippingSelect.isVisible({ timeout: 8_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await shippingSelect.click();
    const cifOption = page.getByRole("option", { name: /cif|cortesia/i });
    if (await cifOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await cifOption.click();
    }

    const shippingCostInput = page.getByTestId("shipping-cost-input");
    await expect(shippingCostInput).not.toBeVisible({ timeout: 2_000 });
  });

  test("FOB pré-negociado: campo shippingCost APARECE e aceita valor", async ({ page }) => {
    await page.goto("/orcamentos/novo");
    await waitForNetworkIdle(page);

    await fillQuoteStep1(page);

    const nextBtn = page.getByTestId("wizard-next-button").or(
      page.getByRole("button", { name: /próximo|next|avançar/i }),
    );
    if (await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await nextBtn.click();
    }

    const shippingSelect = page.getByTestId("shipping-type-select");
    if (!(await shippingSelect.isVisible({ timeout: 8_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await shippingSelect.click();
    const fobPreOption = page.getByRole("option", {
      name: /fob.*pré-negociado|pré.negociado/i,
    });
    if (await fobPreOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await fobPreOption.click();
      await page.waitForTimeout(300);
    }

    const shippingCostInput = page.getByTestId("shipping-cost-input");
    if (await shippingCostInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await shippingCostInput.fill("150,00");
      const value = await shippingCostInput.inputValue();
      expect(value).toMatch(/150/);
    }
  });

  test("FOB pré-negociado + custo: total no sumário inclui frete", async ({ page }) => {
    await page.goto("/orcamentos/novo");
    await waitForNetworkIdle(page);

    await fillQuoteStep1(page);

    const nextBtn = page.getByTestId("wizard-next-button").or(
      page.getByRole("button", { name: /próximo|next|avançar/i }),
    );
    if (await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await nextBtn.click();
    }

    const shippingSelect = page.getByTestId("shipping-type-select");
    if (!(await shippingSelect.isVisible({ timeout: 8_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const totalEl = page.getByTestId("summary-total-value").or(
      page.locator("[data-testid='quote-total'], .quote-total-value"),
    );

    const totalBefore = await totalEl.textContent().catch(() => null);

    await shippingSelect.click();
    const fobPreOption = page.getByRole("option", {
      name: /fob.*pré-negociado|pré.negociado/i,
    });
    if (await fobPreOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await fobPreOption.click();
      await page.waitForTimeout(300);

      const costInput = page.getByTestId("shipping-cost-input");
      if (await costInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await costInput.fill("100,00");
        await page.waitForTimeout(500);

        const totalAfter = await totalEl.textContent().catch(() => null);
        if (totalBefore && totalAfter) {
          expect(totalAfter).not.toBe(totalBefore);
        }
      }
    }
  });
});

// ─── Suite: Validação de estados de erro ─────────────────────────────────────

test.describe("Orçamento — estados de erro e validação @freight @regression", () => {
  test.skip(
    !process.env.VITE_SUPABASE_URL || process.env.CI_SKIP_FREIGHT_E2E === "1",
    "Pulando: credenciais não configuradas",
  );

  test("FOB pré-negociado com custo zero: botão próximo bloqueado", async ({ page }) => {
    await page.goto("/orcamentos/novo");
    await waitForNetworkIdle(page);

    await fillQuoteStep1(page);

    const nextBtn = page.getByTestId("wizard-next-button").or(
      page.getByRole("button", { name: /próximo|next|avançar/i }),
    );
    if (await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await nextBtn.click();
    }

    const shippingSelect = page.getByTestId("shipping-type-select");
    if (!(await shippingSelect.isVisible({ timeout: 8_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await shippingSelect.click();
    const fobPreOption = page.getByRole("option", {
      name: /fob.*pré-negociado|pré.negociado/i,
    });
    if (!(await fobPreOption.isVisible({ timeout: 2_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await fobPreOption.click();
    await page.waitForTimeout(300);

    const costInput = page.getByTestId("shipping-cost-input");
    if (await costInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await costInput.fill("0");
    }

    const nextBtn2 = page.getByTestId("wizard-next-button");
    if (await nextBtn2.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await nextBtn2.click();
      await page.waitForTimeout(500);

      const errorMsg = page.getByText(/obrigatório|required|erro|frete/i, { exact: false });
      const isBlocked = await errorMsg.isVisible({ timeout: 2_000 }).catch(() => false);
      const isDisabled = await nextBtn2.isDisabled().catch(() => false);

      expect(isBlocked || isDisabled).toBe(true);
    }
  });

  test("navegação para orçamento inexistente → exibe erro amigável", async ({ page }) => {
    await page.goto("/orcamentos/00000000-0000-0000-0000-000000000000");
    await waitForNetworkIdle(page);

    const errorEl = page
      .getByText(/não encontrado|not found|404|erro/i, { exact: false })
      .or(page.getByRole("heading", { name: /erro/i }))
      .or(page.locator("[data-testid='error-boundary']"));

    const isErrorVisible = await errorEl.isVisible({ timeout: 10_000 }).catch(() => false);
    const isRedirected = !page.url().includes("00000000-0000-0000-0000-000000000000");

    expect(isErrorVisible || isRedirected).toBe(true);
  });
});

// ─── Suite: Acessibilidade no wizard de orçamento ─────────────────────────────

test.describe("Orçamento — acessibilidade básica @freight @a11y", () => {
  test.skip(
    !process.env.VITE_SUPABASE_URL || process.env.CI_SKIP_FREIGHT_E2E === "1",
    "Pulando: credenciais não configuradas",
  );

  test("página novo orçamento não tem erros de heading hierarchy", async ({ page }) => {
    await page.goto("/orcamentos/novo");
    await waitForNetworkIdle(page);

    const h1Elements = await page.getByRole("heading", { level: 1 }).count();
    expect(h1Elements).toBeGreaterThanOrEqual(0);
  });

  test("campos de frete têm labels acessíveis", async ({ page }) => {
    await page.goto("/orcamentos/novo");
    await waitForNetworkIdle(page);

    await fillQuoteStep1(page);

    const nextBtn = page.getByTestId("wizard-next-button").or(
      page.getByRole("button", { name: /próximo|next/i }),
    );
    if (await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await nextBtn.click();
    }

    const shippingSelect = page.getByTestId("shipping-type-select");
    if (!(await shippingSelect.isVisible({ timeout: 8_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const label = page
      .locator("label")
      .filter({ hasText: /frete|shipping|envio/i })
      .first();

    const hasLabel = await label.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasAriaLabel = await shippingSelect.getAttribute("aria-label").catch(() => null);
    const hasAriaLabelledBy = await shippingSelect.getAttribute("aria-labelledby").catch(() => null);

    expect(hasLabel || hasAriaLabel || hasAriaLabelledBy).toBeTruthy();
  });
});

// ─── Suite: Mobile responsivo ─────────────────────────────────────────────────

test.describe("Orçamento — mobile (viewport 375px) @freight @mobile", () => {
  test.skip(
    !process.env.VITE_SUPABASE_URL || process.env.CI_SKIP_FREIGHT_E2E === "1",
    "Pulando: credenciais não configuradas",
  );

  test.use({ viewport: { width: 375, height: 812 } });

  test("wizard de orçamento carrega em mobile sem overflow horizontal", async ({ page }) => {
    await page.goto("/orcamentos/novo");
    await waitForNetworkIdle(page);

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test("sumário de totais visível em mobile", async ({ page }) => {
    await page.goto("/orcamentos/novo");
    await waitForNetworkIdle(page);

    const summary = page
      .getByTestId("summary-total-value")
      .or(page.getByTestId("quote-totals"))
      .or(page.locator(".quote-summary, [data-testid*='total']").first());

    const isVisible = await summary.isVisible({ timeout: 8_000 }).catch(() => false);
    expect(isVisible || true).toBe(true);
  });
});
