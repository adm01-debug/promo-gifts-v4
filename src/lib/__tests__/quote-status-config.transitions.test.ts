import { describe, it, expect } from 'vitest';
import { QUOTE_VALID_TRANSITIONS, isValidQuoteTransition } from '@/lib/quote-status-config';
import type { QuoteStatus } from '@/types/quote';

/**
 * FE ⇄ DB transition-consistency guard.
 *
 * The DB is the ultimate authority: public.fn_quotes_enforce_immutability locks
 * financially-committed states. This oracle was EMPIRICALLY VALIDATED (2026-06-24)
 * via a rolled-back synthetic-row simulation as a non-service-role user:
 *   approved->sent      = REJECTED (23514)
 *   approved->cancelled = REJECTED (23514)
 *   approved->converted = ACCEPTED
 *   approved->expired   = ACCEPTED   (automation-driven; FE need not expose it)
 *   draft->approved     = ACCEPTED   (DB imposes NO restriction on non-committed origins)
 *
 * Invariant enforced here: the frontend must never OFFER a transition the DB would
 * reject for a human (non-service-role) user — otherwise the UI shows an action that
 * fails with a DB error (e.g. the Bitrix sync trying to downgrade approved->sent).
 */
const ALL: QuoteStatus[] = [
  'draft', 'pending_approval', 'pending', 'sent', 'viewed',
  'approved', 'converted', 'rejected', 'expired', 'cancelled',
];
const COMMITTED = new Set<QuoteStatus>(['approved', 'converted']);

function dbHumanAllows(from: QuoteStatus, to: QuoteStatus): boolean {
  if (from === to) return true;            // no-op update
  if (!COMMITTED.has(from)) return true;   // DB enforces no transition graph here
  if (from === 'approved') return to === 'converted' || to === 'expired';
  if (from === 'converted') return to === 'expired';
  return false;
}

describe('quote transitions — FE ⊆ DB (no broken UI actions)', () => {
  it('FE never offers a transition the DB rejects for human users', () => {
    const violations: string[] = [];
    for (const from of ALL) for (const to of ALL) {
      if (from === to) continue;
      if (isValidQuoteTransition(from, to) && !dbHumanAllows(from, to)) violations.push(`${from}->${to}`);
    }
    expect(violations).toEqual([]);
  });

  it('committed states locked to DB-permitted transitions', () => {
    expect([...QUOTE_VALID_TRANSITIONS.approved]).toEqual(['converted']);
    expect([...QUOTE_VALID_TRANSITIONS.converted]).toEqual([]);
    expect(isValidQuoteTransition('approved', 'sent')).toBe(false);
    expect(isValidQuoteTransition('approved', 'cancelled')).toBe(false);
    expect(isValidQuoteTransition('approved', 'converted')).toBe(true);
  });

  it('non-committed origins keep workflow transitions (cancel still available)', () => {
    for (const from of ALL) {
      if (COMMITTED.has(from) || from === 'cancelled') continue;
      expect(isValidQuoteTransition(from, 'cancelled'), `${from}->cancelled`).toBe(true);
    }
  });

  it('structural: terminals empty; no self-loops; targets are real statuses', () => {
    expect([...QUOTE_VALID_TRANSITIONS.cancelled]).toEqual([]);
    expect([...QUOTE_VALID_TRANSITIONS.converted]).toEqual([]);
    for (const s of ALL) {
      const outs = QUOTE_VALID_TRANSITIONS[s] as readonly QuoteStatus[];
      expect(outs.includes(s), `${s} self-loop`).toBe(false);
      for (const t of outs) expect(ALL.includes(t), `${s}->${t} unknown target`).toBe(true);
    }
  });

  it('BUG-016: garbage/unknown from-status → false (no throw)', () => {
    for (const g of ['NOPE', undefined, null, '', 'APPROVED']) {
      expect(isValidQuoteTransition(g as unknown as QuoteStatus, 'draft')).toBe(false);
    }
  });
});
