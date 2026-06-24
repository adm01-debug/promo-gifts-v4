/**
 * Testes do SSOT de formatação de personalização.
 *
 * Cobre:
 *  - Lado A / Lado B / Circular / Frente (prefixos)
 *  - Área W×Hcm com e sem dimensões
 *  - colors_count ausente, zero, negativo, NaN, válido (singular/plural)
 *  - Retrocompat: orçamento antigo sem location_name (sem prefixo)
 *  - Retrocompat: dimensões extraídas de `notes` quando width/height ausentes
 *  - Identidade builder ↔ PDF (mesmas funções → mesmo texto)
 */
import { describe, it, expect } from 'vitest';
import {
  formatPersonalizationSummary,
  formatPersonalizationsList,
  formatColors,
  formatArea,
  normalizeColorsCount,
  formatTechniqueWithLocation,
  extractDimensionsFromNotes,
  DEFAULT_COLORS_COUNT,
  TECHNIQUE_FALLBACK,
} from '../personalizationSummary';

describe('normalizeColorsCount', () => {
  it.each([
    [undefined, DEFAULT_COLORS_COUNT],
    [null, DEFAULT_COLORS_COUNT],
    [0, DEFAULT_COLORS_COUNT],
    [-1, DEFAULT_COLORS_COUNT],
    [Number.NaN, DEFAULT_COLORS_COUNT],
    ['abc', DEFAULT_COLORS_COUNT],
    [1, 1],
    [4, 4],
    [3.7, 3],
    ['2', 2],
  ])('normaliza %p → %p', (input, expected) => {
    expect(normalizeColorsCount(input)).toBe(expected);
  });
});

describe('formatColors', () => {
  it('singular vs plural', () => {
    expect(formatColors(1)).toBe('1 cor');
    expect(formatColors(2)).toBe('2 cores');
    expect(formatColors(undefined)).toBe('1 cor');
    expect(formatColors(0)).toBe('1 cor');
  });
});

describe('formatArea', () => {
  it('retorna null para dimensões inválidas', () => {
    expect(formatArea(0, 10)).toBeNull();
    expect(formatArea(10, 0)).toBeNull();
    expect(formatArea(null, null)).toBeNull();
    expect(formatArea(undefined, 5)).toBeNull();
  });
  it('formata W×Hcm', () => {
    expect(formatArea(12, 8)).toBe('12×8cm');
    expect(formatArea(5.5, 3.2)).toBe('5.5×3.2cm');
  });
});

describe('formatTechniqueWithLocation', () => {
  it.each(['Lado A', 'Lado B', 'Circular', 'Frente', 'Verso', 'Tampa'])(
    'inclui prefixo [%s]',
    (loc) => {
      expect(formatTechniqueWithLocation({ technique_name: 'Silk', location_name: loc })).toBe(
        `[${loc}] Silk`,
      );
    },
  );
  it('omite prefixo quando location ausente (retrocompat)', () => {
    expect(formatTechniqueWithLocation({ technique_name: 'Silk' })).toBe('Silk');
    expect(formatTechniqueWithLocation({ technique_name: 'Silk', location_name: '' })).toBe('Silk');
    expect(formatTechniqueWithLocation({ technique_name: 'Silk', location_name: '   ' })).toBe(
      'Silk',
    );
  });
  it('usa fallback quando technique ausente', () => {
    expect(formatTechniqueWithLocation({ location_name: 'Lado A' })).toBe(
      `[Lado A] ${TECHNIQUE_FALLBACK}`,
    );
  });
});

describe('extractDimensionsFromNotes', () => {
  it('extrai do padrão antigo "| 12×8cm"', () => {
    expect(extractDimensionsFromNotes('Logo cliente | 12×8cm')).toEqual({ width: 12, height: 8 });
    expect(extractDimensionsFromNotes('foo | 5.5×3.2cm bar')).toEqual({ width: 5.5, height: 3.2 });
  });
  it('retorna null sem match', () => {
    expect(extractDimensionsFromNotes(undefined)).toBeNull();
    expect(extractDimensionsFromNotes('')).toBeNull();
    expect(extractDimensionsFromNotes('sem dimensões')).toBeNull();
  });
});

describe('formatPersonalizationSummary — cenários de proposta ao cliente', () => {
  it('caso completo: Lado A + área + 4 cores', () => {
    expect(
      formatPersonalizationSummary({
        technique_name: 'Silk Screen',
        location_name: 'Lado A',
        width_cm: 12,
        height_cm: 8,
        colors_count: 4,
      }),
    ).toBe('[Lado A] Silk Screen 12×8cm | 4 cores');
  });

  it('Lado B com 1 cor', () => {
    expect(
      formatPersonalizationSummary({
        technique_name: 'Gravação Laser',
        location_name: 'Lado B',
        width_cm: 6,
        height_cm: 4,
        colors_count: 1,
      }),
    ).toBe('[Lado B] Gravação Laser 6×4cm | 1 cor');
  });

  it('Circular sem dimensões', () => {
    expect(
      formatPersonalizationSummary({
        technique_name: 'Tampografia',
        location_name: 'Circular',
        colors_count: 2,
      }),
    ).toBe('[Circular] Tampografia | 2 cores');
  });

  it('colors_count ausente ⇒ "1 cor" (consistência)', () => {
    expect(
      formatPersonalizationSummary({
        technique_name: 'Silk',
        location_name: 'Frente',
        width_cm: 10,
        height_cm: 5,
      }),
    ).toBe('[Frente] Silk 10×5cm | 1 cor');
  });

  it('colors_count = 0 ⇒ "1 cor" (consistência)', () => {
    expect(
      formatPersonalizationSummary({
        technique_name: 'Silk',
        location_name: 'Frente',
        colors_count: 0,
      }),
    ).toBe('[Frente] Silk | 1 cor');
  });

  it('retrocompat: orçamento antigo sem location_name', () => {
    expect(
      formatPersonalizationSummary({
        technique_name: 'Silk',
        width_cm: 8,
        height_cm: 6,
        colors_count: 2,
      }),
    ).toBe('Silk 8×6cm | 2 cores');
  });

  it('retrocompat: dimensões em notes quando width/height ausentes', () => {
    expect(
      formatPersonalizationSummary({
        technique_name: 'Silk',
        location_name: 'Lado A',
        notes: 'Logo cliente | 15×10cm',
        colors_count: 3,
      }),
    ).toBe('[Lado A] Silk 15×10cm | 3 cores');
  });

  it('inclui material quando presente', () => {
    expect(
      formatPersonalizationSummary({
        technique_name: 'Bordado',
        location_name: 'Lado A',
        colors_count: 5,
        material: 'Linha Premium',
      }),
    ).toBe('[Lado A] Bordado | 5 cores | Linha Premium');
  });
});

describe('formatPersonalizationsList — múltiplas gravações', () => {
  it('junta com separador padrão " · "', () => {
    const result = formatPersonalizationsList([
      { technique_name: 'Silk', location_name: 'Lado A', colors_count: 4 },
      { technique_name: 'Laser', location_name: 'Lado B', width_cm: 5, height_cm: 5 },
    ]);
    expect(result).toBe('[Lado A] Silk | 4 cores · [Lado B] Laser 5×5cm | 1 cor');
  });
});

describe('Identidade builder ↔ PDF/HTML', () => {
  // Garante que o mesmo input produz exatamente o mesmo texto em qualquer
  // ponto de consumo (regressão para a duplicação anterior de lógica).
  const cases = [
    { technique_name: 'Silk', location_name: 'Lado A', width_cm: 10, height_cm: 5, colors_count: 2 },
    { technique_name: 'Laser', location_name: 'Circular', colors_count: 1 },
    { technique_name: 'Bordado', colors_count: 0 },
    { technique_name: 'Silk', location_name: 'Lado B', notes: 'x | 7×3cm' },
  ];

  it('produz o mesmo output em chamadas independentes', () => {
    for (const c of cases) {
      const a = formatPersonalizationSummary(c);
      const b = formatPersonalizationSummary({ ...c });
      expect(a).toBe(b);
      // E o output sempre contém o sufixo de cores (consistência cliente)
      expect(a).toMatch(/\| \d+ (cor|cores)/);
    }
  });
});
