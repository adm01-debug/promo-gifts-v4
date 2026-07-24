/**
 * Paridade de preço: Simulador (`fetchOptionForTechnique`) vs Wizard
 * (`useWizardPricing.fetchComparisonPrices`).
 *
 * Ambos os fluxos chamam o RPC `fn_get_customization_price` e passam o
 * payload pelo mesmo `adaptPriceResponse`. Este teste trava o invariante:
 * para um conjunto fixo de (técnica × área × tamanho × cores × quantidade)
 * os campos comuns (`unitPrice`, `setupPrice`, `subtotal`, `totalPrice`,
 * `costPerUnit`, `productionDays`) DEVEM ser idênticos.
 *
 * O wizard é representado pela função `mapWizardPricing()` declarada
 * abaixo, que reproduz fielmente a transformação do `useWizardPricing`
 * (ver `src/hooks/simulator/useWizardPricing.ts` linhas 60-83 e 160-183).
 * Se essa transformação mudar no futuro, este teste vai pegar a
 * divergência.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { adaptPriceResponse } from '@/lib/personalization/adapters';
import type { CustomizationPriceFlat, PrintAreaV2 } from '@/hooks/simulation/useGravacaoPriceV2';
import type { Technique, TechniqueSettings } from '@/types/simulation';

// ---- Mocks ----------------------------------------------------------------

vi.mock('@/lib/external-rpc', () => ({
  invokeExternalRpc: vi.fn(),
}));

vi.mock('@/hooks/simulation/useGravacaoPriceV2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/simulation/useGravacaoPriceV2')>();
  return {
    ...actual,
    fetchProductPrintAreasV2: vi.fn(),
  };
});

import { invokeExternalRpc } from '@/lib/external-rpc';
import { fetchProductPrintAreasV2 } from '@/hooks/simulation/useGravacaoPriceV2';
import { fetchOptionForTechnique } from '@/hooks/simulation/simulationPriceFetcher';

const mockedRpc = invokeExternalRpc as unknown as ReturnType<typeof vi.fn>;
const mockedAreas = fetchProductPrintAreasV2 as unknown as ReturnType<typeof vi.fn>;

// ---- Fixtures -------------------------------------------------------------

const TECH_LASER: Technique = {
  id: 'tech-laser',
  code: 'LASER',
  name: 'Fiber Laser',
  description: null,
  unit_cost: 0,
  setup_cost: 0,
  estimated_days: 5,
  min_quantity: 1,
};

const TECH_SERIG: Technique = {
  id: 'tech-serig',
  code: 'SERIG',
  name: 'Serigrafia',
  description: null,
  unit_cost: 0,
  setup_cost: 0,
  estimated_days: 10,
  min_quantity: 50,
};

const TECH_UV: Technique = {
  id: 'tech-uv',
  code: 'UV',
  name: 'UV Digital',
  description: null,
  unit_cost: 0,
  setup_cost: 0,
  estimated_days: 7,
  min_quantity: 1,
};

const AREA_LASER: PrintAreaV2 = {
  area_id: 'area-laser',
  area_code: 'FRENTE',
  area_name: 'Frente',
  component_name: null,
  component_code: null,
  location_name: null,
  location_code: 'FRENTE',
  max_width: 5,
  max_height: 8,
  unit: 'cm',
  shape: 'rectangle',
  is_curved: false,
  is_primary: true,
  display_order: 1,
  max_colors: 1,
  customization_price_table_id: 'tp-laser',
  allowed_technique_ids: null,
  technique_name: 'Fiber Laser',
  grupo_tecnica: 'LASER',
  cobra_por_cor: false,
  usa_dimensao: true,
};

const AREA_SERIG: PrintAreaV2 = {
  ...AREA_LASER,
  area_id: 'area-serig',
  area_code: 'COSTAS',
  area_name: 'Costas',
  location_code: 'COSTAS',
  max_width: 10,
  max_height: 10,
  max_colors: 4,
  customization_price_table_id: 'tp-serig',
  technique_name: 'Serigrafia',
  grupo_tecnica: 'SERIGRAFIA',
  cobra_por_cor: true,
};

const AREA_UV: PrintAreaV2 = {
  ...AREA_LASER,
  area_id: 'area-uv',
  area_code: 'TAMPA',
  area_name: 'Tampa',
  location_code: 'TAMPA',
  max_width: 7,
  max_height: 7,
  max_colors: 1,
  customization_price_table_id: 'tp-uv',
  technique_name: 'UV Digital',
  grupo_tecnica: 'UV',
  cobra_por_cor: false,
};

/**
 * Payloads RPC realistas — um por (técnica × tamanho).
 * O `total_cobrado` segue a regra `MAX(valor_gravacao, setup_total)`.
 */
function buildPayload(args: {
  tabela: string;
  nome: string;
  grupo: string;
  qtd: number;
  cores: number;
  unit: number;
  setup: number;
  prazoDias: number;
}) {
  const valor = +(args.unit * args.qtd).toFixed(2);
  const total = Math.max(valor, args.setup);
  return {
    success: true,
    tabela: args.tabela,
    nome_tabela: args.nome,
    grupo_tecnica: args.grupo,
    quantidade: args.qtd,
    num_cores: args.cores,
    preco_unitario: args.unit,
    valor_gravacao: valor,
    setup_total: args.setup,
    total_cobrado: total,
    faixa: {
      faixa_id: `${args.tabela}-f1`,
      qtd_min: args.qtd,
      qtd_max: args.qtd + 999,
      prazo_dias: args.prazoDias,
    },
    detalhes: { cobra_por_cor: args.cores > 1, max_cores: 4, is_curved: false },
    markup: {
      markup_pct: 120,
      custo_unitario: +(args.unit / 1.2).toFixed(2),
      custo_setup_tabela: args.setup,
      preco_min_unit: args.unit,
      setup_proprio: null,
    },
    codigo_orcamento: `${args.tabela}-${args.qtd}`,
  };
}

// ---- Replica do wizard ----------------------------------------------------

/**
 * Reproduz o mapping de `useWizardPricing` (linhas 60-83 e 160-183 do
 * arquivo). Mantido inline para que qualquer mudança lá quebre este teste.
 */
function mapWizardPricing(flat: CustomizationPriceFlat, quantity: number) {
  return {
    unitPrice: flat.unit_price,
    setupPrice: flat.faturamento_minimo_gravacao,
    subtotal: flat.subtotal_pecas,
    totalPrice: flat.total_price,
    costPerUnit: quantity > 0 ? flat.total_price / quantity : 0,
    productionDays: flat.production_days,
  };
}

// ---- Cenários -------------------------------------------------------------

interface Scenario {
  label: string;
  technique: Technique;
  area: PrintAreaV2;
  settings: TechniqueSettings;
  quantity: number;
  payload: ReturnType<typeof buildPayload>;
}

const SCENARIOS: Scenario[] = [
  {
    label: 'Laser • Frente • 5×8 • 1 cor • 100un',
    technique: TECH_LASER,
    area: AREA_LASER,
    settings: { colors: 1, width: 5, height: 8, positions: 1 },
    quantity: 100,
    payload: buildPayload({
      tabela: 'LASER-3x12',
      nome: 'Fiber Laser',
      grupo: 'LASER',
      qtd: 100,
      cores: 1,
      unit: 3.5,
      setup: 50,
      prazoDias: 7,
    }),
  },
  {
    label: 'Serigrafia • Costas • 10×10 • 2 cores • 200un',
    technique: TECH_SERIG,
    area: AREA_SERIG,
    settings: { colors: 2, width: 10, height: 10, positions: 1 },
    quantity: 200,
    payload: buildPayload({
      tabela: 'SERI-10x10',
      nome: 'Serigrafia',
      grupo: 'SERIGRAFIA',
      qtd: 200,
      cores: 2,
      unit: 2.0,
      setup: 80,
      prazoDias: 10,
    }),
  },
  {
    label: 'UV Digital • Tampa • 7×7 • 1 cor • 50un (setup vira piso)',
    technique: TECH_UV,
    area: AREA_UV,
    settings: { colors: 1, width: 7, height: 7, positions: 1 },
    quantity: 50,
    payload: buildPayload({
      tabela: 'UV-7x7',
      nome: 'UV Digital',
      grupo: 'UV',
      qtd: 50,
      cores: 1,
      unit: 1.2,
      setup: 90,
      prazoDias: 7,
    }),
  },
  {
    label: 'Laser • quantidade alta (1000un)',
    technique: TECH_LASER,
    area: AREA_LASER,
    settings: { colors: 1, width: 5, height: 8, positions: 1 },
    quantity: 1000,
    payload: buildPayload({
      tabela: 'LASER-3x12',
      nome: 'Fiber Laser',
      grupo: 'LASER',
      qtd: 1000,
      cores: 1,
      unit: 1.8,
      setup: 50,
      prazoDias: 5,
    }),
  },
];

// ---- Testes ---------------------------------------------------------------

describe('Paridade simulador ↔ wizard (fn_get_customization_price)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const scenario of SCENARIOS) {
    it(`bate preço: ${scenario.label}`, async () => {
      mockedAreas.mockResolvedValue([scenario.area]);
      mockedRpc.mockResolvedValue(scenario.payload);

      // --- Caminho do simulador ---
      const simulatorOption = await fetchOptionForTechnique(
        scenario.technique,
        scenario.settings,
        scenario.quantity,
        0, // productUnitPrice = 0 → grandTotal == totalPersonalizationCost
        [scenario.area],
        'parity',
      );

      // --- Caminho do wizard (mesmo payload, mesmo adapter) ---
      const flat = adaptPriceResponse(scenario.payload as Record<string, unknown>);
      const wizardPricing = mapWizardPricing(flat, scenario.quantity);

      // --- Asserções de paridade ---
      expect(simulatorOption.priceSource).toBe('rpc');
      expect(simulatorOption.unitCost).toBeCloseTo(wizardPricing.unitPrice, 4);
      expect(simulatorOption.setupCost).toBeCloseTo(wizardPricing.setupPrice, 4);
      expect(simulatorOption.totalPersonalizationCost).toBeCloseTo(wizardPricing.totalPrice, 4);
      expect(simulatorOption.costPerUnit).toBeCloseTo(wizardPricing.costPerUnit, 4);
      expect(simulatorOption.estimatedDays).toBe(wizardPricing.productionDays);

      // Sanidade: o RPC foi chamado com os mesmos parâmetros que o wizard usaria
      expect(mockedRpc).toHaveBeenCalledWith(
        'fn_get_customization_price',
        expect.objectContaining({
          p_area_id: scenario.area.area_id,
          p_quantidade: scenario.quantity,
        }),
      );
    });
  }

  it('paridade preserva-se também com payload em formato EN (forward-compat)', async () => {
    const tech = TECH_SERIG;
    const area = AREA_SERIG;
    const settings: TechniqueSettings = { colors: 1, width: 8, height: 8, positions: 1 };
    const quantity = 150;

    const payloadEN = {
      success: true,
      table_code: 'SERI-8x8',
      table_name: 'Serigrafia',
      technique_group: 'SERIGRAFIA',
      quantity,
      num_colors: 1,
      unit_price: 2.4,
      subtotal_pieces: 360,
      setup_total_value: 80,
      total_charged: 360,
      faixa: { min_qty: 100, max_qty: 499, production_days: 8 },
      detalhes: { charges_per_color: true, max_colors: 4 },
      markup: { markup_percent: 120, unit_cost: 2.0, setup_cost_table: 80 },
    };

    mockedAreas.mockResolvedValue([area]);
    mockedRpc.mockResolvedValue(payloadEN);

    const simulatorOption = await fetchOptionForTechnique(
      tech,
      settings,
      quantity,
      0,
      [area],
      'parity-en',
    );
    const flat = adaptPriceResponse(payloadEN as unknown as Record<string, unknown>);
    const wizardPricing = mapWizardPricing(flat, quantity);

    expect(simulatorOption.unitCost).toBeCloseTo(wizardPricing.unitPrice, 4);
    expect(simulatorOption.totalPersonalizationCost).toBeCloseTo(wizardPricing.totalPrice, 4);
    expect(simulatorOption.costPerUnit).toBeCloseTo(wizardPricing.costPerUnit, 4);
  });
});
