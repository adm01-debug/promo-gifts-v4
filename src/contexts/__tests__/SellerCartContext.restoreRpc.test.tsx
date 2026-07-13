/**
 * SellerCartContext — restauração ATÔMICA via RPC `restore_seller_cart`.
 *
 * Cobre os 3 modos de falha que o path client-side antigo engolia
 * silenciosamente e o novo path (RPC + toast com description sanitizada +
 * console.error estruturado) tem que expor:
 *
 *   1) `unique_cart_item_variant` (23505) — colisão de item na mesma
 *      combinação (cart_id, product_id, color_name). Novo path: erro
 *      NÃO engolido; toast.error é emitido; console.error é chamado
 *      com snapshot_id e items_count; restoreCart retorna undefined.
 *
 *   2) Itens duplicados no snapshot com color_name null. Novo path:
 *      chama a RPC uma única vez com o array bruto (dedup acontece
 *      dentro do Postgres). Se a RPC resolve com sucesso, restoreCart
 *      retorna o cart_id.
 *
 *   3) RLS negando o INSERT (42501). Erro NÃO engolido; toast.error
 *      inclui a mensagem sanitizada; console.error registra o motivo.
 *
 * Esses testes mockam a chamada `supabase.rpc('restore_seller_cart', ...)`
 * porque a lógica atômica vive no Postgres (função SECURITY DEFINER); o
 * contrato client é: "propagar erro sem engolir, incluir contexto".
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const USER_ID = 'seller-x';

const rpcMock = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: () => ({
      select: () => ({
        eq: () => ({ order: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
      }),
    }),
    auth: {
      getUser: async () => ({ data: { user: { id: USER_ID } }, error: null }),
    },
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: USER_ID } }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/lib/security/sanitize-error', () => ({
  sanitizeError: (e: unknown) => {
    if (e instanceof Error) return e.message;
    if (e && typeof e === 'object' && 'message' in e) {
      return String((e as { message: unknown }).message);
    }
    return String(e);
  },
}));

vi.mock('@/hooks/products/useDebouncedCartItemActions', () => ({
  useDebouncedCartItemActions: () => ({
    updateItemQuantity: vi.fn(),
    removeItem: vi.fn(),
    itemErrors: {},
    clearItemError: vi.fn(),
  }),
  getCartItemDebounceMs: () => 0,
}));

import { SellerCartProvider, useSellerCartContext } from '../SellerCartContext';
import type { SellerCart, SellerCartItem } from '@/hooks/products';

function Wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <SellerCartProvider>{children}</SellerCartProvider>
    </QueryClientProvider>
  );
}

const baseItem: SellerCartItem = {
  id: 'item-1',
  cart_id: 'old-cart',
  product_id: 'p-1',
  product_name: 'Caneca',
  product_sku: null,
  product_image_url: null,
  product_price: 10,
  quantity: 2,
  color_name: null,
  color_hex: null,
  notes: null,
  sort_order: 0,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

const snapshot: SellerCart = {
  id: 'old-cart',
  seller_id: USER_ID,
  company_id: 'c1',
  company_name: 'ACME',
  company_location: null,
  company_logo_url: null,
  notes: null,
  status: 'em_separacao',
  shipping_deadline: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  items: [
    { ...baseItem },
    // duplicado propositalmente com color_name null (case do
    // unique_cart_item_variant NULLS NOT DISTINCT):
    { ...baseItem, id: 'item-2', quantity: 3 },
  ],
};

describe('SellerCartContext — restoreCart via RPC (atômico, dedup, RLS)', () => {
  const originalError = console.error;
  beforeEach(() => {
    rpcMock.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    console.error = vi.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it('chama supabase.rpc("restore_seller_cart", ...) com o snapshot completo (delega dedup ao Postgres)', async () => {
    rpcMock.mockResolvedValue({
      data: { cart_id: 'new-1', items_total: 1, items_inserted: 1, items_deduped: 1 },
      error: null,
    });

    const { result } = renderHook(() => useSellerCartContext(), { wrapper: Wrap });
    await waitFor(() => expect(result.current).toBeTruthy());

    let newId: string | undefined;
    await act(async () => {
      newId = await result.current.restoreCart(snapshot);
    });

    expect(newId).toBe('new-1');
    expect(rpcMock).toHaveBeenCalledTimes(1);
    const [fn, payload] = rpcMock.mock.calls[0] as [string, { _snapshot: { items: unknown[] } }];
    expect(fn).toBe('restore_seller_cart');
    // O client envia os itens brutos (2 duplicados) — a dedup acontece no BD.
    expect(payload._snapshot.items).toHaveLength(2);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('unique_cart_item_variant (23505) → erro NÃO é engolido: toast.error com description + console.error + retorna undefined', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "unique_cart_item_variant"',
      },
    });

    const { result } = renderHook(() => useSellerCartContext(), { wrapper: Wrap });
    await waitFor(() => expect(result.current).toBeTruthy());

    let newId: string | undefined = 'sentinel';
    await act(async () => {
      newId = await result.current.restoreCart(snapshot);
    });

    expect(newId).toBeUndefined();
    expect(toastError).toHaveBeenCalledTimes(1);
    const [title, opts] = toastError.mock.calls[0] as [string, { description: string }];
    expect(title).toBe('Não foi possível restaurar o carrinho.');
    expect(opts.description).toContain('unique_cart_item_variant');
    expect(opts.description).toContain(`snapshot ${snapshot.id}`);
    expect(opts.description).toMatch(/\b2 item\(ns\)/);

    expect(console.error).toHaveBeenCalledWith(
      '[restoreCart] falha ao restaurar carrinho',
      expect.objectContaining({
        snapshot_id: 'old-cart',
        items_count: 2,
        raw_error: expect.stringContaining('unique_cart_item_variant'),
      }),
    );
  });

  it('RLS negando INSERT (42501) → erro NÃO é engolido: toast.error com description + console.error', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: '42501',
        message: 'new row violates row-level security policy for table "seller_carts"',
      },
    });

    const { result } = renderHook(() => useSellerCartContext(), { wrapper: Wrap });
    await waitFor(() => expect(result.current).toBeTruthy());

    await act(async () => {
      await result.current.restoreCart(snapshot);
    });

    expect(toastError).toHaveBeenCalledTimes(1);
    const [, opts] = toastError.mock.calls[0] as [string, { description: string }];
    expect(opts.description).toContain('row-level security');
    expect(console.error).toHaveBeenCalled();
  });

  it('sucesso → NÃO emite toast.error e devolve novo cart_id', async () => {
    rpcMock.mockResolvedValue({
      data: { cart_id: 'new-ok', items_total: 1, items_inserted: 1, items_deduped: 0 },
      error: null,
    });

    const { result } = renderHook(() => useSellerCartContext(), { wrapper: Wrap });
    await waitFor(() => expect(result.current).toBeTruthy());

    let id: string | undefined;
    await act(async () => {
      id = await result.current.restoreCart(snapshot);
    });

    expect(id).toBe('new-ok');
    expect(toastError).not.toHaveBeenCalled();
  });
});
