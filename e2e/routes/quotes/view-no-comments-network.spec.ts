import { test, expect, type Request } from "@playwright/test";
import { loginAs } from "../../helpers/auth";
import { gotoAndSettle, waitForRouteIdle } from "../../helpers/nav";

/**
 * Garante que após a remoção do componente de comentários,
 * NENHUMA request à tabela `quote_comments` é disparada ao abrir o QuoteViewPage.
 */
test.describe("/orcamentos/:id — sem network em quote_comments", () => {
  test("não dispara nenhuma request a quote_comments", async ({ page }) => {
    const offenders: string[] = [];

    const onRequest = (req: Request) => {
      const url = req.url();
      // PostgREST: /rest/v1/quote_comments  | Realtime/RPC variantes
      if (/quote_comments/i.test(url)) {
        offenders.push(`${req.method()} ${url}`);
      }
    };
    page.on("request", onRequest);

    await loginAs(page);
    await gotoAndSettle(page, "/orcamentos/q-001");
    await waitForRouteIdle(page);

    // Settle adicional p/ capturar requests assíncronos pós-mount sem usar waitForTimeout
    await page.waitForLoadState("domcontentloaded");
    await page.evaluate(
      () => new Promise<void>((r) => setTimeout(r, 1500)),
    );

    page.off("request", onRequest);

    expect(
      offenders,
      `Foram detectadas requests proibidas a quote_comments:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
