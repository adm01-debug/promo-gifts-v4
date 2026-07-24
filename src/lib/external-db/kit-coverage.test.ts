import { describe, it, expect } from 'vitest';
import {
  KIT_AUDITED_FIELDS,
  isFieldFilled,
  computeKitCoverage,
  compareCoverage,
} from './kit-coverage';

/**
 * Threshold de cobertura mínima exigida da view `v_kit_component_complete`
 * quando comparada à tabela base `product_kit_components`.
 *
 * Justificativa do número:
 *  - 70% = a view DEVE preencher pelo menos 70% dos campos críticos em média.
 *  - Abaixo disso = view degradou ou está mal configurada (JOIN errado).
 *  - 100% seria ideal mas exige ETL perfeito no SSOT — usamos 70% como gate.
 */
const MIN_VIEW_AVG_COVERAGE_PCT = 70;

/** Linha fake "rica" — todos os campos preenchidos. */
const RICH_ROW = {
  component_name: 'Caneca Cerâmica',
  component_description: 'Caneca de cerâmica 300ml com alça curva',
  material: 'Cerâmica',
  color: 'Branco',
  primary_image_url: 'https://cdn.ex/c1.jpg',
  images: ['https://cdn.ex/c1.jpg', 'https://cdn.ex/c2.jpg'],
  height_mm: 95,
  width_mm: 80,
  length_mm: 110,
  diameter_mm: 80,
  circumference_mm: 251,
  weight_g: 320,
  capacity_ml: 300,
  component_type_code: 'MUG',
  supplier_component_code: 'SUP-MUG-001',
  personalization_notes: 'Gravação a laser na lateral',
};

/** Linha fake "crua" — só nome e quantidade (cenário base/legado). */
const SPARSE_ROW = {
  component_name: 'Item',
  component_description: null,
  material: null,
  color: '',
  primary_image_url: null,
  images: [],
  height_mm: null,
  width_mm: null,
  length_mm: null,
  diameter_mm: null,
  circumference_mm: null,
  weight_g: null,
  capacity_ml: null,
  component_type_code: null,
  supplier_component_code: null,
  personalization_notes: undefined,
};

describe('kit-coverage / isFieldFilled', () => {
  it('rejeita null, undefined, string vazia e array vazio', () => {
    expect(isFieldFilled(null)).toBe(false);
    expect(isFieldFilled(undefined)).toBe(false);
    expect(isFieldFilled('')).toBe(false);
    expect(isFieldFilled('   ')).toBe(false);
    expect(isFieldFilled([])).toBe(false);
  });
  it('aceita valores reais', () => {
    expect(isFieldFilled(0)).toBe(true);
    expect(isFieldFilled(false)).toBe(true);
    expect(isFieldFilled('x')).toBe(true);
    expect(isFieldFilled(['a'])).toBe(true);
  });
});

describe('kit-coverage / computeKitCoverage', () => {
  it('retorna 0% quando lista vazia', () => {
    const r = computeKitCoverage([]);
    expect(r.rows).toBe(0);
    expect(r.avgPct).toBe(0);
    expect(r.fullyNullFields).toHaveLength(0);
  });

  it('reporta 100% para linhas totalmente preenchidas', () => {
    const r = computeKitCoverage([RICH_ROW, RICH_ROW]);
    expect(r.rows).toBe(2);
    expect(r.avgPct).toBe(100);
    expect(r.fullyNullFields).toHaveLength(0);
    for (const field of KIT_AUDITED_FIELDS) {
      expect(r.coverage[field].pct).toBe(100);
    }
  });

  it('detecta campos 100% null em linhas crus', () => {
    const r = computeKitCoverage([SPARSE_ROW, SPARSE_ROW]);
    expect(r.fullyNullFields.length).toBeGreaterThan(10);
    expect(r.coverage.component_name.pct).toBe(100); // único preenchido
    expect(r.coverage.material.pct).toBe(0);
    expect(r.coverage.weight_g.pct).toBe(0);
  });

  it('calcula % parciais corretamente', () => {
    const r = computeKitCoverage([RICH_ROW, SPARSE_ROW]);
    expect(r.coverage.component_name.pct).toBe(100);
    expect(r.coverage.material.pct).toBe(50);
  });
});

describe('kit-coverage / compareCoverage (gate de regressão da view)', () => {
  it('aprova quando view >= base em todos os campos', () => {
    const view = computeKitCoverage([RICH_ROW, RICH_ROW]);
    const base = computeKitCoverage([RICH_ROW, SPARSE_ROW]);
    const cmp = compareCoverage(view, base);
    expect(cmp.regressions).toHaveLength(0);
  });

  it('reprova quando view regride em algum campo', () => {
    const view = computeKitCoverage([SPARSE_ROW, SPARSE_ROW]);
    const base = computeKitCoverage([RICH_ROW, RICH_ROW]);
    const cmp = compareCoverage(view, base);
    expect(cmp.regressions.length).toBeGreaterThan(10);
    for (const reg of cmp.regressions) {
      expect(reg.viewPct).toBeLessThan(reg.basePct);
    }
  });

  it(`view deve atingir cobertura média ≥ ${MIN_VIEW_AVG_COVERAGE_PCT}% (cenário enriquecido)`, () => {
    // Simula resposta típica da view: 80% das linhas ricas, 20% parciais
    const viewLike = [RICH_ROW, RICH_ROW, RICH_ROW, RICH_ROW, SPARSE_ROW];
    const r = computeKitCoverage(viewLike);
    expect(r.avgPct).toBeGreaterThanOrEqual(MIN_VIEW_AVG_COVERAGE_PCT);
  });

  it('cenário regressivo: view degradada NÃO atinge threshold', () => {
    const viewLike = [SPARSE_ROW, SPARSE_ROW, SPARSE_ROW, RICH_ROW];
    const r = computeKitCoverage(viewLike);
    expect(r.avgPct).toBeLessThan(MIN_VIEW_AVG_COVERAGE_PCT);
  });
});
