/**
 * cart-finalize.ts — helper SSOT para "finalizar o orçamento a partir
 * do carrinho ativo" em specs E2E.
 *
 * Motivação
 * ---------
 * Vários specs (12k, 12l, 12p, 12q, ...) repetem o mesmo bloco:
 *   1. navegar para `/carrinhos/:id`;
 *   2. clicar em `cart-checkout-cta`;
 *   3. aguardar URL `/orcamentos/novo`;
 *   4. bisbilhotar `window.__e2eAnalytics__` procurando
 *      `cart.quote_finalized` e comparar `payload.cartId`.
 *
 * Este helper centraliza a sequência, respeita a política de selectors
 * (apenas `data-testid` via `TID()`) e retorna o evento capturado para
 * asserções adicionais no chamador.
 *
 * Não realiza reset do buffer de analytics automaticamente — isso é
 * responsabilidade do spec (ex.: loop `12k` que reseta por iteração).
 * Use `resetAnalyticsBuffer(page)` de `./analytics` antes se precisar.
 */
import { expect, type Page } from "@playwright/test";
import { gotoAndSettle } from "./nav";
import { TID } from "../fixtures/selectors";
import { readAnalyticsEvents, type AnalyticsEvent } from "./analytics";
import type { MockCart } from "./cart-mock";

const TID_CHECKOUT_CTA = TID("cart-checkout-cta");

const DEFAULT_QUOTE_URL_REGEX = /\/orcamentos\/novo/i;
const EVENT_NAME_QUOTE_FINALIZED = "cart.quote_finalized";

export interface FinalizeActiveCartOptions {
  /**
   * Se `true` (default), navega até `/carrinhos/:id` antes de clicar no CTA.
   * Passe `false` quando o spec já está na página do carrinho.
   */
  navigate?: boolean;
  /**
   * Regex opcional para o destino após finalizar. Default:
   * `/\/orcamentos\/novo/i`. Custom em specs que redirecionam para outra rota.
   */
  expectedUrl?: RegExp;
  /**
   * Timeout do `waitForURL` pós-click. Default `10_000ms`.
   */
  navigationTimeout?: number;
  /**
   * Timeout para o evento `cart.quote_finalized` aparecer no buffer.
   * Default `3_000ms`. Passe `0` para pular a asserção de analytics
   * (não recomendado — quebra o contrato do evento).
   */
  analyticsTimeout?: number;
  /**
   * Label usada em mensagens de erro (ex.: `iter 3`). Default: `finalize`.
   */
  label?: string;
}

export interface FinalizeActiveCartResult {
  /** URL final após a finalização (já validada contra `expectedUrl`). */
  finalUrl: string;
  /** Evento `cart.quote_finalized` capturado (ou `null` se `analyticsTimeout=0`). */
  event: AnalyticsEvent | null;
}

/**
 * Finaliza o orçamento a partir do carrinho ativo `cart`.
 *
 * Fluxo:
 *  1. (opcional) navega para `/carrinhos/:id`;
 *  2. clica no CTA `cart-checkout-cta` (falha se ausente/oculto);
 *  3. aguarda `page.url()` casar `expectedUrl`;
 *  4. faz polling em `window.__e2eAnalytics__` até encontrar
 *     `cart.quote_finalized` referente ao `cart.id` — asserindo o payload;
 *  5. retorna `{ finalUrl, event }` para asserções adicionais.
 *
 * Todas as mensagens de erro incluem `label` para tornar loops legíveis.
 */
export async function finalizeActiveCart(
  page: Page,
  cart: Pick<MockCart, "id">,
  opts: FinalizeActiveCartOptions = {},
): Promise<FinalizeActiveCartResult> {
  const {
    navigate = true,
    expectedUrl = DEFAULT_QUOTE_URL_REGEX,
    navigationTimeout = 10_000,
    analyticsTimeout = 3_000,
    label = "finalize",
  } = opts;

  if (navigate) {
    await gotoAndSettle(page, `/carrinhos/${cart.id}`);
  }

  const cta = page.locator(TID_CHECKOUT_CTA).first();
  await expect(
    cta,
    `[${label}] CTA "cart-checkout-cta" deve estar visível para finalizar o carrinho ${cart.id}`,
  ).toBeVisible({ timeout: 5_000 });
  await expect(
    cta,
    `[${label}] CTA "cart-checkout-cta" NÃO pode estar desabilitado`,
  ).toBeEnabled({ timeout: 3_000 });

  await cta.click();

  await page.waitForURL(expectedUrl, { timeout: navigationTimeout });
  const finalUrl = page.url();
  expect(
    finalUrl,
    `[${label}] destino inesperado após finalizar: ${finalUrl}`,
  ).toMatch(expectedUrl);

  if (analyticsTimeout <= 0) {
    return { finalUrl, event: null };
  }

  // Aguarda o evento aparecer no buffer com o cartId correto — tolera
  // eventos legados de iterações anteriores desde que exista pelo menos
  // um casando o `cart.id`.
  await expect
    .poll(
      async () => {
        const events = await readAnalyticsEvents(page);
        return events.some(
          (e) =>
            e.name === EVENT_NAME_QUOTE_FINALIZED &&
            (e.payload as { cartId?: string } | undefined)?.cartId === cart.id,
        );
      },
      {
        timeout: analyticsTimeout,
        message: `[${label}] "${EVENT_NAME_QUOTE_FINALIZED}" com cartId=${cart.id} não foi emitido`,
      },
    )
    .toBe(true);

  const events = await readAnalyticsEvents(page);
  const event =
    events
      .filter(
        (e) =>
          e.name === EVENT_NAME_QUOTE_FINALIZED &&
          (e.payload as { cartId?: string } | undefined)?.cartId === cart.id,
      )
      .pop() ?? null;

  expect(
    event,
    `[${label}] evento "${EVENT_NAME_QUOTE_FINALIZED}" desapareceu do buffer entre poll e leitura`,
  ).not.toBeNull();

  return { finalUrl, event };
}
