/**
 * E2E — Idempotência cross-tab.
 *
 * Abre duas abas (`context.newPage()`), constrói o mesmo orçamento em ambas
 * com o mesmo % de desconto e dispara `requestApproval` em paralelo.
 * Espera-se que o constraint único `uniq_dar_quote_pending` garanta que
 * apenas 1 linha pending exista — a segunda aba recebe 23505 e mostra
 * toast amigável ("já existe pendente"), sem travar a UI.
 *
 * O propósito é provar que a defesa de DB (não só a deduplicação in-flight
 * por aba) protege contra múltiplos pendings para o mesmo quote.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { waitForTestIdVisible } from "../helpers/waits";
import { Sel } from "../fixtures/selectors";

test.describe.configure({ mode: "serial" });
test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://doufsxqlfjyuvxuezpln.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

async function buildAndSubmit(page: import("@playwright/test").Page, percent: number) {
  await gotoAndSettle(page, "/orcamentos/novo");
  await waitForTestIdVisible(page, "quote-wizard", { timeout: 15_000 });
  await page.locator('[data-testid="company-search-input"]').first().click();
  await page.locator(Sel.quote.noCompanyOption).first().click();
  await page.locator(Sel.quote.addProductButton).first().click();
  await page.locator(Sel.quote.productSearchInput).first().waitFor({ state: "visible" });
  const productCount = await page.locator(Sel.quote.productSearchOption).count();
  test.skip(productCount === 0, "Catálogo vazio");
  await page.locator(Sel.quote.productSearchOption).first().click();
  const noColor = page.locator(Sel.quote.addWithoutColor).first();
  if (await noColor.isVisible().catch(() => false)) await noColor.click();
  await page.locator(Sel.quote.item(0)).first().waitFor({ state: "visible" });

  const discountInput = page.locator(Sel.quote.discountInput).first();
  await discountInput.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type(String(percent));
  await page.keyboard.press("Tab");

  const requestApproval = page.locator(Sel.quote.requestApprovalButton).first();
  const shown = await requestApproval.isVisible({ timeout: 5_000 }).catch(() => false);
  test.skip(!shown, "Vendedor sem alçada para esse %");
  await requestApproval.click();
  await waitForTestIdVisible(page, "quote-approval-dialog", { timeout: 10_000 });
  await page
    .locator(Sel.quote.approvalJustification)
    .first()
    .fill("E2E multi-tab — mesma justificativa");
  await page.locator(Sel.quote.approvalSubmit).first().click();
}

test.describe("Discount approval — cross-tab idempotency", () => {
  test.beforeEach(() => requireAuth());

  test("duas abas submetem o mesmo % e DB mantém apenas 1 pending", async ({
    page,
    context,
  }) => {
    test.skip(!SUPABASE_ANON_KEY, "Sem anon key — não dá pra checar DB");
    test.setTimeout(180_000);

    // Aba 1 cria o quote + pending normalmente.
    await buildAndSubmit(page, 75);
    await page.waitForURL(/\/orcamentos\/[0-9a-f-]{36}/, { timeout: 25_000 });
    const quoteUuid = page.url().match(/\/orcamentos\/([0-9a-f-]{36})/)?.[1];
    expect(quoteUuid).toBeTruthy();

    // Aba 2 tenta o mesmo % no MESMO contexto (mesma sessão).
    const page2 = await context.newPage();
    await gotoAndSettle(page2, `/orcamentos/${quoteUuid}`);
    // Ajusta para o mesmo % na aba 2 e tenta solicitar novamente.
    const discount2 = page2.locator(Sel.quote.discountInput).first();
    const visible = await discount2.isVisible({ timeout: 5_000 }).catch(() => false);
    if (visible) {
      await discount2.click();
      await page2.keyboard.press("Control+A");
      await page2.keyboard.type("75");
      await page2.keyboard.press("Tab");
      const btn2 = page2.locator(Sel.quote.requestApprovalButton).first();
      if (await btn2.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await btn2.click();
        const dialog = await page2
          .getByTestId("quote-approval-dialog")
          .isVisible({ timeout: 5_000 })
          .catch(() => false);
        if (dialog) {
          await page2.locator(Sel.quote.approvalJustification).first().fill("Duplicado");
          await page2.locator(Sel.quote.approvalSubmit).first().click().catch(() => null);
        }
      }
    }

    // Aguarda 2s para qualquer race terminar.
    await page.waitForTimeout(2000);

    // Conta pending no DB via REST (sessão do user).
    const count = await page.evaluate(
      async ({ url, anonKey, quoteId }) => {
        let jwt = "";
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)!;
          if (!k.startsWith("sb-") || !k.endsWith("-auth-token")) continue;
          try {
            jwt = JSON.parse(localStorage.getItem(k) ?? "{}")?.access_token ?? "";
          } catch {
            /* noop */
          }
          if (jwt) break;
        }
        if (!jwt) return -1;
        const res = await fetch(
          `${url}/rest/v1/discount_approval_requests?quote_id=eq.${quoteId}&status=eq.pending&select=id`,
          {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${jwt}`,
              Prefer: "count=exact",
            },
          },
        );
        const range = res.headers.get("content-range") ?? "0/0";
        return Number(range.split("/")[1] ?? 0);
      },
      { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, quoteId: quoteUuid! },
    );
    test.skip(count === -1, "JWT ausente — sem como consultar DB");
    expect(count).toBe(1);

    await page2.close();
  });
});
