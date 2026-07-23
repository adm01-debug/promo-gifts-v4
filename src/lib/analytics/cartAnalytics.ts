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

/**
 * SSOT das origens UI possíveis para `cart.company_switched`.
 *   - `quick_add_selector` — QuickAdd (catálogo) abriu o CartSelectorDialog
 *     e o vendedor escolheu OUTRO carrinho antes do insert.
 *   - `seller_carts_page`  — troca detectada por mudança de rota em
 *     /carrinhos/:id (cards da lista, back/forward, deep-link).
 *
 * Regra de payload por origem (validada em cartAnalytics.contract.test.ts):
 *   - `seller_carts_page`  → `fromCartId` DEVE ser não-nulo (é uma troca
 *     A→B; o mount inicial não emite — validado no spec 12o).
 *   - `quick_add_selector` → `fromCartId` PODE ser null quando o vendedor
 *     escolhe o primeiro carrinho ativo (não há `activeCart` anterior).
 */
export const CART_SWITCH_SOURCES = [
  'quick_add_selector',
  'seller_carts_page',
] as const;
export type CartSwitchSource = (typeof CART_SWITCH_SOURCES)[number];

/**
 * SSOT das origens UI possíveis para `cart.checkout_started`.
 *   - `carts_list_page`     — clique em "Gerar Orçamento" no card da lista.
 *   - `cart_detail_header`  — clique no CTA do header dentro de /carrinhos/:id.
 */
export const CART_CHECKOUT_SOURCES = [
  'carts_list_page',
  'cart_detail_header',
] as const;
export type CartCheckoutSource = (typeof CART_CHECKOUT_SOURCES)[number];

export interface CartCompanySwitchedPayload {
  fromCartId: string | null;
  toCartId: string;
  companyId?: string | null;
  companyName?: string | null;
  /** Origem UI do evento — restrita ao enum `CartSwitchSource`. */
  source: CartSwitchSource;
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
  /** Origem UI do clique no CTA — restrita ao enum `CartCheckoutSource`. */
  source: CartCheckoutSource;
}

/**
 * SSOT dos motivos possíveis para `cart.company_switch_failed`.
 *   - `mutation_failed`  — o insert em `seller_cart_items` retornou erro
 *     não-recuperável (400/403/429/500 ou aborto de rede) após o vendedor
 *     escolher outra empresa no CartSelectorDialog.
 *   - `session_expired`  — JWT expirado (401/bad_jwt); o fluxo SSOT de
 *     recuperação de sessão assumiu (ver spec 12t).
 *   - `rate_limited`     — variação de `mutation_failed` para 429/PostgREST
 *     rate limit; separa métricas de saturação (ver spec 12u).
 */
export const CART_SWITCH_FAILURE_REASONS = [
  'mutation_failed',
  'session_expired',
  'rate_limited',
] as const;
export type CartSwitchFailureReason = (typeof CART_SWITCH_FAILURE_REASONS)[number];

export interface CartCompanySwitchFailedPayload {
  fromCartId: string | null;
  toCartId: string;
  companyId?: string | null;
  companyName?: string | null;
  source: CartSwitchSource;
  reason: CartSwitchFailureReason;
  /** Status HTTP quando conhecido (útil para dashboards por faixa). */
  status?: number | null;
}

export type CartAnalyticsEvent =
  | { name: 'cart.company_switched'; ts: string; payload: CartCompanySwitchedPayload }
  | { name: 'cart.company_switch_failed'; ts: string; payload: CartCompanySwitchFailedPayload }
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

export function trackCartCheckoutStarted(payload: CheckoutStartedPayload): void {
  const evt: CartAnalyticsEvent = {
    name: 'cart.checkout_started',
    ts: new Date().toISOString(),
    payload,
  };
  log.info('cart_checkout_started', { ...payload });
  pushToE2EBuffer(evt);
}

export function trackCartCompanySwitchFailed(
  payload: CartCompanySwitchFailedPayload,
): void {
  const evt: CartAnalyticsEvent = {
    name: 'cart.company_switch_failed',
    ts: new Date().toISOString(),
    payload,
  };
  // Severidade `warn` — não é erro fatal (o vendedor pode tentar de novo)
  // mas é um sinal de negócio que queremos ver agregado em dashboards.
  log.warn('cart_company_switch_failed', { ...payload });
  pushToE2EBuffer(evt);
}

/** Helper de teste — limpa o buffer entre cenários. */
export function __resetCartAnalyticsBufferForTests(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as Record<string, unknown>)[E2E_BUFFER_KEY] = [];
}
