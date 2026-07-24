import { describe, it, expect, vi, beforeEach } from 'vitest';

const { warnMock } = vi.hoisted(() => ({ warnMock: vi.fn() }));

vi.mock('@/lib/telemetry/structuredLogger', () => ({
  createClientLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: warnMock,
    error: vi.fn(),
    child: vi.fn(),
    headers: () => ({}),
    scope: 'test',
    requestId: 'test',
  }),
}));

import { quoteService } from '@/services/quoteService';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/hooks/common/useTransactionalEmail', () => ({
  sendTransactionalEmail: vi.fn(() => Promise.resolve()),
}));

function mockSelectSingle(data: unknown, error: unknown = null) {
  return {
    select: () => ({
      eq: () => ({ single: () => Promise.resolve({ data, error }) }),
    }),
  };
}

function mockUpdate(error: unknown = null) {
  return {
    update: () => ({ eq: () => Promise.resolve({ error }) }),
  };
}

describe('quoteService.updateQuoteStatus — telemetria de transições inválidas', () => {
  beforeEach(() => {
    warnMock.mockClear();
    vi.clearAllMocks();
  });

  it('emite quote_status_transition_blocked (not_allowed_by_config) ao tentar draft→converted', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any).mockReturnValueOnce(
      mockSelectSingle({
        status: 'draft',
        client_email: null,
        client_name: null,
        quote_number: '001/26',
        total: 0,
        valid_until: null,
      }),
    );

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quoteService.updateQuoteStatus('q-1', 'converted' as any),
    ).rejects.toThrow(/Transição de status inválida/);

    expect(warnMock).toHaveBeenCalledWith(
      'quote_status_transition_blocked',
      expect.objectContaining({
        quote_id: 'q-1',
        from_status: 'draft',
        to_status: 'converted',
        reason: 'not_allowed_by_config',
        source: 'service',
      }),
    );
  });

  it('emite quote_status_transition_blocked (db_check_violation) quando o banco rejeita com 23514', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fromMock = supabase.from as any;
    fromMock.mockReturnValueOnce(
      mockSelectSingle({
        status: 'draft',
        client_email: null,
        client_name: null,
        quote_number: '001/26',
        total: 0,
        valid_until: null,
      }),
    );
    // Transição draft→pending é válida no FE, mas simulamos rejeição do CHECK.
    fromMock.mockReturnValueOnce(
      mockUpdate({
        code: '23514',
        message: 'new row for relation "quotes" violates check constraint "valid_quote_status"',
        hint: null,
      }),
    );

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quoteService.updateQuoteStatus('q-2', 'pending' as any),
    ).rejects.toThrow(/rejeitado pela constraint valid_quote_status/);

    expect(warnMock).toHaveBeenCalledWith(
      'quote_status_transition_blocked',
      expect.objectContaining({
        quote_id: 'q-2',
        from_status: 'draft',
        to_status: 'pending',
        reason: 'db_check_violation',
        source: 'db',
        db_error: expect.objectContaining({ code: '23514', constraint: 'valid_quote_status' }),
      }),
    );
  });

  it('NÃO emite telemetria quando a transição é válida e o banco aceita', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fromMock = supabase.from as any;
    fromMock.mockReturnValueOnce(
      mockSelectSingle({
        status: 'draft',
        client_email: null,
        client_name: null,
        quote_number: '001/26',
        total: 0,
        valid_until: null,
      }),
    );
    fromMock.mockReturnValueOnce(mockUpdate(null));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await quoteService.updateQuoteStatus('q-3', 'pending' as any);

    expect(warnMock).not.toHaveBeenCalledWith(
      'quote_status_transition_blocked',
      expect.anything(),
    );
  });
});
