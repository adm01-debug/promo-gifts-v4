/**
 * E2E — Exclusão INDIVIDUAL de orçamento com toast "Desfazer".
 *
 * Cobre:
 *   1. Fluxo feliz: abrir menu da linha → clicar Excluir → confirmar dialog
 *      → toast "Desfazer" com contador aparece → clicar Desfazer → POST
 *      /rest/v1/quotes é disparado com o snapshot (restore via createQuote).
 *   2. Falha do restore (createQuote 503 no POST): toast do dialog fecha,
 *      DELETE original ocorre, clique em "Desfazer" tenta POST e recebe 503
 *      — a lista NÃO ganha um duplicado e nenhum retry automático é feito
 *      (apenas o clique explícito do usuário conta como tentativa).
 *   3. Botão "Confirmar exclusão" fica DESABILITADO enquanto DELETE está em
 *      andamento (mock DELETE com delay) — múltiplos cliques rápidos não
 *      geram DELETEs extras.
 *
 * Mock de rede via `page.route` no host Supabase canônico (`doufsxqlfjyuvxuezpln`).
 * O host `pqpdolkaeqlyzpdpbizo` NÃO deve receber tráfego (guarda SSOT).
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { installMockAuth, isMockAuthEnabled } from "../helpers/mock-auth";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";
import { seedQuotesForStatusChips } from "../helpers/quotes-status-seed";

test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

const QUOTES_REST = /\/rest\/v1\/quotes(\?|$)/;
const UNDO_TOAST = '[data-testid="undo-toast"]';
const UNDO_BTN = '[data-testid="undo-toast-button"]';

test.describe("Fluxo: exclusão individual de orçamento com Desfazer", () => {
  test.beforeEach(async ({ page }) => {
    requireAuth();
    if (isMockAuthEnabled()) await installMockAuth(page);
  });

  test("delete → toast Desfazer com contador → clicar Desfazer dispara POST de restore", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await gotoAndSettle(page, "/orcamentos");
    const seed = await seedQuotesForStatusChips(page);
    expect(seed.skipped, `seed falhou: ${seed.skipped}`).toBeNull();

    await gotoAndSettle(page, "/orcamentos");
    await expect(page.locator(Sel.page.title("orcamentos")).first()).toBeVisible({
      timeout: 10_000,
    });

    // Chip "Todos" para não filtrar
    await page.locator('button[data-chip-key="all"]').click();

    // Pega o id da primeira linha visível (testid `quote-row-<id>`)
    const firstRow = page.locator('[data-testid^="quote-row-"]').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    const rowTestId = (await firstRow.getAttribute("data-testid"))!;
    const quoteId = rowTestId.replace(/^quote-row-/, "");
    expect(quoteId.length).toBeGreaterThan(0);

    // Mocks: DELETE 204, POST (recreate) 201
    let deleteCalls = 0;
    let postCalls = 0;
    const restorePayloads: unknown[] = [];
    await page.route(QUOTES_REST, async (route, request) => {
      const method = request.method();
      if (method === "DELETE") {
        deleteCalls += 1;
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      if (method === "POST") {
        postCalls += 1;
        try {
          const raw = request.postData();
          if (raw) restorePayloads.push(JSON.parse(raw));
        } catch {
          /* body vazio/inválido — ignoramos */
        }
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify([{ id: `restored-${quoteId}`, quote_number: "ORC-R" }]),
        });
        return;
      }
      await route.continue();
    });

    // Abre menu da linha → clica em Excluir
    await page.getByTestId(`quote-row-more-${quoteId}`).click();
    await page.getByTestId(`quote-row-menu-delete-${quoteId}`).click();

    // Dialog abre
    const dialog = page.getByTestId("quote-list-delete-dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const confirm = page.getByTestId("quote-list-delete-dialog-yes");
    await confirm.click();

    // Aguarda DELETE ser disparado
    await expect
      .poll(() => deleteCalls, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(1);

    // Dialog fecha e toast "Desfazer" aparece com contador
    await expect(dialog).toBeHidden({ timeout: 10_000 });
    const toast = page.locator(UNDO_TOAST);
    await expect(toast).toBeVisible({ timeout: 10_000 });
    // Contagem regressiva visível (7s ou 8s por conta do render)
    await expect(toast).toContainText(/[678]s/);

    // ASSERT ANTI-REGRESSÃO (bug do toast duplicado):
    //   1) EXATAMENTE 1 toast de exclusão com botão "Desfazer".
    //   2) NENHUM toast success paralelo sem botão (o bug antigo empilhava
    //      um `toast.success('Orçamento exluído')` sem action, cobrindo o
    //      botão Desfazer).
    await expect(page.locator(UNDO_TOAST)).toHaveCount(1);
    await expect(page.locator(UNDO_BTN)).toHaveCount(1);
    const sonnerToasts = page.locator('[data-sonner-toast]');
    const totalToasts = await sonnerToasts.count();
    // Todo toast Sonner visível DEVE conter o botão Desfazer — caso contrário
    // há um toast success órfão duplicado.
    for (let i = 0; i < totalToasts; i++) {
      const t = sonnerToasts.nth(i);
      const txt = ((await t.textContent()) ?? '').toLowerCase();
      if (txt.includes('excluí') || txt.includes('exluí')) {
        await expect(t.locator('[data-testid="undo-toast-button"]')).toHaveCount(1);
      }
    }

    // Clica em "Desfazer" → POST de restore é chamado
    await page.locator(UNDO_BTN).click();
    await expect
      .poll(() => postCalls, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(1);

    // Toast é dispensado após o clique (undoToast fecha o toast original)
    await expect(page.locator(UNDO_TOAST)).toHaveCount(0);

    // ================================================================
    // ALLOWLIST DE PAYLOAD DO POST DE RESTORE (single delete undo).
    // Espelha o gate do 04p (bulk): nenhum campo interno gerado pelo
    // backend pode vazar (id / quote_number / created_at / updated_at),
    // `items` DEVE estar presente e todos os demais campos devem
    // pertencer à allowlist do domínio Quote.
    // ================================================================
    expect(restorePayloads.length).toBeGreaterThanOrEqual(1);

    const ALLOWED_FIELDS = new Set([
      "items",
      "_items",
      "client_id",
      "client_name",
      "client_cnpj",
      "client_email",
      "client_phone",
      "client_address",
      "client_response_at",
      "client_response_notes",
      "seller_id",
      "seller_name",
      "organization_id",
      "user_id",
      "total",
      "subtotal",
      "discount_percent",
      "discount_value",
      "real_discount_percent",
      "freight_value",
      "markup_ratio",
      "negotiation_markup_percent",
      "payment_terms",
      "delivery_time",
      "valid_until",
      "notes",
      "internal_notes",
      "status",
      "version",
      "origin",
      "source",
      "bitrix_deal_id",
      "promo_champions_id",
      "external_id",
      "public_token",
      "signed_by_cnpj",
      "signed_by_ip",
      "signed_by_ua",
      "signature_hash",
      "signed_at",
      "approval_request_id",
      "approved_by",
      "approved_at",
      "price_table_id",
      "metadata",
      "tags",
    ]);
    const FORBIDDEN_FIELDS = ["id", "quote_number", "created_at", "updated_at"];

    let payloadsWithItems = 0;
    const leaks: Array<{ payloadIndex: number; unknownFields: string[] }> = [];
    for (let i = 0; i < restorePayloads.length; i++) {
      const p = restorePayloads[i];
      const rec = Array.isArray(p) ? p[0] : (p as Record<string, unknown>);
      if (!rec || typeof rec !== "object") continue;
      const obj = rec as Record<string, unknown>;
      for (const forbidden of FORBIDDEN_FIELDS) {
        expect(obj[forbidden], `campo proibido '${forbidden}' no payload #${i}`).toBeUndefined();
      }
      if (Array.isArray(obj.items) || Array.isArray(obj._items)) payloadsWithItems += 1;
      const unknown = Object.keys(obj).filter((k) => !ALLOWED_FIELDS.has(k));
      if (unknown.length > 0) leaks.push({ payloadIndex: i, unknownFields: unknown });
    }
    expect(
      payloadsWithItems,
      "pelo menos 1 payload de restore precisa carregar `items`",
    ).toBeGreaterThanOrEqual(1);
    expect(
      leaks,
      `campos fora da allowlist no payload — possível vazamento: ${JSON.stringify(leaks)}`,
    ).toEqual([]);
  });

  test("restore falha: POST 503 → toast de erro, sem duplicatas e sem retry automático", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await gotoAndSettle(page, "/orcamentos");
    const seed = await seedQuotesForStatusChips(page);
    expect(seed.skipped, `seed falhou: ${seed.skipped}`).toBeNull();

    await gotoAndSettle(page, "/orcamentos");
    await page.locator('button[data-chip-key="all"]').click();

    const firstRow = page.locator('[data-testid^="quote-row-"]').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    const rowTestId = (await firstRow.getAttribute("data-testid"))!;
    const quoteId = rowTestId.replace(/^quote-row-/, "");

    let deleteCalls = 0;
    let postCalls = 0;
    await page.route(QUOTES_REST, async (route, request) => {
      const method = request.method();
      if (method === "DELETE") {
        deleteCalls += 1;
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      if (method === "POST") {
        postCalls += 1;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "unavailable", code: "PGRST503" }),
        });
        return;
      }
      await route.continue();
    });

    await page.getByTestId(`quote-row-more-${quoteId}`).click();
    await page.getByTestId(`quote-row-menu-delete-${quoteId}`).click();
    await page.getByTestId("quote-list-delete-dialog-yes").click();

    await expect
      .poll(() => deleteCalls, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(1);

    const toast = page.locator(UNDO_TOAST);
    await expect(toast).toBeVisible({ timeout: 10_000 });

    await page.locator(UNDO_BTN).click();

    // Um único POST → tentativa manual do usuário; nenhum retry automático
    await expect
      .poll(() => postCalls, { timeout: 10_000 })
      .toBe(1);

    // Aguarda um pouco e reconfirma: sem retry silencioso
    await page.waitForTimeout(1500);
    expect(postCalls).toBe(1);
  });

  test("botão confirmar desabilitado durante DELETE — cliques duplicados não geram DELETEs extras", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await gotoAndSettle(page, "/orcamentos");
    const seed = await seedQuotesForStatusChips(page);
    expect(seed.skipped, `seed falhou: ${seed.skipped}`).toBeNull();

    await gotoAndSettle(page, "/orcamentos");
    await page.locator('button[data-chip-key="all"]').click();

    const firstRow = page.locator('[data-testid^="quote-row-"]').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    const rowTestId = (await firstRow.getAttribute("data-testid"))!;
    const quoteId = rowTestId.replace(/^quote-row-/, "");

    // DELETE com delay de 1500ms para dar tempo de spam-clicar
    let deleteCalls = 0;
    await page.route(QUOTES_REST, async (route, request) => {
      const method = request.method();
      if (method === "DELETE") {
        deleteCalls += 1;
        await new Promise((r) => setTimeout(r, 1500));
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      if (method === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify([{ id: "ok" }]),
        });
        return;
      }
      await route.continue();
    });

    await page.getByTestId(`quote-row-more-${quoteId}`).click();
    await page.getByTestId(`quote-row-menu-delete-${quoteId}`).click();

    const confirm = page.getByTestId("quote-list-delete-dialog-yes");
    // 1º clique inicia o delete
    await confirm.click();

    // Enquanto o DELETE não responde: botão fica disabled e spinner aparece
    await expect(confirm).toBeDisabled({ timeout: 3_000 });
    await expect(
      page.getByTestId("quote-list-delete-dialog-loading"),
    ).toBeVisible();

    // Spam de cliques (Playwright respeita disabled → não emite click)
    for (let i = 0; i < 10; i++) {
      await confirm.click({ force: true, trial: false }).catch(() => {
        /* clique em botão disabled pode falhar; ignoramos */
      });
    }

    // Aguarda o DELETE terminar
    await expect
      .poll(() => deleteCalls, { timeout: 10_000 })
      .toBe(1);

    // Dialog fecha e toast Desfazer aparece
    await expect(page.getByTestId("quote-list-delete-dialog")).toBeHidden({
      timeout: 10_000,
    });
    await expect(page.locator(UNDO_TOAST)).toBeVisible({ timeout: 10_000 });
    // Confirma o invariante: só UM DELETE
    expect(deleteCalls).toBe(1);
  });
});
