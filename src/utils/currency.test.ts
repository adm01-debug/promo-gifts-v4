import { describe, it, expect } from 'vitest';
import { formatBRL, formatBRLShort, formatBRLCompact, parseBRL } from './currency';

/**
 * NBSP-aware matching: Intl.NumberFormat('pt-BR') separa "R$" do número com um
 * espaço não-quebrável (U+00A0 ou, em ICUs novos, o narrow NBSP U+202F), não um
 * espaço comum. Normalizamos para comparar de forma robusta entre ambientes ICU.
 */
const norm = (s: string) => s.replace(/[\u00A0\u202F]/g, ' ');

describe('currency — formatBRL', () => {
  it('formata valores positivos com 2 casas decimais', () => {
    expect(norm(formatBRL(1234.5))).toBe('R$ 1.234,50');
    expect(norm(formatBRL(0))).toBe('R$ 0,00');
    expect(norm(formatBRL(1))).toBe('R$ 1,00');
  });

  it('formata valores negativos', () => {
    expect(norm(formatBRL(-50.25))).toBe('-R$ 50,25');
  });

  // --- Guard de type-safety: null / undefined / NaN ---
  it('retorna "R$ 0,00" para null', () => {
    expect(norm(formatBRL(null))).toBe('R$ 0,00');
  });

  it('retorna "R$ 0,00" para undefined', () => {
    expect(norm(formatBRL(undefined))).toBe('R$ 0,00');
  });

  it('retorna "R$ 0,00" para NaN', () => {
    expect(norm(formatBRL(NaN))).toBe('R$ 0,00');
  });
});

describe('currency — formatBRLShort', () => {
  it('arredonda para inteiro (half-up) e remove centavos', () => {
    expect(norm(formatBRLShort(1234.5))).toBe('R$ 1.235');
    expect(norm(formatBRLShort(1234.4))).toBe('R$ 1.234');
    expect(norm(formatBRLShort(0))).toBe('R$ 0');
  });

  it('retorna "R$ 0" para null/undefined/NaN', () => {
    expect(norm(formatBRLShort(null))).toBe('R$ 0');
    expect(norm(formatBRLShort(undefined))).toBe('R$ 0');
    expect(norm(formatBRLShort(NaN))).toBe('R$ 0');
  });
});

describe('currency — formatBRLCompact', () => {
  it('usa notação compacta para valores grandes', () => {
    // O sufixo exato ("mil"/"mi") depende do ICU; validamos o prefixo e que não é o fallback.
    const result = norm(formatBRLCompact(1_234_567));
    expect(result).toMatch(/^R\$/);
    expect(result).not.toBe('R$ 0');
  });

  it('retorna "R$ 0" para null/undefined/NaN', () => {
    expect(norm(formatBRLCompact(null))).toBe('R$ 0');
    expect(norm(formatBRLCompact(undefined))).toBe('R$ 0');
    expect(norm(formatBRLCompact(NaN))).toBe('R$ 0');
  });
});

describe('currency — parseBRL', () => {
  it('faz round-trip de formatBRL', () => {
    expect(parseBRL('R$ 1.234,50')).toBe(1234.5);
    expect(parseBRL('R$ 0,00')).toBe(0);
    expect(parseBRL('R$ 1,00')).toBe(1);
  });

  it('tolera strings sem símbolo e com espaços', () => {
    expect(parseBRL('1.234,50')).toBe(1234.5);
    expect(parseBRL(' R$ 99,90 ')).toBe(99.9);
  });

  it('retorna 0 para strings não-numéricas', () => {
    expect(parseBRL('abc')).toBe(0);
    expect(parseBRL('')).toBe(0);
    expect(parseBRL('R$')).toBe(0);
  });
});
