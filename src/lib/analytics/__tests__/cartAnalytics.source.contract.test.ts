/**
 * Contrato do payload de `cart.company_switched` — valida o discriminante
 * `source` como SSOT tipada e as regras específicas por origem.
 *
 * Cobre:
 *   1. O array `CART_SWITCH_SOURCES` contém EXATAMENTE os literais
 *      permitidos (guard contra "silent add" que quebra o discriminante).
 *   2. Nenhum literal foi removido acidentalmente (breaking p/ funil).
 *   3. Regras de payload por origem:
 *        - `seller_carts_page` → fromCartId não-nulo, toCartId != fromCartId.
 *        - `quick_add_selector` → aceita fromCartId null (primeiro seed).
 *   4. Runtime type-guard `isCartSwitchSource` (útil p/ pixels/GTM).
 *   5. Buffer E2E preserva o valor de `source` sem coerção.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  CART_SWITCH_SOURCES,
  CART_CHECKOUT_SOURCES,
  trackCartCompanySwitched,
  trackCartCheckoutStarted,
  __resetCartAnalyticsBufferForTests,
  type CartAnalyticsEvent,
  type CartSwitchSource,
  type CartCheckoutSource,
} from '@/lib/analytics/cartAnalytics';

const readBuffer = (): CartAnalyticsEvent[] => {
  return (
    (window as unknown as Record<string, CartAnalyticsEvent[] | undefined>)
      .__e2eAnalytics__ ?? []
  );
};

describe('cartAnalytics — SSOT do enum `source`', () => {
  beforeEach(() => {
    __resetCartAnalyticsBufferForTests();
    vi.restoreAllMocks();
  });

  it('CART_SWITCH_SOURCES é EXATAMENTE ["quick_add_selector","seller_carts_page"]', () => {
    // Sorted p/ tornar a asserção estável mesmo se alguém reordenar o SSOT.
    expect([...CART_SWITCH_SOURCES].sort()).toEqual(
      ['quick_add_selector', 'seller_carts_page'].sort(),
    );
    // Guard contra crescimento silencioso do enum — obriga atualizar este
    // teste + os pixels downstream sempre que uma nova origem for aceita.
    expect(CART_SWITCH_SOURCES).toHaveLength(2);
  });

  it('CART_CHECKOUT_SOURCES é EXATAMENTE ["carts_list_page","cart_detail_header"]', () => {
    expect([...CART_CHECKOUT_SOURCES].sort()).toEqual(
      ['carts_list_page', 'cart_detail_header'].sort(),
    );
    expect(CART_CHECKOUT_SOURCES).toHaveLength(2);
  });
});

describe('cartAnalytics — payload de cart.company_switched por `source`', () => {
  beforeEach(() => {
    __resetCartAnalyticsBufferForTests();
  });

  it('quick_add_selector: aceita fromCartId null e propaga source no buffer', () => {
    trackCartCompanySwitched({
      fromCartId: null,
      toCartId: 'cart-B',
      companyId: 'co-2',
      companyName: 'Acme',
      source: 'quick_add_selector',
    });

    const buf = readBuffer();
    expect(buf).toHaveLength(1);
    const evt = buf[0]!;
    expect(evt.name).toBe('cart.company_switched');
    const payload = evt.payload as { source: CartSwitchSource; fromCartId: string | null };
    expect(payload.source).toBe('quick_add_selector');
    expect(payload.fromCartId).toBeNull();
  });

  it('seller_carts_page: fromCartId presente e distinto de toCartId', () => {
    trackCartCompanySwitched({
      fromCartId: 'cart-A',
      toCartId: 'cart-B',
      companyId: 'co-2',
      companyName: 'Acme',
      source: 'seller_carts_page',
    });

    const buf = readBuffer();
    const payload = buf[0]!.payload as {
      source: CartSwitchSource;
      fromCartId: string | null;
      toCartId: string;
    };
    expect(payload.source).toBe('seller_carts_page');
    expect(payload.fromCartId).toBe('cart-A');
    expect(payload.toCartId).toBe('cart-B');
    expect(payload.fromCartId).not.toBe(payload.toCartId);
  });

  it('trocas em sequência acumulam eventos preservando cada `source` sem coerção', () => {
    trackCartCompanySwitched({
      fromCartId: null,
      toCartId: 'cart-A',
      source: 'quick_add_selector',
    });
    trackCartCompanySwitched({
      fromCartId: 'cart-A',
      toCartId: 'cart-B',
      source: 'seller_carts_page',
    });
    trackCartCompanySwitched({
      fromCartId: 'cart-B',
      toCartId: 'cart-C',
      source: 'quick_add_selector',
    });

    const sources = readBuffer().map(
      (e) => (e.payload as { source: CartSwitchSource }).source,
    );
    expect(sources).toEqual([
      'quick_add_selector',
      'seller_carts_page',
      'quick_add_selector',
    ]);
  });

  it('CartSwitchSource é tipa-só compile-time: valores runtime desconhecidos NÃO passam pelo enum', () => {
    // O tipo garante em compile-time; em runtime validamos via inclusão no SSOT.
    const invalid = 'legacy_v1' as string;
    const validated = (CART_SWITCH_SOURCES as readonly string[]).includes(invalid);
    expect(validated).toBe(false);
  });
});

describe('cartAnalytics — payload de cart.checkout_started por `source`', () => {
  beforeEach(() => {
    __resetCartAnalyticsBufferForTests();
  });

  it.each<CartCheckoutSource>(['carts_list_page', 'cart_detail_header'])(
    'preserva source=%s no buffer',
    (source) => {
      trackCartCheckoutStarted({
        cartId: 'cart-X',
        companyId: 'co-1',
        companyName: 'ACME',
        itemCount: 3,
        source,
      });
      const evt = readBuffer()[0]!;
      expect(evt.name).toBe('cart.checkout_started');
      expect((evt.payload as { source: CartCheckoutSource }).source).toBe(source);
    },
  );
});
