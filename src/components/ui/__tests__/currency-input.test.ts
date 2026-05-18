import { describe, it, expect } from 'vitest';
import { parseStrict, formatBR, round2 } from '../currency-input';

describe('CurrencyInput · round2', () => {
  it.each([
    [100.589, 100.59],
    [100.584, 100.58],
    [100.585, 100.59], // hot zone — Number.EPSILON corrige
    [0.1 + 0.2, 0.3], // 0.30000000000000004
    [1.005, 1.01],
    [-1.005, -1], // Math.round em negativo arredonda p/ cima
    [0, 0],
  ])('round2(%s) === %s', (input, expected) => {
    expect(round2(input)).toBe(expected);
  });
});

describe('CurrencyInput · formatBR (pt-BR, 2 casas)', () => {
  it('formata com vírgula decimal e ponto de milhar', () => {
    expect(formatBR(1234.5)).toBe('1.234,50');
    expect(formatBR(1234567.89)).toBe('1.234.567,89');
  });

  it('arredonda 100,589 → "100,59"', () => {
    expect(formatBR(100.589)).toBe('100,59');
  });

  it('arredonda 100,584 → "100,58"', () => {
    expect(formatBR(100.584)).toBe('100,58');
  });

  it('zero formata como "0,00"', () => {
    expect(formatBR(0)).toBe('0,00');
  });

  it('força exatamente 2 casas', () => {
    expect(formatBR(5)).toBe('5,00');
    expect(formatBR(5.1)).toBe('5,10');
  });
});

describe('CurrencyInput · parseStrict (allowNegative=false)', () => {
  const parse = (s: string) => parseStrict(s, false);

  it('aceita vírgula como decimal', () => {
    expect(parse('100,58')).toEqual({ n: 100.58, ok: true });
  });

  it('aceita ponto como decimal quando não há milhar', () => {
    expect(parse('100.58')).toEqual({ n: 100.58, ok: true });
  });

  it('arredonda na entrada: "100,589" → 100.59', () => {
    expect(parse('100,589')).toEqual({ n: 100.59, ok: true });
  });

  it('arredonda na entrada: "100,584" → 100.58', () => {
    expect(parse('100,584')).toEqual({ n: 100.58, ok: true });
  });

  it('arredonda 3+ casas: "1,005" → 1.01', () => {
    expect(parse('1,005')).toEqual({ n: 1.01, ok: true });
  });

  it('remove ponto de milhar: "1.234,56" → 1234.56', () => {
    expect(parse('1.234,56')).toEqual({ n: 1234.56, ok: true });
  });

  it('remove múltiplos pontos de milhar: "1.234.567,89"', () => {
    expect(parse('1.234.567,89')).toEqual({ n: 1234567.89, ok: true });
  });

  it('string vazia → 0 (ok)', () => {
    expect(parse('')).toEqual({ n: 0, ok: true });
    expect(parse('   ')).toEqual({ n: 0, ok: true });
  });

  it('faz trim de espaços', () => {
    expect(parse('  100,58  ')).toEqual({ n: 100.58, ok: true });
  });

  it('rejeita letras', () => {
    const r = parse('100abc');
    expect(r.ok).toBe(false);
    expect(Number.isNaN(r.n)).toBe(true);
  });

  it('rejeita símbolos exóticos', () => {
    expect(parse('R$ 100').ok).toBe(false);
    expect(parse('100$').ok).toBe(false);
    expect(parse('100€').ok).toBe(false);
  });

  it('rejeita sinal negativo quando allowNegative=false', () => {
    expect(parse('-100').ok).toBe(false);
  });

  it('aceita inteiro sem decimais', () => {
    expect(parse('100')).toEqual({ n: 100, ok: true });
  });
});

describe('CurrencyInput · parseStrict (allowNegative=true)', () => {
  const parse = (s: string) => parseStrict(s, true);

  it('aceita negativo com vírgula', () => {
    expect(parse('-100,58')).toEqual({ n: -100.58, ok: true });
  });

  it('arredonda negativo', () => {
    // round2(-100.589) → Math.round((-100.589+EPS)*100)/100 = -10059/100 = -100.59
    expect(parse('-100,589')).toEqual({ n: -100.59, ok: true });
  });

  it('ainda rejeita letras', () => {
    expect(parse('-abc').ok).toBe(false);
  });
});

describe('CurrencyInput · round-trip parse + format', () => {
  it.each([
    ['100,589', '100,59'],
    ['100,584', '100,58'],
    ['1.234,567', '1.234,57'],
    ['1234.5', '1.234,50'],
    ['0,1', '0,10'],
    ['10', '10,00'],
  ])('parseStrict("%s") → formatBR === "%s"', (input, expected) => {
    const { n, ok } = parseStrict(input, false);
    expect(ok).toBe(true);
    expect(formatBR(n)).toBe(expected);
  });
});
