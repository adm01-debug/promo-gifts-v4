/**
 * SellerCartContext.restore-pointer — ponteiro do carrinho ativo após Desfazer.
 *
 * Garante que, após um `restoreCart(snapshot)`, o `activeCartId` (e o
 * localStorage namespeado por usuário) NÃO fica apontando para o id ANTIGO do
 * snapshot. Regras cobertas:
 *
 *  1) Se o carrinho ativo foi excluído (activeCartId=null após deleteCart),
 *     o restore auto-foca no novo id.
 *  2) Se o ponteiro atual coincide com o id do snapshot (caso defensivo,
 *     ex.: race em delete não-ativo), o restore corrige para o novo id.
 *  3) Se já existe outra seleção ativa (não relacionada ao snapshot), o
 *     restore NÃO sequestra o foco.
 *  4) O localStorage é atualizado com o NOVO id (nunca fica com o antigo).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const USER_ID = 'seller-x';
const STORAGE_KEY = `seller:active-cart-id:${USER_ID}`;

// Mock de useSellerCarts com um restoreCartWithItems controlável por teste.
const restoreMutateAsync = vi.fn();

vi.mock('@/hooks/products', async () => {
  const actual = await vi.importActual('@/hooks/products');
  return {
    ...actual,
    useSellerCarts: () => ({
      carts: [],
      isLoading: false,
      totalItems: 0,
      canCreateCart: true,
      createCart: { mutateAsync: vi.fn() },
      deleteCart: { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false },
      addItem: { mutateAsync: vi.fn() },
      removeItem: { mutate: vi.fn() },
      updateItemQuantity: { mutate: vi.fn() },
      updateItemNotes: { mutate: vi.fn() },
      updateItemSortOrder: { mutate: vi.fn() },
      updateCartNotes: { mutate: vi.fn() },
      updateCartStatus: { mutate: vi.fn() },
      updateCartShippingDeadline: { mutate: vi.fn() },
      duplicateCart: { mutate: vi.fn() },
      moveItemToCart: { mutate: vi.fn() },
      duplicateItemToCart: { mutate: vi.fn() },
      clearCart: vi.fn(),
      restoreItems: { mutate: vi.fn() },
      restoreCartWithItems: { mutateAsync: restoreMutateAsync },
    }),
  };
});

vi.mock('@/hooks/products/useDebouncedCartItemActions', () => ({
  useDebouncedCartItemActions: () => ({
    updateItemQuantity: vi.fn(),
    removeItem: vi.fn(),
    itemErrors: {},
    clearItemError: vi.fn(),
  }),
  getCartItemDebounceMs: () => 0,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: USER_ID } }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/lib/security/sanitize-error', () => ({
  sanitizeError: (e: Error) => e.message,
}));

import { SellerCartProvider, useSellerCartContext } from '../SellerCartContext';
import type { SellerCart } from '@/hooks/products';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <SellerCartProvider>{children}</SellerCartProvider>
    </QueryClientProvider>
  );
}

const SNAPSHOT: SellerCart = {
  id: 'old-cart-id',
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
  // Precisa ter >= 1 item para não cair na guarda anti-restore-vazio do
  // `restoreCart` (que retorna undefined sem chamar a mutation).
  items: [
    {
      id: 'it-1',
      cart_id: 'old-cart-id',
      product_id: 'p-1',
      product_name: 'Caneca',
      product_sku: null,
      product_image_url: null,
      product_price: 10,
      quantity: 1,
      color_name: null,
      color_hex: null,
      notes: null,
      sort_order: 0,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  ],
};

describe('SellerCartContext — ponteiro ativo após restore (localStorage)', () => {
  beforeEach(() => {
    restoreMutateAsync.mockReset();
    localStorage.clear();
  });

  it('1) sem seleção ativa → auto-foca no carrinho restaurado', async () => {
    restoreMutateAsync.mockResolvedValue({ id: 'new-cart-A' });
    const { result } = renderHook(() => useSellerCartContext(), { wrapper });

    // Hidrata (activeCartId null pois localStorage vazio)
    await waitFor(() => expect(result.current).toBeTruthy());

    let newId: string | undefined;
    await act(async () => {
      newId = await result.current.restoreCart(SNAPSHOT);
    });

    expect(newId).toBe('new-cart-A');
    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBe('new-cart-A');
    });
  });

  it('2) ponteiro coincide com id ANTIGO do snapshot → corrige para o novo id', async () => {
    localStorage.setItem(STORAGE_KEY, SNAPSHOT.id);
    restoreMutateAsync.mockResolvedValue({ id: 'new-cart-B' });

    const { result } = renderHook(() => useSellerCartContext(), { wrapper });
    await waitFor(() => expect(result.current).toBeTruthy());

    await act(async () => {
      await result.current.restoreCart(SNAPSHOT);
    });

    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBe('new-cart-B');
    });
    expect(localStorage.getItem(STORAGE_KEY)).not.toBe(SNAPSHOT.id);
  });

  it('3) já existe outra seleção ativa → restore NÃO sequestra o foco', async () => {
    localStorage.setItem(STORAGE_KEY, 'other-active');
    restoreMutateAsync.mockResolvedValue({ id: 'new-cart-C' });

    const { result } = renderHook(() => useSellerCartContext(), { wrapper });
    await waitFor(() => expect(result.current).toBeTruthy());

    await act(async () => {
      await result.current.restoreCart(SNAPSHOT);
    });

    // Pointer preservado — não foi sequestrado pelo restore.
    expect(localStorage.getItem(STORAGE_KEY)).toBe('other-active');
  });

  it('4) falha no restore → ponteiro NÃO é alterado', async () => {
    restoreMutateAsync.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useSellerCartContext(), { wrapper });
    await waitFor(() => expect(result.current).toBeTruthy());

    const before = localStorage.getItem(STORAGE_KEY);
    let newId: string | undefined;
    await act(async () => {
      newId = await result.current.restoreCart(SNAPSHOT);
    });
    expect(newId).toBeUndefined();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
  });
});
