/**
 * Unit — Rollover de ano (YY) do normalizador de quote_number.
 *
 * Garante que `computeNextQuoteNumberPreview` e `formatQuoteNumberLabel`
 * preservam o formato canônico `NNNNN/YY` em viradas de ano (incluindo
 * século — `2099 → 2100` continua produzindo 2 dígitos), e que a prévia
 * sempre considera SOMENTE orçamentos do ano corrente.
 */
import { describe, it, expect } from 'vitest';
import {
  formatQuoteNumberLabel,
  computeNextQuoteNumberPreview,
  QUOTE_NUMBER_REGEX,
} from '@/utils/quote-number';

describe('quote-number · rollover de ano (YY)', () => {
  it.each([
    [2025, '25'],
    [2026, '26'],
    [2027, '27'],
    [2029, '29'],
    [2030, '30'],
    [2099, '99'],
    [2100, '00'], // virada de século → continua 2 dígitos
    [2101, '01'],
    [2009, '09'], // anos com leading zero
    [2000, '00'],
  ])('ano %i → sufixo YY=%s', (year, yy) => {
    const preview = computeNextQuoteNumberPreview([`10010/${yy}`], year);
    expect(preview).toBe(`~10011/${yy}`);
    // formato canônico mantido (sem o "~" da prévia)
    expect(formatQuoteNumberLabel(`10011/${yy}`)).toBe(`10011/${yy}`);
    expect(QUOTE_NUMBER_REGEX.test(`10011/${yy}`)).toBe(true);
  });

  it('virada de ano: lista do ano antigo NÃO contamina prévia do novo ano', () => {
    // No primeiro orçamento de 2027, prévia deve ser null (não 10011/27).
    expect(
      computeNextQuoteNumberPreview(['10010/26', '10009/26', '99999/26'], 2027),
    ).toBeNull();
  });

  it('mistura de anos: usa somente o YY do ano corrente para max', () => {
    // 2026: maior é 50/26 mesmo havendo 99999/25.
    expect(
      computeNextQuoteNumberPreview(
        ['99999/25', '49/26', '50/26', '10/26'],
        2026,
      ),
    ).toBe('~51/26');
  });

  it('virada exata: dezembro do ano X gera prévia X; janeiro do ano X+1 zera', () => {
    const dezembro2026 = computeNextQuoteNumberPreview(['10010/26'], 2026);
    const janeiro2027 = computeNextQuoteNumberPreview(['10010/26'], 2027);
    expect(dezembro2026).toBe('~10011/26');
    expect(janeiro2027).toBeNull();
  });

  it('rollover de século (2099→2100) preserva 2 dígitos no YY', () => {
    expect(computeNextQuoteNumberPreview(['100/99'], 2099)).toBe('~101/99');
    expect(computeNextQuoteNumberPreview(['100/00'], 2100)).toBe('~101/00');
    // Sanity: formato continua válido na regex SSOT.
    expect(QUOTE_NUMBER_REGEX.test('101/00')).toBe(true);
  });

  it('idempotência cruzando anos: normalizar(N/YY) é estável', () => {
    for (const yy of ['00', '09', '25', '26', '99']) {
      const label = `12345/${yy}`;
      expect(formatQuoteNumberLabel(label)).toBe(label);
      expect(formatQuoteNumberLabel(formatQuoteNumberLabel(label)!)).toBe(label);
    }
  });
});
