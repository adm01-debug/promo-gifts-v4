/**
 * Matriz 10×10 — valida QUOTE_VALID_TRANSITIONS de forma exaustiva.
 * Para cada par (from, to) confere:
 *  - isValidQuoteTransition(from, to) === transitions[from].includes(to)
 *  - terminais (converted, cancelled) NUNCA tem saída
 *  - draft→converted explicitamente bloqueado (regressão histórica)
 */
import { describe, it, expect } from 'vitest';
import { QUOTE_STATUSES, type QuoteStatus } from '@/types/quote';
import {
  QUOTE_VALID_TRANSITIONS,
  isValidQuoteTransition,
} from '@/lib/quote-status-config';

describe('QUOTE_VALID_TRANSITIONS — matriz exaustiva 10×10', () => {
  it('cobre todos os 10 status como chave', () => {
    for (const s of QUOTE_STATUSES) {
      expect(QUOTE_VALID_TRANSITIONS[s]).toBeDefined();
    }
  });

  it('isValidQuoteTransition concorda com a tabela em 100 pares', () => {
    let permitted = 0;
    let blocked = 0;
    for (const from of QUOTE_STATUSES) {
      for (const to of QUOTE_STATUSES) {
        const expected = (QUOTE_VALID_TRANSITIONS[from] as readonly string[]).includes(to);
        const actual = isValidQuoteTransition(from as QuoteStatus, to as QuoteStatus);
        expect(actual, `${from}->${to}`).toBe(expected);
        if (expected) permitted++;
        else blocked++;
      }
    }
    expect(permitted + blocked).toBe(100);
    // Sanidade: a maioria deve ser bloqueada (matriz esparsa).
    expect(blocked).toBeGreaterThan(permitted);
  });

  it('estados terminais não tem saída', () => {
    expect(QUOTE_VALID_TRANSITIONS.converted).toHaveLength(0);
    expect(QUOTE_VALID_TRANSITIONS.cancelled).toHaveLength(0);
  });

  it('regressão: draft→converted continua bloqueado', () => {
    expect(isValidQuoteTransition('draft', 'converted')).toBe(false);
  });

  it('regressão: approved só transita para converted', () => {
    expect(QUOTE_VALID_TRANSITIONS.approved).toEqual(['converted']);
  });

  it('nenhum status transita para si mesmo', () => {
    for (const s of QUOTE_STATUSES) {
      expect(isValidQuoteTransition(s as QuoteStatus, s as QuoteStatus)).toBe(false);
    }
  });

  it('guard defensivo: from desconhecido retorna false sem throw', () => {
    expect(
      isValidQuoteTransition('not_a_status' as unknown as QuoteStatus, 'pending'),
    ).toBe(false);
  });
});
