import { describe, it, expect } from 'vitest';
import { applyVoiceFilters } from '../applyVoiceFilters';
import type { FilterState } from '@/components/filters/FilterPanel';

const base: FilterState = {
  search: '',
  colorGroups: [],
  colorVariations: [],
  colorNuances: [],
  colors: [],
  categories: [],
  suppliers: [],
  publicoAlvo: [],
  datasComemorativas: [],
  endomarketing: [],
  ramosAtividade: [],
  segmentosAtividade: [],
  materialGroups: [],
  materialTypes: [],
  materiais: [],
  techniques: [],
  tags: [],
  priceRange: [0, 9999],
  minStock: 0,
  inStock: false,
  isKit: false,
  featured: false,
  isNew: false,
  hasPersonalization: false,
  onSale: false,
  hasCommercialPackaging: false,
  gender: [],
  sizes: [],
  sortBy: 'newest',
  minSupplierSales90d: 0,
  minPromoSales90d: 0,
};

describe('applyVoiceFilters — mapeamento de filtros de voz', () => {
  it('payload vazio não altera o estado', () => {
    expect(applyVoiceFilters(base, {})).toEqual(base);
  });

  it('color acumula sem duplicar', () => {
    const prev = { ...base, colors: ['azul'] };
    const next = applyVoiceFilters(prev, { color: 'azul' });
    expect(next.colors).toEqual(['azul']);
    const next2 = applyVoiceFilters(prev, { color: 'vermelho' });
    expect(next2.colors).toEqual(['azul', 'vermelho']);
  });

  it('category acumula sem duplicar', () => {
    const prev = { ...base, categories: ['canetas'] };
    expect(applyVoiceFilters(prev, { category: 'canetas' }).categories).toEqual(['canetas']);
    expect(applyVoiceFilters(prev, { category: 'mochilas' }).categories).toEqual([
      'canetas',
      'mochilas',
    ]);
  });

  it('material acumula sem duplicar', () => {
    const prev = { ...base, materiais: ['metal'] };
    expect(applyVoiceFilters(prev, { material: 'metal' }).materiais).toEqual(['metal']);
    expect(applyVoiceFilters(prev, { material: 'plastico' }).materiais).toEqual([
      'metal',
      'plastico',
    ]);
  });

  it('priceRange: apenas minPrice → preserva max', () => {
    const next = applyVoiceFilters(base, { minPrice: 50 });
    expect(next.priceRange).toEqual([50, 9999]);
  });

  it('priceRange: apenas maxPrice → preserva min', () => {
    const next = applyVoiceFilters(base, { maxPrice: 200 });
    expect(next.priceRange).toEqual([0, 200]);
  });

  it('priceRange: min E max no mesmo comando — ambos sobrevivem', () => {
    const next = applyVoiceFilters(base, { minPrice: 10, maxPrice: 50 });
    expect(next.priceRange).toEqual([10, 50]);
  });

  it('priceRange: comando com ambos não sobrescreve apenas um lado por vez', () => {
    // Verifica que o bug BUG-VOZ-PRICE não regride
    const prev = { ...base, priceRange: [5, 100] as [number, number] };
    const next = applyVoiceFilters(prev, { minPrice: 20, maxPrice: 80 });
    expect(next.priceRange).toEqual([20, 80]);
  });

  it('inStock: define como true quando voice diz inStock=true', () => {
    expect(applyVoiceFilters(base, { inStock: true }).inStock).toBe(true);
  });

  it('inStock: undefined não altera estado existente', () => {
    const prev = { ...base, inStock: true };
    expect(applyVoiceFilters(prev, {}).inStock).toBe(true);
  });

  it('isKit: define como true', () => {
    expect(applyVoiceFilters(base, { isKit: true }).isKit).toBe(true);
  });

  it('gender: acumula, deduplicado', () => {
    const prev = { ...base, gender: ['Unissex'] };
    expect(applyVoiceFilters(prev, { gender: 'Unissex' }).gender).toEqual(['Unissex']);
    expect(applyVoiceFilters(prev, { gender: 'Masculino' }).gender).toEqual([
      'Unissex',
      'Masculino',
    ]);
  });

  it('featured: define como true', () => {
    expect(applyVoiceFilters(base, { featured: true }).featured).toBe(true);
  });

  it('isNew: define como true', () => {
    expect(applyVoiceFilters(base, { isNew: true }).isNew).toBe(true);
  });

  it('hasPersonalization: define como true', () => {
    expect(applyVoiceFilters(base, { hasPersonalization: true }).hasPersonalization).toBe(true);
  });

  it('onSale: define como true', () => {
    expect(applyVoiceFilters(base, { onSale: true }).onSale).toBe(true);
  });

  it('minStock: aplica quando > 0', () => {
    expect(applyVoiceFilters(base, { minStock: 100 }).minStock).toBe(100);
  });

  it('minStock: ignora valor 0 (sem filtro)', () => {
    const prev = { ...base, minStock: 50 };
    expect(applyVoiceFilters(prev, { minStock: 0 }).minStock).toBe(50);
  });

  it('publicoAlvo: acumula sem duplicar', () => {
    const prev = { ...base, publicoAlvo: ['corporativo'] };
    expect(applyVoiceFilters(prev, { publicoAlvo: 'corporativo' }).publicoAlvo).toEqual([
      'corporativo',
    ]);
    expect(applyVoiceFilters(prev, { publicoAlvo: 'executivo' }).publicoAlvo).toEqual([
      'corporativo',
      'executivo',
    ]);
  });

  it('endomarketing: adiciona slug fixo "endomarketing"', () => {
    expect(applyVoiceFilters(base, { endomarketing: true }).endomarketing).toEqual([
      'endomarketing',
    ]);
  });

  it('endomarketing: não duplica se já estiver presente', () => {
    const prev = { ...base, endomarketing: ['endomarketing'] };
    expect(applyVoiceFilters(prev, { endomarketing: true }).endomarketing).toEqual([
      'endomarketing',
    ]);
  });

  it('comando multi-campo aplica todos simultaneamente', () => {
    const next = applyVoiceFilters(base, {
      color: 'azul',
      material: 'metal',
      gender: 'Feminino',
      isNew: true,
      onSale: true,
      minPrice: 10,
      maxPrice: 100,
    });
    expect(next.colors).toContain('azul');
    expect(next.materiais).toContain('metal');
    expect(next.gender).toContain('Feminino');
    expect(next.isNew).toBe(true);
    expect(next.onSale).toBe(true);
    expect(next.priceRange).toEqual([10, 100]);
  });

  it('não modifica o objeto prev (imutabilidade)', () => {
    const prev = { ...base };
    const frozen = Object.freeze({ ...prev });
    // Deve criar novo objeto sem lançar TypeError
    expect(() => applyVoiceFilters(frozen as FilterState, { featured: true })).not.toThrow();
    expect((frozen as FilterState).featured).toBe(false);
  });

  // FIX-11 — clamping de preços negativos (reconhecimento de voz pode gerar valores inválidos)
  it('FIX-11: minPrice negativo é clamped para 0', () => {
    const next = applyVoiceFilters(base, { minPrice: -50 });
    expect(next.priceRange[0]).toBe(0);
    expect(next.priceRange[1]).toBe(9999); // max preservado
  });

  it('FIX-11: maxPrice negativo é clamped para 0', () => {
    const next = applyVoiceFilters(base, { maxPrice: -10 });
    expect(next.priceRange[0]).toBe(0); // min preservado
    expect(next.priceRange[1]).toBe(0); // clamped
  });

  it('FIX-11: minPrice e maxPrice ambos negativos → ambos clamped para 0', () => {
    const next = applyVoiceFilters(base, { minPrice: -100, maxPrice: -5 });
    expect(next.priceRange).toEqual([0, 0]);
  });

  it('FIX-11: minPrice negativo + maxPrice válido → [0, maxPrice]', () => {
    const next = applyVoiceFilters(base, { minPrice: -20, maxPrice: 150 });
    expect(next.priceRange).toEqual([0, 150]);
  });

  it('FIX-11: preços positivos não são alterados pelo clamping', () => {
    const next = applyVoiceFilters(base, { minPrice: 10, maxPrice: 500 });
    expect(next.priceRange).toEqual([10, 500]);
  });

  it('FIX-11: minPrice = 0 é aceito (não é negativo)', () => {
    const prev = { ...base, priceRange: [50, 200] as [number, number] };
    const next = applyVoiceFilters(prev, { minPrice: 0 });
    expect(next.priceRange[0]).toBe(0);
    expect(next.priceRange[1]).toBe(200); // max preservado
  });

  // FIX-14 — Number.isFinite() guard: NaN/Infinity não corrompem priceRange
  it('FIX-14: minPrice=NaN é ignorado (priceRange inalterado)', () => {
    const prev = { ...base, priceRange: [10, 200] as [number, number] };
    const next = applyVoiceFilters(prev, { minPrice: NaN });
    expect(next.priceRange).toEqual([10, 200]);
  });

  it('FIX-14: maxPrice=Infinity é ignorado (priceRange inalterado)', () => {
    const prev = { ...base, priceRange: [10, 200] as [number, number] };
    const next = applyVoiceFilters(prev, { maxPrice: Infinity });
    expect(next.priceRange).toEqual([10, 200]);
  });

  it('FIX-14: minPrice=NaN + maxPrice válido → só maxPrice aplica', () => {
    const prev = { ...base, priceRange: [10, 200] as [number, number] };
    const next = applyVoiceFilters(prev, { minPrice: NaN, maxPrice: 150 });
    expect(next.priceRange[0]).toBe(10); // NaN ignorado → min preservado
    expect(next.priceRange[1]).toBe(150);
  });

  it('FIX-14: minPrice=-Infinity é ignorado (não é finito)', () => {
    const prev = { ...base, priceRange: [10, 200] as [number, number] };
    const next = applyVoiceFilters(prev, { minPrice: -Infinity });
    expect(next.priceRange).toEqual([10, 200]);
  });

  // FIX-18 — auto-swap quando resultado invertido (maxPrice < minPrice herdado)
  it('FIX-18: maxPrice menor que minPrice herdado → auto-swap (sem sentinela)', () => {
    // Prev: min=500, max=9999 (sentinela). Usuário fala "mostrar até 200".
    // rawMin=500 (herdado), rawMax=200 → invertido → deve trocar para [200, 500].
    const prev = { ...base, priceRange: [500, 9999] as [number, number] };
    const next = applyVoiceFilters(prev, { maxPrice: 200 });
    expect(next.priceRange[0]).toBe(200);
    expect(next.priceRange[1]).toBe(500);
  });

  it('FIX-18: minPrice maior que maxPrice herdado → auto-swap (sem sentinela)', () => {
    // Prev: min=0, max=100. Usuário fala "mínimo 500".
    // rawMin=500, rawMax=100 (herdado) → invertido → swap → [100, 500].
    const prev = { ...base, priceRange: [0, 100] as [number, number] };
    const next = applyVoiceFilters(prev, { minPrice: 500 });
    expect(next.priceRange[0]).toBe(100);
    expect(next.priceRange[1]).toBe(500);
  });

  it('FIX-18: minPrice > 9999 com sentinela como max → NÃO swap (9999=sem limite superior)', () => {
    // Prev: min=0, max=9999 (sentinela). Usuário fala "mínimo 10000".
    // rawMin=10000, rawMax=9999 (herdado sentinela) → [10000, 9999] é VÁLIDO (sem upper bound).
    const prev = { ...base, priceRange: [0, 9999] as [number, number] };
    const next = applyVoiceFilters(prev, { minPrice: 10000 });
    expect(next.priceRange[0]).toBe(10000);
    expect(next.priceRange[1]).toBe(9999); // sentinela preservado
  });

  it('FIX-18: range normal (min < max) não é afetado', () => {
    const prev = { ...base, priceRange: [100, 500] as [number, number] };
    const next = applyVoiceFilters(prev, { maxPrice: 800 });
    expect(next.priceRange).toEqual([100, 800]); // não invertido → sem swap
  });
});
