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

// QA: builder fluente que cobre os métodos PostgREST usados por quoteService.
// O 1º teste sobrescreve `supabase.from` com um shape diferente, quebrando
// os testes seguintes que esperam o chain completo. beforeEach restaura o
// builder padrão para isolar cada caso.
const makeBuilder = () => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
});

describe('quoteService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (
      supabase.from as unknown as { mockImplementation: (fn: () => unknown) => void }
    ).mockImplementation(() => makeBuilder());
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

    // QA: o serviço fetchQuote foi simplificado — usa `.eq('id', quoteId).single()`
    // (sem segundo .eq e usando single em vez de maybeSingle). RLS valida
    // ownership no banco; o front não precisa filtrar por user_id no select.
    // First call: quotes
    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: mockQuote, error: null }),
        }),
      }),
    });
    // Second call: items
    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: mockItems, error: null }),
        }),
      }),
    });
    // Third call: personalizations
    fromMock.mockReturnValueOnce({
      select: () => ({
        in: () => Promise.resolve({ data: mockPers, error: null }),
      }),
    });

    // QA: assinatura nova de fetchQuote aceita apenas quoteId.
    const quote = await quoteService.fetchQuote('q-1');

    expect(quote?.id).toBe('q-1');
    expect(quote?.items).toHaveLength(1);
    expect(quote?.items[0].personalizations).toHaveLength(1);
  });
});
