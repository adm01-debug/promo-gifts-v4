/**
 * Tests for useGravacaoPriceV2 pure functions:
 * - mapPriceResponseToFlat (nested & flat formats)
 * - getColorSelectorConfig
 */
import { describe, it, expect } from 'vitest';
import { mapPriceResponseToFlat, getColorSelectorConfig } from '@/hooks/simulation/useGravacaoPriceV2';

// ============================================
// mapPriceResponseToFlat — NESTED format
// ============================================
describe('mapPriceResponseToFlat (nested format)', () => {
  const nestedResponse = {
    success: true,
    codigo_orcamento: 'LASER-100',
    area: { id: 'area-1', code: 'FRENTE', name: 'Frente' },
    tabela: {
      id: 'tab-1',
      codigo_tabela: 'LASER-3x12',
      nome: 'Fiber Laser',
      grupo_tecnica: 'LASER',
      cobra_por_cor: false,
      max_cores: 1,
    },
    faixa: {
      ordem: 2,
      quantidade_minima: 100,
      quantidade_maxima: 499,
      preco_unitario_tabela: 3.5,
      prazo_dias: 7,
    },
    parametros: { quantidade: 200, num_cores: 1, largura_cm: 3, altura_cm: 12 },
    custos: {
      custo_base_unitario: 1.2,
      custo_primeira_cor: 1.2,
      custo_cores_adicionais: 0,
      custo_unitario_total: 1.2,
      custo_setup_base: 50,
      custo_manuseio: 0,
      custo_aplicacao: 0,
      custo_termo_transferencia: 0,
      custo_queima_forno: 0,
    },
    precos: {
      markup_percent: 120,
      preco_unitario_final: 3.5,
      subtotal_pecas: 700,
      faturamento_minimo_gravacao: 150,
      aplica_minimo: false,
      total_final: 700,
    },
  };

  it('maps nested response correctly', () => {
    const flat = mapPriceResponseToFlat(nestedResponse);
    expect(flat.success).toBe(true);
    expect(flat.area_id).toBe('area-1');
    expect(flat.area_code).toBe('FRENTE');
    expect(flat.area_name).toBe('Frente');
    expect(flat.tabela_id).toBe('tab-1');
    expect(flat.technique).toBe('Fiber Laser');
    expect(flat.grupo_tecnica).toBe('LASER');
    expect(flat.quantity).toBe(200);
    expect(flat.unit_price).toBe(3.5);
    expect(flat.total_price).toBe(700);
    expect(flat.subtotal_pecas).toBe(700);
    expect(flat.cost_base_unit).toBe(1.2);
    expect(flat.markup_percent).toBe(120);
    expect(flat.price_by_color).toBe(false);
    expect(flat.max_cores).toBe(1);
    expect(flat.production_days).toBe(7);
    expect(flat.tier_used).toBe(2);
    expect(flat.tier_min_qty).toBe(100);
    expect(flat.tier_max_qty).toBe(499);
    expect(flat.minimum_applied).toBe(false);
    expect(flat.faturamento_minimo_gravacao).toBe(150);
  });

  it('extracts tabela_codigo_curto from hyphenated code', () => {
    const flat = mapPriceResponseToFlat(nestedResponse);
    expect(flat.tabela_codigo).toBe('LASER-3x12');
    expect(flat.tabela_codigo_curto).toBe('LASER');
  });

  it('handles redirect info', () => {
    const withRedirect = {
      ...nestedResponse,
      redirected_from: 'area-old',
      redirected_to: 'area-1',
    };
    const flat = mapPriceResponseToFlat(withRedirect);
    expect(flat.redirected_from).toBe('area-old');
    expect(flat.redirected_to).toBe('area-1');
  });
});

// ============================================
// mapPriceResponseToFlat — FLAT format
// ============================================
describe('mapPriceResponseToFlat (flat format)', () => {
  const flatResponse = {
    success: true,
    area_id: 'area-2',
    area_code: 'SERI-5x5',
    nome_tabela: 'Serigrafia',
    tabela_id: 'tab-2',
    tabela: 'SERI-5x5',
    grupo_tecnica: 'SERIGRAFIA',
    quantidade: 500,
    num_cores: 3,
    preco_unitario: 2.0,
    valor_gravacao: 1000,
    total_cobrado: 1000,
    setup_total: 80,
    prazo_dias: 5,
    markup: {
      custo_unitario: 0.8,
      custo_setup_tabela: 80,
      markup_pct: 150,
    },
    detalhes: {
      cobra_por_cor: true,
      max_cores: 4,
    },
    faixa: {
      faixa_id: 'f1',
      qtd_min: 250,
      qtd_max: 999,
      prazo_dias: 5,
    },
  };

  it('maps flat response correctly', () => {
    const flat = mapPriceResponseToFlat(flatResponse);
    expect(flat.success).toBe(true);
    expect(flat.area_id).toBe('area-2');
    expect(flat.technique).toBe('Serigrafia');
    expect(flat.quantity).toBe(500);
    expect(flat.num_cores).toBe(3);
    expect(flat.unit_price).toBe(2.0);
    expect(flat.total_price).toBe(1000);
    expect(flat.price_by_color).toBe(true);
    expect(flat.max_cores).toBe(4);
    expect(flat.cost_setup).toBe(80);
    expect(flat.markup_percent).toBe(150);
    expect(flat.production_days).toBe(5);
    expect(flat.tier_min_qty).toBe(250);
    expect(flat.tier_max_qty).toBe(999);
  });

  it('handles missing optional fields gracefully', () => {
    const minimal = { success: true, tabela: 'X' };
    const flat = mapPriceResponseToFlat(minimal);
    expect(flat.success).toBe(true);
    expect(flat.unit_price).toBe(0);
    expect(flat.total_price).toBe(0);
    expect(flat.quantity).toBe(0);
    expect(flat.tabela_codigo).toBe('X');
  });
});

// ============================================
// getColorSelectorConfig
// ============================================
describe('getColorSelectorConfig', () => {
  it('returns full color for 0 max colors', () => {
    const config = getColorSelectorConfig(0);
    expect(config.showSelector).toBe(false);
    expect(config.maxValue).toBe(0);
    expect(config.label).toContain('Full Color');
  });

  it('returns fixed for 1 color', () => {
    const config = getColorSelectorConfig(1);
    expect(config.showSelector).toBe(false);
    expect(config.maxValue).toBe(1);
    expect(config.label).toContain('1 cor');
  });

  it('returns selector for multiple colors', () => {
    const config = getColorSelectorConfig(4);
    expect(config.showSelector).toBe(true);
    expect(config.maxValue).toBe(4);
    expect(config.label).toContain('4 cores');
  });
});
