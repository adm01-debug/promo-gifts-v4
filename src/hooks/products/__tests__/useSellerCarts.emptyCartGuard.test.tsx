/**
 * useSellerCarts.updateCartStatus — Defesa em profundidade "carrinho vazio".
 *
 * A UI (CartStatusSelect) já bloqueia visualmente a transição para
 * `pronto_orcamento` quando o carrinho está vazio, mas a mutação também
 * precisa recusar a chamada caso o cliente seja acionado por atalho,
 * teste ou race condition.
 *
 * Contrato validado aqui:
 *  1. Carrinho vazio → mutação lança Error com `code: 'EMPTY_CART'` e
 *     mensagem SSOT `EMPTY_CART_BLOCK_MESSAGE`.
 *  2. Carrinho vazio → `supabase.from('seller_carts').update(...)` NUNCA
 *     é chamado (defesa impede o round-trip).
 *  3. Carrinho com >=1 item → mutação chama `update({ status })`
 *     normalmente e resolve.
 *  4. Transição para `em_separacao` NÃO exige itens (nunca bloqueada).
 *  5. Toast de erro do sonner é emitido com a copy SSOT.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'seller-1', email: 's@t.com' } }),
}));

// Cartões controlados em mutable ref para os mocks do supabase.
const EMPTY_CART_ID = 'cart-empty';
const FULL_CART_ID = 'cart-full';
const CARTS_RAW = [
  {
    id: EMPTY_CART_ID,
    seller_id: 'seller-1',
    company_id: 'co-1',
    company_name: 'ACME',
    company_location: null,
    company_logo_url: null,
    notes: null,
    status: 'em_separacao',
    shipping_deadline: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    seller_cart_items: [],
  },
  {
    id: FULL_CART_ID,
    seller_id: 'seller-1',
    company_id: 'co-2',
    company_name: 'BETA',
    company_location: null,
    company_logo_url: null,
    notes: null,
    status: 'em_separacao',
    shipping_deadline: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    seller_cart_items: [
      {
        id: 'item-1',
        cart_id: FULL_CART_ID,
        product_id: 'p-1',
        product_name: 'Caneta',
        product_sku: null,
        product_image_url: null,
        product_price: 10,
        quantity: 3,
        color_name: null,
        color_hex: null,
        notes: null,
        sort_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
];

const updateSpy = vi.fn(() => ({
  eq: () => Promise.resolve({ data: null, error: null }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'seller_carts') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                order: () => Promise.resolve({ data: CARTS_RAW, error: null }),
              }),
            }),
          }),
          update: (payload: unknown) => {
            updateSpy(payload);
            return {
              eq: () => Promise.resolve({ data: null, error: null }),
            };
          },
        };
      }
      // Outras tabelas não são exercidas neste teste.
      return {
        select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
      };
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
  },
}));

// Importa o hook DEPOIS dos mocks.
import { useSellerCarts } from '@/hooks/products/useSellerCarts';
import { EMPTY_CART_BLOCK_MESSAGE } from '@/lib/carts/status-transition-guard';

function wrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

describe('useSellerCarts.updateCartStatus — bloqueio EMPTY_CART', () => {
  beforeEach(() => {
    updateSpy.mockClear();
    toastError.mockClear();
    toastSuccess.mockClear();
  });

  it('recusa mutação para pronto_orcamento quando carrinho está vazio (lança code=EMPTY_CART)', async () => {
    const { result } = renderHook(() => useSellerCarts(), { wrapper: wrapper() });
    await waitFor(() => {
      expect(result.current.carts.length).toBeGreaterThan(0);
    });

    let caught: (Error & { code?: string }) | null = null;
    await act(async () => {
      try {
        await result.current.updateCartStatus.mutateAsync({
          cartId: EMPTY_CART_ID,
          status: 'pronto_orcamento',
        });
      } catch (e) {
        caught = e as Error & { code?: string };
      }
    });

    expect(caught).not.toBeNull();
    expect(caught!.code).toBe('EMPTY_CART');
    expect(caught!.message).toBe(EMPTY_CART_BLOCK_MESSAGE);

    // Nenhum round-trip PATCH deve ter acontecido.
    expect(updateSpy).not.toHaveBeenCalled();

    // Toast de erro do onError da mutation foi disparado.
    expect(toastError).toHaveBeenCalledWith(
      'Não foi possível atualizar o status',
      expect.objectContaining({ description: expect.any(String) }),
    );
  });

  it('permite mutação para pronto_orcamento quando o carrinho tem itens', async () => {
    const { result } = renderHook(() => useSellerCarts(), { wrapper: wrapper() });
    await waitFor(() => {
      expect(result.current.carts.length).toBeGreaterThan(0);
    });

    await act(async () => {
      await result.current.updateCartStatus.mutateAsync({
        cartId: FULL_CART_ID,
        status: 'pronto_orcamento',
      });
    });

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith({ status: 'pronto_orcamento' });
    expect(toastError).not.toHaveBeenCalled();
  });

  it('permite transição para em_separacao mesmo com carrinho vazio (regra só se aplica a pronto_orcamento)', async () => {
    const { result } = renderHook(() => useSellerCarts(), { wrapper: wrapper() });
    await waitFor(() => {
      expect(result.current.carts.length).toBeGreaterThan(0);
    });

    await act(async () => {
      await result.current.updateCartStatus.mutateAsync({
        cartId: EMPTY_CART_ID,
        status: 'em_separacao',
      });
    });

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith({ status: 'em_separacao' });
  });
});
