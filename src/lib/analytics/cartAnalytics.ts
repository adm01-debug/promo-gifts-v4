/**
 * cartAnalytics — eventos de telemetria dos fluxos de carrinho.
 *
 * SSOT para dois eventos de negócio críticos:
 *   - `cart.company_switched` — vendedor trocou o carrinho ativo (escolheu
 *     outra empresa via CartSelectorDialog ou CartCompanyPicker).
 *   - `cart.quote_finalized` — vendedor clicou em "Gerar Orçamento" e o
 *     handoff para /orcamentos/novo foi disparado com sucesso.
 *
 * Emissão em três camadas (o E2E consome a mais barata):
 *   1. `structuredLogger` (JSON no console + Sentry) — canal oficial.
 *   2. `window.dispatchEvent('lovable:analytics')` — hook para observers
 *      (ex.: futuros pixels/GTM).
 *   3. `window.__e2eAnalytics__` (buffer append-only) — capturado por
 *      Playwright via `page.evaluate()` em specs de regressão.
 *
 * O buffer E2E é limitado a 200 entradas para não vazar memória em sessão
 * longa. Só é escrito quando `window` existe (SSR-safe).
 */
import { createClientLogger } from '@/lib/telemetry/structuredLogger';

const log = createClientLogger('cart.analytics');

export interface CartCompanySwitchedPayload {
  fromCartId: string | null;
  toCartId: string;
  companyId?: string | null;
  companyName?: string | null;
  /** Origem UI do evento (ex.: 'quick_add_selector', 'seller_carts_page'). */
  source: string;
}

export interface QuoteFinalizedPayload {
  cartId: string;
  companyId?: string | null;
  companyName?: string | null;
  itemCount: number;
}

export interface CheckoutStartedPayload {
  cartId: string;
  companyId?: string | null;
  companyName?: string | null;
  itemCount: number;
  /** Origem UI do clique no CTA (ex.: 'carts_list_page', 'cart_detail_header'). */
  source: string;
}

export type CartAnalyticsEvent =
  | { name: 'cart.company_switched'; ts: string; payload: CartCompanySwitchedPayload }
  | { name: 'cart.checkout_started'; ts: string; payload: CheckoutStartedPayload }
  | { name: 'cart.quote_finalized'; ts: string; payload: QuoteFinalizedPayload };

const E2E_BUFFER_KEY = '__e2eAnalytics__';
const E2E_BUFFER_LIMIT = 200;

function pushToE2EBuffer(evt: CartAnalyticsEvent): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, unknown>;
  const buf = (w[E2E_BUFFER_KEY] as CartAnalyticsEvent[] | undefined) ?? [];
  buf.push(evt);
  if (buf.length > E2E_BUFFER_LIMIT) buf.splice(0, buf.length - E2E_BUFFER_LIMIT);
  w[E2E_BUFFER_KEY] = buf;
  try {
    window.dispatchEvent(new CustomEvent('lovable:analytics', { detail: evt }));
  } catch {
    // Ambientes sem CustomEvent (JSDOM antigo) — o buffer já foi atualizado.
  }
}

export function trackCartCompanySwitched(payload: CartCompanySwitchedPayload): void {
  const evt: CartAnalyticsEvent = {
    name: 'cart.company_switched',
    ts: new Date().toISOString(),
    payload,
  };
  log.info('cart_company_switched', { ...payload });
  pushToE2EBuffer(evt);
}

export function trackQuoteFinalizedFromCart(payload: QuoteFinalizedPayload): void {
  const evt: CartAnalyticsEvent = {
    name: 'cart.quote_finalized',
    ts: new Date().toISOString(),
    payload,
  };
  log.info('cart_quote_finalized', { ...payload });
  pushToE2EBuffer(evt);
}

/** Helper de teste — limpa o buffer entre cenários. */
export function __resetCartAnalyticsBufferForTests(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as Record<string, unknown>)[E2E_BUFFER_KEY] = [];
}
