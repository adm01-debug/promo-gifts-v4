/**
 * Fuzz exaustivo de getQuoteRowBadge — matriz completa
 * status (10) × synced (3: true/false/null) × dar (5: null/pending/approved/rejected/expired)
 * = 150 combinações. Valida invariantes:
 *  1. Sempre retorna um badge válido (key ∈ QUOTE_ROW_BADGE_STYLES).
 *  2. Label/className/description não-vazios.
 *  3. Prioridade DAR > synced (quando aplicável).
 *  4. Detecta gap conhecido: pending + dar=expired NÃO deve cair em synced/unsynced.
 */
import { describe, it, expect } from 'vitest';
import {
  getQuoteRowBadge,
  QUOTE_ROW_BADGE_STYLES,
  isDiscountExpired,
} from '../QuotesStatusChips';
import { QUOTE_STATUSES } from '@/types/quote';
import type { Quote } from '@/hooks/quotes';

const SYNCED = [true, false, null] as const;
const DAR = [null, 'pending', 'approved', 'rejected', 'expired'] as const;

const make = (s: string, sync: unknown, dar: unknown): Quote =>
  ({
    status: s,
    synced_to_bitrix: sync,
    discount_approval_status: dar,
    subtotal: 0,
    discount_percent: 0,
    discount_amount: 0,
    total: 0,
  }) as Quote;

describe('getQuoteRowBadge — fuzz matriz completa (150 combinações)', () => {
  const validKeys = new Set(Object.keys(QUOTE_ROW_BADGE_STYLES));

  it('toda combinação retorna badge válido e não-vazio', () => {
    let total = 0;
    for (const s of QUOTE_STATUSES) {
      for (const sync of SYNCED) {
        for (const dar of DAR) {
          total += 1;
          const b = getQuoteRowBadge(make(s, sync, dar));
          const ctx = `status=${s} sync=${sync} dar=${dar}`;
          expect(validKeys.has(b.key), `key inválida em ${ctx}`).toBe(true);
          expect(b.label.length, `label vazia em ${ctx}`).toBeGreaterThan(0);
          expect(b.className.length, `className vazio em ${ctx}`).toBeGreaterThan(0);
          expect(b.description.length, `description vazia em ${ctx}`).toBeGreaterThan(0);
        }
      }
    }
    expect(total).toBe(150);
  });

  it('DAR pending/approved/rejected SEMPRE vence synced (em status pending)', () => {
    for (const sync of SYNCED) {
      expect(getQuoteRowBadge(make('pending', sync, 'pending')).key).toBe('awaiting');
      expect(getQuoteRowBadge(make('pending', sync, 'approved')).key).toBe('approved');
      expect(getQuoteRowBadge(make('pending', sync, 'rejected')).key).toBe('rejected');
    }
  });

  it('status pending_approval ignora DAR e sempre = awaiting', () => {
    for (const sync of SYNCED) {
      for (const dar of DAR) {
        expect(getQuoteRowBadge(make('pending_approval', sync, dar)).key).toBe('awaiting');
      }
    }
  });

  it('status terminais (approved/converted/rejected/cancelled/expired) ignoram synced & DAR', () => {
    const terminal: Record<string, string> = {
      approved: 'quote_approved',
      converted: 'converted',
      rejected: 'quote_rejected',
      cancelled: 'cancelled',
      expired: 'expired',
    };
    for (const [s, expectedKey] of Object.entries(terminal)) {
      for (const sync of SYNCED) {
        for (const dar of DAR) {
          expect(getQuoteRowBadge(make(s, sync, dar)).key).toBe(expectedKey);
        }
      }
    }
  });

  it('draft ignora synced & DAR (sempre = draft)', () => {
    for (const sync of SYNCED) {
      for (const dar of DAR) {
        expect(getQuoteRowBadge(make('draft', sync, dar)).key).toBe('draft');
      }
    }
  });

  it('pending sem DAR: synced=true → synced, demais → unsynced', () => {
    expect(getQuoteRowBadge(make('pending', true, null)).key).toBe('synced');
    expect(getQuoteRowBadge(make('pending', false, null)).key).toBe('unsynced');
    expect(getQuoteRowBadge(make('pending', null, null)).key).toBe('unsynced');
  });

  // ─── GAP CONHECIDO ───
  // isDiscountExpired existe mas getQuoteRowBadge não o trata.
  // Este teste documenta o bug — passa hoje exibindo synced/unsynced,
  // mas o ideal seria badge específico "Desconto Expirado".
  it('FIX: pending + DAR=expired → expired_discount (badge dedicado, vence synced)', () => {
    for (const sync of SYNCED) {
      const q = make('pending', sync, 'expired');
      expect(isDiscountExpired(q)).toBe(true);
      expect(getQuoteRowBadge(q).key).toBe('expired_discount');
    }
  });
});
