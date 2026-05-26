import { describe, it, expect, vi, beforeEach } from 'vitest';
import { quoteService } from '@/services/quoteService';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
    })),
  },
}));

describe('quoteService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch quotes with seller scope', async () => {
    const mockQuery = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: (cb: any) => cb({ data: [], error: null }),
    };
    (supabase.from as any).mockReturnValue({ select: () => mockQuery });

    await quoteService.fetchQuotes('user-123', 'self');
    expect(mockQuery.eq).toHaveBeenCalledWith('seller_id', 'user-123');
  });

  it('should fetch a complete quote with items and personalizations', async () => {
    const mockQuote = { id: 'q-1', title: 'Test' };
    const mockItems = [{ id: 'i-1', product_name: 'Item 1' }];
    const mockPers = [{ id: 'p-1', quote_item_id: 'i-1', technique: 'Laser' }];

    const fromMock = supabase.from as any;

    // First call: quotes — produção usa .select('*').eq('id').single()
    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: mockQuote, error: null }) }),
      }),
    });
    // Second call: items
    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({ order: () => Promise.resolve({ data: mockItems, error: null }) }),
      }),
    });
    // Third call: personalizations
    fromMock.mockReturnValueOnce({
      select: () => ({ in: () => Promise.resolve({ data: mockPers, error: null }) }),
    });

    const quote = await quoteService.fetchQuote('q-1');

    expect(quote?.id).toBe('q-1');
    expect(quote?.items).toHaveLength(1);
    expect(quote?.items?.[0].personalizations).toHaveLength(1);
  });
});
