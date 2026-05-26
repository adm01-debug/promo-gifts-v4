import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { orderService } from '@/services/orderService';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('orderService.fetchOrderForCurrentSeller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna pedido com status, itens e total consistente com fórmula do checkout', async () => {
    const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>;

    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                id: 'o-1',
                order_number: '1001',
                status: 'confirmed',
                total: 215,
                subtotal: 220,
                shipping_cost: 10,
                tax_amount: 5,
                discount_amount: 20,
                created_at: '2026-05-25T10:00:00Z',
                updated_at: '2026-05-25T10:00:00Z',
              },
              error: null,
            }),
        }),
      }),
    });

    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: [
                {
                  id: 'i-1',
                  order_id: 'o-1',
                  product_id: 'p-1',
                  product_name: 'Caneca',
                  quantity: 2,
                  unit_price: 100,
                  discount_amount: 0,
                  personalization_cost: 10,
                  subtotal: null,
                  created_at: '2026-05-25T10:00:00Z',
                },
              ],
              error: null,
            }),
        }),
      }),
    });

    const result = await orderService.fetchOrderForCurrentSeller('o-1');

    expect(result?.status).toBe('confirmed');
    expect(result?.items).toHaveLength(1);
    expect(result?.computedItemsSubtotal).toBe(220);
    expect(result?.expectedCheckoutTotal).toBe(215);
    expect(result?.checkoutConsistent).toBe(true);
  });

  it('cobre acesso não autorizado: pedido de terceiro não é retornado', async () => {
    const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>;

    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    });

    const result = await orderService.fetchOrderForCurrentSeller('order-de-terceiro');

    expect(result).toBeNull();
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith('orders');
  });
});
