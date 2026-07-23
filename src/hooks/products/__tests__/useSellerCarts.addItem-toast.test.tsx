/**
 * Contrato do toast de erro emitido pelo `addItem` do useSellerCarts.
 *
 * Objetivo:
 *   - Fixar título/descrição no SSOT `sellerCartToasts.ts`.
 *   - Garantir que o hook NÃO passa `duration:` (para manter auto-dismiss
 *     padrão do sonner ~4 s, do qual os specs E2E dependem).
 *   - Garantir que 1 falha == 1 toast (sem duplicação).
 *
 * Estratégia:
 *   Mockamos `sonner` e disparamos `addItem.mutateAsync` com um mock do
 *   supabase que rejeita, capturando os argumentos passados a `toast.error`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { SELLER_CART_TOASTS } from '../sellerCartToasts';

// ---- Mocks ---------------------------------------------------------------
const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-test-1' } }),
}));

vi.mock('@/lib/security/sanitize-error', () => ({
  sanitizeError: (err: Error) => `sanitized:${err.message}`,
}));

vi.mock('@/lib/telemetry/structuredLogger', () => ({
  createClientLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Supabase client — mock via Proxy que responde a QUALQUER cadeia
// `.from().select().eq().eq().is/eq().maybeSingle()` (findVariantInCart)
// e faz o `.insert(...)` rejeitar, exercitando o onError do addItem.
const insertRejects = vi.fn();
function makeChain(mode: 'select' | 'insert'): unknown {
  const chain: Record<string, unknown> = {};
  const proxy: unknown = new Proxy(chain, {
    get(_t, prop: string) {
      if (prop === 'then') return undefined; // não é thenable até o terminal
      if (prop === 'maybeSingle') {
        return async () => ({ data: null, error: null });
      }
      if (prop === 'single') {
        return async () => ({ data: null, error: null });
      }
      if (prop === 'insert') {
        return (payload: unknown) => insertRejects(payload);
      }
      // Encadeamento fluente: select/eq/is/update/order/... retornam o próprio proxy.
      return () => proxy;
    },
  });
  return mode === 'select' ? proxy : proxy;
}
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => makeChain('select'),
  },
}));

// ---- Fixture -------------------------------------------------------------
function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useSellerCarts · toast de erro do addItem (contrato de UI)', () => {
  beforeEach(() => {
    toastError.mockClear();
    toastSuccess.mockClear();
    insertRejects.mockReset();
  });
  afterEach(() => {
    vi.clearAllTimers();
  });

  it('SSOT · título e descrição estão fixados em sellerCartToasts', () => {
    // Guard-rail: se alguém renomear a chave, o teste falha antes do build.
    expect(SELLER_CART_TOASTS.addItemError.title).toBe(
      'Não foi possível adicionar ao carrinho',
    );
  });

  it('onError · usa o título SSOT e delega description a sanitizeError, SEM duration', async () => {
    insertRejects.mockRejectedValue(new Error('rls: 42501'));

    // Import dinâmico p/ garantir que os mocks estejam ativos.
    const { useSellerCarts } = await import('../useSellerCarts');

    const { result } = renderHook(() => useSellerCarts(), { wrapper });

    await act(async () => {
      try {
        await result.current.addItem.mutateAsync({
          cartId: 'cart-a',
          item: {
            product_id: 'p1',
            product_name: 'Caneta',
            product_sku: 'SKU-1',
            product_image_url: null,
            product_price: 10,
            quantity: 1,
          },
        });
      } catch {
        /* esperado — mutation propaga o erro */
      }
    });

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));

    const [title, options] = toastError.mock.calls[0] as [
      string,
      { description?: string; duration?: number },
    ];

    // 1. Título vem do SSOT (não é literal solto).
    expect(title).toBe(SELLER_CART_TOASTS.addItemError.title);

    // 2. Description sanitizada (não vaza stack/PostgREST cru pro usuário).
    expect(options?.description).toBe('sanitized:rls: 42501');

    // 3. Sem override de duration — auto-dismiss padrão do sonner. Este
    //    invariante é usado pelos specs E2E 12i/12m/12n.
    expect(options).not.toHaveProperty('duration');
  });

  it('idempotência · uma falha == exatamente um toast (sem duplicação)', async () => {
    insertRejects.mockRejectedValue(new Error('boom'));
    const { useSellerCarts } = await import('../useSellerCarts');
    const { result } = renderHook(() => useSellerCarts(), { wrapper });

    await act(async () => {
      try {
        await result.current.addItem.mutateAsync({
          cartId: 'cart-a',
          item: {
            product_id: 'p1',
            product_name: 'X',
            product_sku: 'X',
            product_image_url: null,
            product_price: 1,
            quantity: 1,
          },
        });
      } catch {
        /* esperado */
      }
    });

    // Aguarda o microtask do onError propagar.
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));

    // Nenhum toast de sucesso deve ter sido emitido em paralelo.
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
