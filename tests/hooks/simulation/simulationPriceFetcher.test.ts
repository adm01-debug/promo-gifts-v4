/**
 * Smoke + funcional para simulationPriceFetcher.
 *
 * Cobre:
 *   - happy path: técnica resolvida → RPC → SimulationOption com priceSource='rpc'
 *   - sem print area: opção marcada como 'unavailable'
 *   - RPC falha: opção marcada como 'unavailable' (não joga)
 *   - paralelismo: várias técnicas em uma única chamada de fetchAllOptions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Technique, TechniqueSettings } from '@/types/simulation';

// --- Mocks dos módulos externos -----------------------------------------
const invokeExternalRpcMock = vi.fn();
const fetchProductPrintAreasV2Mock = vi.fn();

vi.mock('@/lib/external-rpc', () => ({
  invokeExternalRpc: (...args: unknown[]) => invokeExternalRpcMock(...args),
}));

vi.mock('@/hooks/simulation/useGravacaoPriceV2', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/simulation/useGravacaoPriceV2')>(
    '@/hooks/simulation/useGravacaoPriceV2',
  );
  return {
    ...actual,
    fetchProductPrintAreasV2: (...args: unknown[]) => fetchProductPrintAreasV2Mock(...args),
  };
});

import { fetchAllOptions } from '@/hooks/simulation/simulationPriceFetcher';

const baseTechnique: Technique = {
  id: 'tech-silk',
  code: 'SILK',
  name: 'Serigrafia',
  description: null,
  unit_cost: 0,
  setup_cost: 0,
  estimated_days: 5,
  min_quantity: 50,
};

const baseSettings: TechniqueSettings = {
  colors: 2,
  width: 10,
  height: 5,
  positions: 1,
};

const printArea = {
  area_id: 'area-123',
  area_code: 'FRENTE',
  area_name: 'Frente',
  component_name: null,
  component_code: null,
  location_name: null,
  location_code: null,
  max_width: 20,
  max_height: 20,
  unit: 'cm',
  shape: 'rectangle',
  is_curved: false,
  is_primary: true,
  display_order: 0,
  max_colors: 4,
  customization_price_table_id: 'tab-1',
  allowed_technique_ids: null,
  technique_name: 'Serigrafia',
  grupo_tecnica: 'SILK',
  cobra_por_cor: true,
  usa_dimensao: true,
};

const flatRpcResponse = {
  success: true,
  area_id: 'area-123',
  tabela: 'SILK-01',
  tabela_id: 'tab-1',
  nome_tabela: 'Serigrafia',
  grupo_tecnica: 'SILK',
  quantidade: 100,
  num_cores: 2,
  preco_unitario: 1.5,
  valor_gravacao: 150,
  total_cobrado: 200,
  setup_total: 50,
  prazo_dias: 7,
  detalhes: { cobra_por_cor: true, max_cores: 4 },
  faixa: { faixa_id: 1, qtd_min: 50, qtd_max: 250, prazo_dias: 7 },
  markup: { custo_unitario: 0.8, custo_setup_tabela: 30, markup_pct: 50 },
};

beforeEach(() => {
  invokeExternalRpcMock.mockReset();
  fetchProductPrintAreasV2Mock.mockReset();
});

describe('fetchAllOptions', () => {
  it('returns empty when no productId', async () => {
    const out = await fetchAllOptions({
      selectedTechniqueIds: ['tech-silk'],
      techniques: [baseTechnique],
      techniqueSettings: { 'tech-silk': baseSettings },
      quantity: 100,
      productUnitPrice: 5,
      productId: null,
    });
    expect(out).toEqual([]);
    expect(invokeExternalRpcMock).not.toHaveBeenCalled();
  });

  it('happy path → SimulationOption with priceSource=rpc', async () => {
    fetchProductPrintAreasV2Mock.mockResolvedValue([printArea]);
    invokeExternalRpcMock.mockResolvedValue(flatRpcResponse);

    const out = await fetchAllOptions({
      selectedTechniqueIds: ['tech-silk'],
      techniques: [baseTechnique],
      techniqueSettings: { 'tech-silk': baseSettings },
      quantity: 100,
      productUnitPrice: 5,
      productId: 'prod-1',
    });

    expect(out).toHaveLength(1);
    expect(out[0].priceSource).toBe('rpc');
    expect(out[0].rpcAvailable).toBe(true);
    expect(out[0].calculatedAt).toBeTruthy();
    expect(() => new Date(out[0].calculatedAt!).toISOString()).not.toThrow();
    expect(out[0].techniqueId).toBe('tech-silk');
    expect(out[0].totalProductCost).toBe(500); // 5 * 100
    expect(out[0].totalPersonalizationCost).toBeGreaterThan(0);
    expect(out[0].grandTotal).toBe(out[0].totalProductCost + out[0].totalPersonalizationCost);
    expect(invokeExternalRpcMock).toHaveBeenCalledWith(
      'fn_get_customization_price',
      expect.objectContaining({
        p_area_id: 'area-123',
        p_quantidade: 100,
        p_largura_cm: 10,
        p_altura_cm: 5,
      }),
    );
  });

  it('omits dimensions in the RPC call when the area is non-dimensional (usa_dimensao=false)', async () => {
    // Regression (BUG-DIM): passing largura/altura to a non-dimensional table
    // (Serigrafia/UV em caneta) makes fn_get_customization_price return no price.
    fetchProductPrintAreasV2Mock.mockResolvedValue([{ ...printArea, usa_dimensao: false }]);
    invokeExternalRpcMock.mockResolvedValue(flatRpcResponse);

    await fetchAllOptions({
      selectedTechniqueIds: ['tech-silk'],
      techniques: [baseTechnique],
      techniqueSettings: { 'tech-silk': baseSettings }, // width/height > 0
      quantity: 100,
      productUnitPrice: 5,
      productId: 'prod-1',
    });

    expect(invokeExternalRpcMock).toHaveBeenCalledTimes(1);
    const params = invokeExternalRpcMock.mock.calls[0][1] as Record<string, unknown>;
    expect(params).not.toHaveProperty('p_largura_cm');
    expect(params).not.toHaveProperty('p_altura_cm');
    expect(params).toMatchObject({ p_area_id: 'area-123', p_quantidade: 100 });
  });

  it('marks technique as unavailable when no print area matches', async () => {
    fetchProductPrintAreasV2Mock.mockResolvedValue([]);

    const out = await fetchAllOptions({
      selectedTechniqueIds: ['tech-silk'],
      techniques: [baseTechnique],
      techniqueSettings: { 'tech-silk': baseSettings },
      quantity: 100,
      productUnitPrice: 5,
      productId: 'prod-1',
    });

    expect(out).toHaveLength(1);
    expect(out[0].priceSource).toBe('unavailable');
    expect(out[0].totalPersonalizationCost).toBe(0);
    expect(invokeExternalRpcMock).not.toHaveBeenCalled();
  });

  it('falls back to legacy heuristic when RPC throws (graceful degradation)', async () => {
    // Regra de negócio: quando o RPC oficial falha (rede/timeout/erro),
    // o simulador NÃO marca a técnica como indisponível — ele degrada para
    // o cálculo legado (`buildLegacyFallbackOption`) usando unit_cost/setup_cost
    // do catálogo, e expõe `fallbackReason` para que a UI mostre aviso.
    // Ver simulationPriceFetcher.ts:204-222.
    fetchProductPrintAreasV2Mock.mockResolvedValue([printArea]);
    invokeExternalRpcMock.mockRejectedValue(new Error('boom'));

    const out = await fetchAllOptions({
      selectedTechniqueIds: ['tech-silk'],
      techniques: [baseTechnique],
      techniqueSettings: { 'tech-silk': baseSettings },
      quantity: 100,
      productUnitPrice: 5,
      productId: 'prod-1',
    });

    expect(out).toHaveLength(1);
    expect(out[0].priceSource).toBe('legacy-fallback');
    expect(out[0].fallbackReason).toBe('boom');
    expect(out[0].rpcAvailable).toBe(false);
  });

  it('runs multiple techniques in parallel', async () => {
    fetchProductPrintAreasV2Mock.mockResolvedValue([printArea]);
    invokeExternalRpcMock.mockResolvedValue(flatRpcResponse);

    const techB: Technique = { ...baseTechnique, id: 'tech-silk-2', name: 'Serigrafia' };

    const out = await fetchAllOptions({
      selectedTechniqueIds: ['tech-silk', 'tech-silk-2'],
      techniques: [baseTechnique, techB],
      techniqueSettings: {
        'tech-silk': baseSettings,
        'tech-silk-2': baseSettings,
      },
      quantity: 100,
      productUnitPrice: 5,
      productId: 'prod-1',
    });

    expect(out).toHaveLength(2);
    expect(invokeExternalRpcMock).toHaveBeenCalledTimes(2);
  });

  it('fills calculatedAt and rpcAvailable=false on legacy-fallback path', async () => {
    fetchProductPrintAreasV2Mock.mockResolvedValue([printArea]);
    invokeExternalRpcMock.mockRejectedValue(new Error('rpc down'));

    const out = await fetchAllOptions({
      selectedTechniqueIds: ['tech-silk'],
      techniques: [baseTechnique],
      techniqueSettings: { 'tech-silk': baseSettings },
      quantity: 100,
      productUnitPrice: 5,
      productId: 'prod-1',
    });

    expect(out).toHaveLength(1);
    // The fetcher falls back to legacy-fallback when RPC throws.
    expect(out[0].priceSource).toBe('legacy-fallback');
    expect(out[0].rpcAvailable).toBe(false);
    expect(out[0].calculatedAt).toBeTruthy();
    expect(out[0].fallbackReason).toMatch(/rpc down/);
  });
});
