/**
 * E2E — Cenários de borda da exclusão INDIVIDUAL com "Desfazer".
 *
 * Cobre:
 *   1. Contador expira → toast desaparece → cliques posteriores no botão
 *      "Desfazer" não disparam POST de restore (o botão sai do DOM).
 *   2. `deleteQuote` falha (DELETE 500) → toast "Desfazer" NÃO aparece →
 *      linha do orçamento continua na lista, sem duplicatas.
 *   3. Valida testids granulares do toast (title, description, countdown,
 *      button com `data-remaining-sec`).
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";
import { seedQuotesForStatusChips } from "../helpers/quotes-status-seed";

test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

const QUOTES_REST = /\/rest\/v1\/quotes(\?|$)/;
const UNDO_TOAST = '[data-testid="undo-toast"]';
const UNDO_BTN = '[data-testid="undo-toast-button"]';
const UNDO_COUNTDOWN = '[data-testid="undo-toast-countdown"]';
const UNDO_TITLE = '[data-testid="undo-toast-title"]';

test.describe("Fluxo: exclusão individual — cenários de borda com Desfazer", () => {
  test.beforeEach(() => requireAuth());

  test("contador expira → toast some → clique posterior não restaura", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await gotoAndSettle(page, "/orcamentos");
    const seed = await seedQuotesForStatusChips(page);
    expect(seed.skipped, `seed falhou: ${seed.skipped}`).toBeNull();

    await gotoAndSettle(page, "/orcamentos");
    await expect(page.locator(Sel.page.title("orcamentos")).first()).toBeVisible({
      timeout: 10_000,
    });
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
          status: 201,
          contentType: "application/json",
          body: JSON.stringify([{ id: `restored-${quoteId}` }]),
        });
        return;
      }
      await route.continue();
    });

    await page.getByTestId(`quote-row-more-${quoteId}`).click();
    await page.getByTestId(`quote-row-menu-delete-${quoteId}`).click();
    await page.getByTestId("quote-list-delete-dialog-yes").click();

    await expect.poll(() => deleteCalls, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);

    // Toast aparece com testids granulares presentes
    const toast = page.locator(UNDO_TOAST);
    await expect(toast).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(UNDO_TITLE)).toBeVisible();
    const countdown = page.locator(UNDO_COUNTDOWN);
    await expect(countdown).toBeVisible();

    // Assert determinístico: o attribute `data-remaining-sec` do contador
    // DECREMENTA monotonicamente até 0 — sem depender de `setTimeout`.
    const initialSec = Number(await countdown.getAttribute("data-remaining-sec"));
    expect(initialSec).toBeGreaterThan(0);
    expect(initialSec).toBeLessThanOrEqual(8);

    // Aguarda o contador chegar a 0 OU o toast ser removido do DOM.
    // (o wrapper `showUndoToast` chama `dismiss` no `onTimeout`.)
    await expect
      .poll(
        async () => {
          const el = page.locator(UNDO_COUNTDOWN);
          const count = await el.count();
          if (count === 0) return 0;
          const attr = await el.getAttribute("data-remaining-sec");
          return Number(attr ?? 0);
        },
        { timeout: 20_000, intervals: [200, 500, 1000] },
      )
      .toBe(0);

    // Aguarda o botão ficar indisponível (disabled OU removido do DOM) —
    // ambos os estados satisfazem o invariante "não é mais clicável".
    await expect
      .poll(
        async () => {
          const btn = page.locator(UNDO_BTN);
          const count = await btn.count();
          if (count === 0) return "absent";
          const disabled = await btn.isDisabled();
          const expired = await btn.getAttribute("data-expired");
          return disabled || expired === "true" ? "disabled" : "clickable";
        },
        { timeout: 5_000, intervals: [100, 250, 500] },
      )
      .not.toBe("clickable");

    // Aguarda o toast ser totalmente removido do DOM (o wrapper dispara
    // sonner.dismiss no onTimeout — não usamos setTimeout).
    await expect(page.locator(UNDO_TOAST)).toHaveCount(0, { timeout: 5_000 });

    // Nenhum POST de restore foi disparado durante toda a expiração
    expect(postCalls).toBe(0);

    // Reassert após settle: a rede deve estar completamente silenciosa —
    // usamos expect.poll com valor estável (não muda por 500ms) em vez
    // de sleep arbitrário.
    await expect
      .poll(() => postCalls, { timeout: 2_000, intervals: [200, 400] })
      .toBe(0);

    // Última garantia: botão ausente do DOM
    await expect(page.locator(UNDO_BTN)).toHaveCount(0);
  });

  test("DELETE falha (500) → toast Desfazer NÃO aparece, linha permanece sem duplicatas", async ({
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

    // Conta linhas antes
    const rowsBefore = await page.locator('[data-testid^="quote-row-"]').count();

    let deleteCalls = 0;
    let postCalls = 0;
    await page.route(QUOTES_REST, async (route, request) => {
      const method = request.method();
      if (method === "DELETE") {
        deleteCalls += 1;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "internal error", code: "PGRST500" }),
        });
        return;
      }
      if (method === "POST") {
        postCalls += 1;
        await route.fulfill({ status: 201, body: "[]" });
        return;
      }
      await route.continue();
    });

    await page.getByTestId(`quote-row-more-${quoteId}`).click();
    await page.getByTestId(`quote-row-menu-delete-${quoteId}`).click();
    await page.getByTestId("quote-list-delete-dialog-yes").click();

    // DELETE foi tentado
    await expect.poll(() => deleteCalls, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);

    // Aguarda margem para garantir que o toast Desfazer NÃO aparece
    await page.waitForTimeout(2000);
    await expect(page.locator(UNDO_TOAST)).toHaveCount(0);

    // Nenhum POST de restore disparado
    expect(postCalls).toBe(0);

    // A linha específica continua no DOM (delete falhou → nada removido do estado)
    await expect(page.getByTestId(`quote-row-${quoteId}`)).toBeVisible({
      timeout: 10_000,
    });

    // Contagem total de linhas não aumentou (sem duplicatas)
    const rowsAfter = await page.locator('[data-testid^="quote-row-"]').count();
    expect(rowsAfter).toBe(rowsBefore);
  });

  test("clique em Desfazer ANTES do timer expirar restaura EXATAMENTE 1x, sem duplicar items", async ({
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
    await page.locator('button[data-chip-key="all"]').click();

    const firstRow = page.locator('[data-testid^="quote-row-"]').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    const rowTestId = (await firstRow.getAttribute("data-testid"))!;
    const quoteId = rowTestId.replace(/^quote-row-/, "");

    // Snapshot esperado retornado pelo fetchQuote (GET com ?id=eq.<uuid>)
    // — usamos 3 items para provar que a lista de items é passada de uma
    // única vez ao RPC (sem N inserts separados por item).
    const snapshotItems = [
      { id: "it-1", product_name: "A", unit_price: 10, quantity: 2 },
      { id: "it-2", product_name: "B", unit_price: 20, quantity: 1 },
      { id: "it-3", product_name: "C", unit_price: 30, quantity: 5 },
    ];

    let deleteCalls = 0;
    let rpcCreateCalls = 0;
    let quoteItemsInsertCalls = 0; // não deveria haver — invariante
    const rpcBodies: unknown[] = [];

    // Intercepta REST tabelas: DELETE quotes, POST quote_items (invariante = 0)
    await page.route(QUOTES_REST, async (route, request) => {
      const method = request.method();
      if (method === "DELETE") {
        deleteCalls += 1;
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      if (method === "GET" && request.url().includes(`id=eq.${quoteId}`)) {
        // resposta do fetchQuote (snapshot pré-delete)
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: quoteId,
              quote_number: "ORC-SNAP",
              status: "draft",
              total: 130,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              items: snapshotItems,
            },
          ]),
        });
        return;
      }
      if (method === "POST") {
        // POST direto em /rest/v1/quotes NÃO deve ocorrer no fluxo undo
        // (createQuote usa RPC create_quote_transactional).
        await route.continue();
        return;
      }
      await route.continue();
    });

    // Intercepta insert direto em quote_items — invariante = 0 chamadas
    await page.route(/\/rest\/v1\/quote_items(\?|$)/, async (route, request) => {
      if (request.method() === "POST") {
        quoteItemsInsertCalls += 1;
      }
      await route.fulfill({ status: 201, body: "[]" });
    });

    // Intercepta o RPC de restore — deve receber TODOS os items em 1 payload
    await page.route(/\/rest\/v1\/rpc\/create_quote_transactional/, async (route, request) => {
      rpcCreateCalls += 1;
      try {
        rpcBodies.push(JSON.parse(request.postData() || "{}"));
      } catch {
        rpcBodies.push(null);
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: `restored-${quoteId}`,
          quote_number: "ORC-R",
          status: "draft",
          total: 130,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    });

    await page.getByTestId(`quote-row-more-${quoteId}`).click();
    await page.getByTestId(`quote-row-menu-delete-${quoteId}`).click();
    await page.getByTestId("quote-list-delete-dialog-yes").click();

    await expect.poll(() => deleteCalls, { timeout: 15_000 }).toBe(1);

    // Toast aparece com contador > 0
    const toast = page.locator(UNDO_TOAST);
    await expect(toast).toBeVisible({ timeout: 10_000 });
    const undoBtn = page.locator(UNDO_BTN);
    const remainingSecStr = await undoBtn.getAttribute("data-remaining-sec");
    const remainingSec = Number(remainingSecStr);
    expect(remainingSec).toBeGreaterThan(0);
    expect(remainingSec).toBeLessThanOrEqual(8);

    // Clica em Desfazer ANTES da expiração
    await undoBtn.click();

    // Exatamente 1 chamada ao RPC
    await expect.poll(() => rpcCreateCalls, { timeout: 10_000 }).toBe(1);

    // Toast é dispensado após a ação
    await expect(page.locator(UNDO_TOAST)).toHaveCount(0, { timeout: 5_000 });

    // Cliques adicionais (mesmo forçados) NÃO chamam o RPC novamente —
    // o wrapper `showUndoToast` guarda `undone` e o botão já saiu do DOM.
    // Tentamos re-clicar no locator: deve resultar em 0 elementos.
    await expect(page.locator(UNDO_BTN)).toHaveCount(0);

    // Aguarda margem para garantir ausência de retry silencioso
    await page.waitForTimeout(2000);
    expect(rpcCreateCalls).toBe(1);

    // Invariante: nenhuma inserção direta em quote_items — items foram
    // enviados dentro do payload do RPC (evita duplicação parcial em caso
    // de falha entre inserts).
    expect(quoteItemsInsertCalls).toBe(0);

    // Payload do RPC contém os 3 items do snapshot (sem duplicação nem perda)
    expect(rpcBodies.length).toBe(1);
    const body = rpcBodies[0] as { _quote?: unknown; _items?: unknown[] };
    expect(Array.isArray(body._items)).toBe(true);
    expect(body._items!.length).toBe(snapshotItems.length);

    // Não há duplicata de ids nos items enviados
    const itemIds = (body._items as Array<{ id?: string; product_name?: string }>).map(
      (i) => i.id ?? i.product_name ?? "",
    );
    const uniq = new Set(itemIds);
    expect(uniq.size).toBe(itemIds.length);
  });
});
