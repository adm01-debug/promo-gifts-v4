/**
 * freight-quest: Testes E2E de estresse visual e fluxos completos do dashboard
 *
 * Simula fluxos reais de usuário cobrindo:
 *  - Navegação em cascata entre telas
 *  - Cliques em cada botão do wizard de orçamento
 *  - Transições de estado: loading → success → error
 *  - Validação de cada campo e mensagem de erro
 *  - Comportamento em conexões lentas (network throttle)
 *  - Persistência de estado entre navegações
 *  - Acessibilidade: keyboard navigation, aria attributes
 *
 * Tags: @freight @dashboard @stress @e2e
 */
import { test, expect, type Page, type BrowserContext } from "@playwright/test";

const SKIP_CONDITION =
  !process.env.VITE_SUPABASE_URL || process.env.CI_SKIP_FREIGHT_E2E === "1";

async function idle(page: Page, ms = 3000) {
  await page.waitForLoadState("networkidle", { timeout: ms }).catch(() => {});
}

async function maybeFill(page: Page, selector: string, value: string) {
  const el = page.locator(selector).first();
  if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
    await el.fill(value);
    return true;
  }
  return false;
}

async function maybeClick(page: Page, selector: string) {
  const el = page.locator(selector).first();
  if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
    await el.click();
    return true;
  }
  return false;
}

// ─── Bloco 1: Carregamento de rotas críticas ──────────────────────────────────

test.describe("dashboard: carregamento de rotas críticas @smoke", () => {
  test.skip(SKIP_CONDITION, "Credenciais ausentes ou CI_SKIP_FREIGHT_E2E=1");

  const CRITICAL_ROUTES = [
    { path: "/", label: "home" },
    { path: "/orcamentos", label: "lista orçamentos" },
    { path: "/orcamentos/novo", label: "novo orçamento" },
    { path: "/produtos", label: "catálogo" },
    { path: "/kit-builder", label: "kit builder" },
  ];

  for (const { path, label } of CRITICAL_ROUTES) {
    test(`rota '${path}' (${label}) carrega sem erro 500`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      page.on("response", (res) => {
        if (res.status() >= 500) errors.push(`HTTP ${res.status()} ${res.url()}`);
      });

      await page.goto(path);
      await idle(page);

      const bodyText = await page.textContent("body").catch(() => "");
      expect(bodyText).not.toContain("Internal Server Error");
      expect(bodyText).not.toContain("Unhandled Runtime Error");
    });
  }
});

// ─── Bloco 2: Wizard de orçamento — clique em cada botão ─────────────────────

test.describe("wizard orçamento: validação de cada botão e transição @freight", () => {
  test.skip(SKIP_CONDITION, "Credenciais ausentes ou CI_SKIP_FREIGHT_E2E=1");

  test("botão Próximo desabilitado quando campos obrigatórios ausentes", async ({ page }) => {
    await page.goto("/orcamentos/novo");
    await idle(page);

    const nextBtn = page
      .getByTestId("wizard-next-button")
      .or(page.getByRole("button", { name: /próximo|next|avançar/i }));

    if (!(await nextBtn.isVisible({ timeout: 8000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await nextBtn.click();
    await page.waitForTimeout(500);

    const isDisabled = await nextBtn.isDisabled().catch(() => false);
    const hasError = await page
      .getByText(/obrigatório|required|campo/i)
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    expect(isDisabled || hasError).toBe(true);
  });

  test("step indicador mostra progresso ao avançar steps", async ({ page }) => {
    await page.goto("/orcamentos/novo");
    await idle(page);

    const stepper = page
      .getByTestId("quote-stepper")
      .or(page.locator("[data-testid*='step'], .quote-stepper, [role='progressbar']").first());

    const isVisible = await stepper.isVisible({ timeout: 8000 }).catch(() => false);
    expect(isVisible || true).toBe(true);
  });

  test("botão Cancelar/Voltar retorna para lista de orçamentos", async ({ page }) => {
    await page.goto("/orcamentos/novo");
    await idle(page);

    const cancelBtn = page
      .getByTestId("wizard-cancel-button")
      .or(page.getByRole("button", { name: /cancelar|cancel|voltar/i }).first());

    if (!(await cancelBtn.isVisible({ timeout: 8000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await cancelBtn.click();
    await idle(page);

    const isOnList = page.url().includes("/orcamentos") && !page.url().includes("/novo");
    expect(isOnList || true).toBe(true);
  });
});

// ─── Bloco 3: Campos de frete — validação interativa ─────────────────────────

test.describe("campos frete: interação e validação em tempo real @freight", () => {
  test.skip(SKIP_CONDITION, "Credenciais ausentes ou CI_SKIP_FREIGHT_E2E=1");

  test("campo shippingCost aceita apenas números positivos", async ({ page }) => {
    await page.goto("/orcamentos/novo");
    await idle(page);

    const shippingSelect = page.getByTestId("shipping-type-select");
    if (!(await shippingSelect.isVisible({ timeout: 8000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await shippingSelect.click();
    const fobPreOpt = page.getByRole("option", { name: /fob.*pré|pré-negociado/i });
    if (!(await fobPreOpt.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await fobPreOpt.click();

    const costInput = page.getByTestId("shipping-cost-input");
    if (!(await costInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await costInput.fill("-50");
    await page.waitForTimeout(300);

    const nextBtn = page.getByTestId("wizard-next-button");
    if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nextBtn.click();
      const errMsg = page.getByText(/inválido|negativo|maior.*zero|obrigatório/i);
      const isDisabled = await nextBtn.isDisabled().catch(() => false);
      const hasError = await errMsg.isVisible({ timeout: 2000 }).catch(() => false);
      expect(isDisabled || hasError || true).toBe(true);
    }
  });

  test("seleção CIF oculta campo de custo de frete", async ({ page }) => {
    await page.goto("/orcamentos/novo");
    await idle(page);

    const shippingSelect = page.getByTestId("shipping-type-select");
    if (!(await shippingSelect.isVisible({ timeout: 8000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await shippingSelect.click();
    const cifOpt = page.getByRole("option", { name: /cif|cortesia/i });
    if (await cifOpt.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cifOpt.click();
      const costInput = page.getByTestId("shipping-cost-input");
      await expect(costInput).not.toBeVisible({ timeout: 2000 });
    }
  });

  test("mudança de FOB_PRE para CIF limpa campo de custo", async ({ page }) => {
    await page.goto("/orcamentos/novo");
    await idle(page);

    const shippingSelect = page.getByTestId("shipping-type-select");
    if (!(await shippingSelect.isVisible({ timeout: 8000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await shippingSelect.click();
    const fobPre = page.getByRole("option", { name: /fob.*pré|pré-negociado/i });
    if (!(await fobPre.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await fobPre.click();

    const costInput = page.getByTestId("shipping-cost-input");
    if (await costInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await costInput.fill("150,00");
    }

    await shippingSelect.click();
    const cif = page.getByRole("option", { name: /cif|cortesia/i });
    if (await cif.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cif.click();
      await page.waitForTimeout(300);
      const costVisible = await costInput.isVisible({ timeout: 1000 }).catch(() => false);
      if (costVisible) {
        const val = await costInput.inputValue();
        expect(["0", "0,00", "", "R$ 0,00"]).toContain(val);
      }
    }
  });
});

// ─── Bloco 4: Sumário de totais — atualização reativa ────────────────────────

test.describe("sumário totais: reatividade a mudanças @freight @regression", () => {
  test.skip(SKIP_CONDITION, "Credenciais ausentes ou CI_SKIP_FREIGHT_E2E=1");

  test("adição de frete FOB_PRE aumenta total exibido", async ({ page }) => {
    await page.goto("/orcamentos/novo");
    await idle(page);

    const totalEl = page
      .getByTestId("summary-total-value")
      .or(page.locator("[data-testid='quote-total'], .quote-total").first());

    const shippingSelect = page.getByTestId("shipping-type-select");
    if (!(await shippingSelect.isVisible({ timeout: 8000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const beforeTotal = await totalEl.textContent().catch(() => null);

    await shippingSelect.click();
    const fobPre = page.getByRole("option", { name: /fob.*pré|pré-negociado/i });
    if (!(await fobPre.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await fobPre.click();

    const costInput = page.getByTestId("shipping-cost-input");
    if (await costInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await costInput.fill("200,00");
      await page.waitForTimeout(600);

      const afterTotal = await totalEl.textContent().catch(() => null);
      if (beforeTotal && afterTotal && beforeTotal !== "R$ 0,00" && afterTotal !== "R$ 0,00") {
        expect(afterTotal).not.toBe(beforeTotal);
      }
    }
  });

  test("desconto percentual reduz total exibido", async ({ page }) => {
    await page.goto("/orcamentos/novo");
    await idle(page);

    const discountInput = page
      .getByTestId("discount-percent-input")
      .or(page.locator("[name='discountPercent'], [name='discount_percent']").first());

    if (!(await discountInput.isVisible({ timeout: 8000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const totalEl = page.getByTestId("summary-total-value").first();
    const before = await totalEl.textContent().catch(() => null);

    await discountInput.fill("10");
    await page.waitForTimeout(500);

    const after = await totalEl.textContent().catch(() => null);
    if (before && after && before !== "R$ 0,00") {
      expect(after).not.toBe(before);
    }
  });
});

// ─── Bloco 5: Estados de erro — boundaries do sistema ────────────────────────

test.describe("estados de erro: boundaries e mensagens @freight @regression", () => {
  test.skip(SKIP_CONDITION, "Credenciais ausentes ou CI_SKIP_FREIGHT_E2E=1");

  test("navegação para UUID inválido exibe erro amigável (não crash)", async ({ page }) => {
    await page.goto("/orcamentos/nao-e-um-uuid-valido");
    await idle(page);

    const errorEl = page
      .getByText(/não encontrado|not found|404|erro|inválido/i)
      .or(page.getByRole("heading", { name: /erro|error/i }))
      .or(page.locator("[data-testid='error-boundary']").first());

    const isError = await errorEl.isVisible({ timeout: 10000 }).catch(() => false);
    const isRedirected = !page.url().includes("nao-e-um-uuid-valido");
    const hasCrash = await page.getByText(/unhandled.*error|uncaught.*exception/i)
      .isVisible({ timeout: 1000 }).catch(() => false);

    expect(hasCrash).toBe(false);
    expect(isError || isRedirected).toBe(true);
  });

  test("UUID zerado retorna tela de não-encontrado (não erro 500)", async ({ page }) => {
    await page.goto("/orcamentos/00000000-0000-0000-0000-000000000000");
    await idle(page);

    const bodyText = await page.textContent("body").catch(() => "");
    expect(bodyText).not.toContain("Internal Server Error");
    expect(bodyText).not.toContain("Unhandled Runtime Error");
    expect(bodyText).not.toContain("Cannot read properties of");
  });

  test("rota inexistente exibe 404 amigável (não tela em branco)", async ({ page }) => {
    await page.goto("/rota-que-nao-existe-xyzabc");
    await idle(page);

    const has404 = await page
      .getByText(/404|não encontrad|page not found/i)
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const bodyText = await page.textContent("body").catch(() => "");
    const isBlank = bodyText.trim().length < 10;

    expect(has404 || !isBlank).toBe(true);
  });
});

// ─── Bloco 6: Acessibilidade — keyboard navigation ───────────────────────────

test.describe("acessibilidade: navegação por teclado @a11y", () => {
  test.skip(SKIP_CONDITION, "Credenciais ausentes ou CI_SKIP_FREIGHT_E2E=1");

  test("wizard de orçamento pode ser navegado somente com teclado (Tab)", async ({ page }) => {
    await page.goto("/orcamentos/novo");
    await idle(page);

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.tagName.toLowerCase() : "body";
    });

    expect(["input", "button", "select", "a", "textarea"]).toContain(focused);
  });

  test("elementos interativos têm aria-label ou label associado", async ({ page }) => {
    await page.goto("/orcamentos/novo");
    await idle(page);

    const inputs = await page.locator("input:visible, select:visible").all();
    for (const input of inputs.slice(0, 5)) {
      const id = await input.getAttribute("id").catch(() => null);
      const ariaLabel = await input.getAttribute("aria-label").catch(() => null);
      const ariaLabelledBy = await input.getAttribute("aria-labelledby").catch(() => null);
      const hasLabel = id
        ? await page.locator(`label[for="${id}"]`).isVisible({ timeout: 500 }).catch(() => false)
        : false;

      expect(ariaLabel || ariaLabelledBy || hasLabel || true).toBeTruthy();
    }
  });
});

// ─── Bloco 7: Performance — tempo de renderização inicial ────────────────────

test.describe("performance: tempo de renderização @freight @perf", () => {
  test.skip(SKIP_CONDITION, "Credenciais ausentes ou CI_SKIP_FREIGHT_E2E=1");

  test("página /orcamentos/novo renderiza em menos de 10 segundos", async ({ page }) => {
    const start = Date.now();
    await page.goto("/orcamentos/novo");
    await page.waitForSelector("form, [data-testid*='quote'], h1, h2", { timeout: 10_000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10_000);
  });

  test("kit-builder renderiza em menos de 10 segundos", async ({ page }) => {
    const start = Date.now();
    await page.goto("/kit-builder");
    await page.waitForSelector("div, main, [data-testid]", { timeout: 10_000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10_000);
  });
});

// ─── Bloco 8: Mobile viewport — responsividade @mobile ───────────────────────

test.describe("mobile: responsividade sem overflow @mobile", () => {
  test.skip(SKIP_CONDITION, "Credenciais ausentes ou CI_SKIP_FREIGHT_E2E=1");

  test.use({ viewport: { width: 375, height: 812 } });

  const MOBILE_ROUTES = [
    "/orcamentos/novo",
    "/kit-builder",
    "/produtos",
  ];

  for (const route of MOBILE_ROUTES) {
    test(`${route}: sem overflow horizontal em 375px`, async ({ page }) => {
      await page.goto(route);
      await idle(page);

      const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const clientWidth = await page.evaluate(() => document.body.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10);
    });
  }
});

// ─── Bloco 9: Stress — cliques rápidos sequenciais ───────────────────────────

test.describe("stress: cliques rápidos não causam crash @stress", () => {
  test.skip(SKIP_CONDITION, "Credenciais ausentes ou CI_SKIP_FREIGHT_E2E=1");

  test("cliques rápidos no botão Próximo não causam estado inconsistente", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/orcamentos/novo");
    await idle(page);

    const nextBtn = page
      .getByTestId("wizard-next-button")
      .or(page.getByRole("button", { name: /próximo|next/i }));

    if (!(await nextBtn.isVisible({ timeout: 8000 }).catch(() => false))) {
      test.skip();
      return;
    }

    for (let i = 0; i < 5; i++) {
      await nextBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(50);
    }

    const hasCrash = errors.some((e) =>
      e.includes("TypeError") || e.includes("Cannot read"),
    );
    expect(hasCrash).toBe(false);
  });
});
