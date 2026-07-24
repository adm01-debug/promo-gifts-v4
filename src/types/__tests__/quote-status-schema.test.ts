import { describe, it, expect } from 'vitest';
import {
  QUOTE_STATUSES,
  quoteStatusSchema,
  isQuoteStatus,
  type QuoteStatus,
} from '@/types/quote';

describe('QUOTE_STATUSES — SSOT do enum de status', () => {
  it('contém exatamente 10 status canônicos', () => {
    expect(QUOTE_STATUSES).toHaveLength(10);
  });

  it('snapshot dos status canônicos (ordem alfabética)', () => {
    expect([...QUOTE_STATUSES]).toEqual([
      'approved',
      'cancelled',
      'converted',
      'draft',
      'expired',
      'pending',
      'pending_approval',
      'rejected',
      'sent',
      'viewed',
    ]);
  });
});

describe('quoteStatusSchema (Zod) — valores válidos', () => {
  it.each(QUOTE_STATUSES)('aceita "%s"', (s) => {
    const r = quoteStatusSchema.safeParse(s);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe(s);
  });
});

describe('quoteStatusSchema — valores inválidos', () => {
  const INVALID: ReadonlyArray<unknown> = [
    'foo',
    '',
    'PENDING',
    'draft ',
    ' pending',
    'APPROVED',
    null,
    undefined,
    123,
    true,
    {},
    [],
  ];

  it.each(INVALID.map((v) => [v]))('rejeita %p', (v) => {
    expect(quoteStatusSchema.safeParse(v).success).toBe(false);
    expect(isQuoteStatus(v as QuoteStatus)).toBe(false);
  });
});

describe('isQuoteStatus — type guard', () => {
  it('narrowing funciona em runtime', () => {
    const x: unknown = 'approved';
    if (isQuoteStatus(x)) {
      // tipo agora é QuoteStatus
      const s: QuoteStatus = x;
      expect(s).toBe('approved');
    } else {
      throw new Error('deveria ter passado');
    }
  });
});
