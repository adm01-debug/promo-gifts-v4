import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SellerCartProvider, useSellerCartContext } from '@/contexts/SellerCartContext';

const mockMutate = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));

const carts = [
  {
    id: 'cart-1',
    company_name: 'Empresa A',
    notes: null,
    status: 'em_separacao',
    items: [
      { id: 'i1', product_id: 'p1', product_name: 'Caneta', product_price: 10, quantity: 2 },
      { id: 'i2', product_id: 'p2', product_name: 'Caderno', product_price: 5, quantity: 3 },
    ],
  },
];

vi.mock('@/hooks/products', () => ({
  noveltyToProduct: vi.fn(),
  useSellerCarts: () => ({
    carts,
    isLoading: false,
    totalItems: 2,
    canCreateCart: true,
    createCart: { mutateAsync: mockMutateAsync },
    deleteCart: { mutate: mockMutate },
    // addToActiveCart agora usa mutateAsync (awaitable, para reporte de sucesso em lote).
    addItem: { mutate: mockMutate, mutateAsync: mockMutate },
    removeItem: { mutate: mockMutate },
    updateItemQuantity: { mutate: mockMutate },
    updateItemNotes: { mutate: mockMutate },
    updateItemSortOrder: { mutate: mockMutate },
    updateCartNotes: { mutate: mockMutate },
    updateCartStatus: { mutate: mockMutate },
    duplicateCart: { mutate: mockMutate },
    moveItemToCart: { mutate: mockMutate },
    duplicateItemToCart: { mutate: mockMutate },
    clearCart: vi.fn(async () => undefined),
    restoreItems: { mutate: mockMutate },
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <SellerCartProvider>{children}</SellerCartProvider>
    </QueryClientProvider>
  );
};

describe('SellerCartContext - carrinho', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    mockMutate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('inclui item, altera quantidade e remove item delegando para mutações', () => {
    const { result } = renderHook(() => useSellerCartContext(), { wrapper });

    act(() => {
      result.current.addToActiveCart({
        product_id: 'p3',
        product_name: 'Mochila',
        product_price: 20,
        quantity: 1,
      });
      result.current.updateItemQuantity('i1', 7);
      result.current.removeItem('i2');
      // Avança os timers para disparar o debounce do updateItemQuantity
      vi.runAllTimers();
    });

    // add agora delega via mutateAsync({ cartId, item }) — sem 2º arg de opções
    // (o onSuccess foi internalizado no try/await para permitir await em lote).
    expect(mockMutate).toHaveBeenCalledWith({
      cartId: 'cart-1',
      item: expect.objectContaining({ product_id: 'p3', quantity: 1 }),
    });
    // updateItemQuantity usa debounce via useDebouncedCartItemActions — dispara após runAllTimers
    expect(mockMutate).toHaveBeenCalledWith(
      { itemId: 'i1', quantity: 7 },
      expect.objectContaining({ onError: expect.any(Function), onSuccess: expect.any(Function) }),
    );
    // removeItem passa callbacks de erro/sucesso/settled via useDebouncedCartItemActions
    expect(mockMutate).toHaveBeenCalledWith(
      'i2',
      expect.objectContaining({ onError: expect.any(Function), onSuccess: expect.any(Function) }),
    );
  });

  it('calcula subtotal/total em tempo real a partir dos itens atuais', () => {
    const { result } = renderHook(() => useSellerCartContext(), { wrapper });
    const subtotal =
      result.current.activeCart?.items.reduce(
        (acc, item) => acc + item.product_price * item.quantity,
        0,
      ) ?? 0;
    const total = subtotal;

    expect(subtotal).toBe(35);
    expect(total).toBe(35);
  });

  it('persiste carrinho ativo entre refresh com localStorage', () => {
    localStorage.setItem('seller:active-cart-id', 'cart-1');
    const { result } = renderHook(() => useSellerCartContext(), { wrapper });

    expect(result.current.activeCartId).toBe('cart-1');
    expect(localStorage.getItem('seller:active-cart-id')).toBe('cart-1');
  });
});
