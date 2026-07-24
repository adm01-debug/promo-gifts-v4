/**
 * E2E — Lentidão + retry intermitente de rede no requestApproval.
 *
 * Cenário: a primeira tentativa de POST em `discount_approval_requests` é
 * lenta (1.5s) E falha com 503 simulado. O usuário clica novamente. A segunda
 * tentativa passa. Validamos que:
 *   1. O botão fica disabled durante a 1ª chamada (loading).
 *   2. Após a falha, o botão volta a habilitar (toast de erro foi exibido).
 *   3. A segunda submissão tem sucesso (1 redirect /orcamentos/<uuid>).
 *   4. Em DB, existe exatamente 1 linha pending — idempotência preservada
 *      mesmo sob retry com latência variável.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { waitForTestIdVisible } from "../helpers/waits";
import { Sel } from "../fixtures/selectors";

test.describe.configure({ mode: "parallel" });
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

test.describe("Discount approval — retry intermitente preserva idempotência", () => {
  test.beforeEach(() => requireAuth());

  test("falha transitória seguida de retry resulta em exatamente 1 pending", async ({
    page,
  }) => {
    test.skip(!SUPABASE_ANON_KEY, "Sem anon key — não dá pra checar DB");
    test.setTimeout(120_000);

    // Intercepta POSTs: 1º POST = lento + 503, demais POSTs passam.
    let postCount = 0;
    await page.route(/\/rest\/v1\/discount_approval_requests/, async (route, request) => {
      if (request.method() !== "POST") return route.continue();
      postCount += 1;
      if (postCount === 1) {
        await new Promise((r) => setTimeout(r, 1500));
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "service unavailable", code: "PGRST503" }),
        });
        return;
      }
      await route.continue();
    });

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
    await page.keyboard.type("75");
    await page.keyboard.press("Tab");

    const requestApproval = page.locator(Sel.quote.requestApprovalButton).first();
    const shown = await requestApproval
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    test.skip(!shown, "Vendedor sem limite < 75% — fluxo de alçada não disparou");

    await requestApproval.click();
    await waitForTestIdVisible(page, "quote-approval-dialog", { timeout: 10_000 });
    await page
      .locator(Sel.quote.approvalJustification)
      .first()
      .fill("E2E retry intermitente — idempotência");

    const submit = page.locator(Sel.quote.approvalSubmit).first();
    await expect(submit).toBeEnabled({ timeout: 5_000 });

    // 1ª tentativa — deve falhar (503 após 1.5s) e botão volta a habilitar.
    await submit.click();
    await expect(submit).toBeDisabled({ timeout: 2_000 });
    await expect(submit).toBeEnabled({ timeout: 15_000 });

    // 2ª tentativa — deve passar e redirecionar.
    await submit.click();
    await page.waitForURL(/\/orcamentos\/[0-9a-f-]{36}/, { timeout: 30_000 });
    const quoteUuid = page.url().match(/\/orcamentos\/([0-9a-f-]{36})/)?.[1];
    expect(quoteUuid).toBeTruthy();

    // Conta pending no DB — DEVE ser exatamente 1.
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

    test.skip(count === -1, "JWT ausente — não foi possível consultar DB");
    expect(count).toBe(1);
  });
});
